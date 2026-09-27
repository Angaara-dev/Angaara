//! Connects the job executor to Matrix: authorizes requests and streams results back.

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use crate::{
    job::{Executor, JobConfig, RunnerEvent},
    policy::{check_room, check_sender, Policy, Rejection},
    protocol::{
        valid_job_id, valid_project_name, Action, Request, State, Status, OUTPUT_KEY, REQUEST_KEY,
        REQUEST_MSGTYPE, STATUS_KEY,
    },
};
use angaara_bot::{
    matrix_sdk::{
        deserialized_responses::EncryptionInfo,
        event_handler::RawEvent,
        media::{MediaFormat, MediaRequestParameters},
        ruma::{
            events::room::{message::OriginalSyncRoomMessageEvent, EncryptedFile, MediaSource},
            OwnedUserId,
        },
        Client, Room,
    },
    AngaaraBot, Error, Result,
};
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tracing::{info, warn};

/// Requests older than this are ignored, so replayed history can't trigger builds.
const MAX_REQUEST_AGE: Duration = Duration::from_secs(5 * 60);
const OUTPUT_FLUSH_INTERVAL: Duration = Duration::from_secs(1);
/// Keeps each output message well under Matrix's ~64 KB event limit.
const OUTPUT_CHUNK_BYTES: usize = 8 * 1024;

struct Runtime {
    policy: Policy,
    runner_id: OwnedUserId,
    executor: Arc<Executor>,
    events: mpsc::UnboundedSender<RunnerEvent>,
    rooms: Mutex<HashMap<String, Room>>,
    seen: Mutex<HashSet<String>>,
}

impl Runtime {
    fn status(&self, room: &Room, status: Status) {
        self.rooms
            .lock()
            .unwrap()
            .insert(status.job_id.clone(), room.clone());
        let _ = self.events.send(RunnerEvent::Status(status));
    }

    async fn handle(
        self: Arc<Self>,
        event: OriginalSyncRoomMessageEvent,
        room: Room,
        raw: RawEvent,
        encryption: Option<EncryptionInfo>,
        client: Client,
    ) {
        let Some(content) = serde_json::from_str::<Value>(raw.0.get())
            .ok()
            .and_then(|v| v.get("content").cloned())
        else {
            return;
        };
        if content.get("msgtype").and_then(Value::as_str) != Some(REQUEST_MSGTYPE) {
            return;
        }

        match check_sender(&self.policy, &event.sender, encryption.as_ref()) {
            Ok(()) => {}
            Err(Rejection::NotOwner) => {
                warn!("ignored request from {}", event.sender);
                return;
            }
            Err(rejection) => {
                self.status(
                    &room,
                    Status::rejected(&job_id_of(&content), rejection.reason()),
                );
                return;
            }
        }

        let age = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .saturating_sub(Duration::from_millis(event.origin_server_ts.0.into()));
        if age > MAX_REQUEST_AGE || !self.seen.lock().unwrap().insert(event.event_id.to_string()) {
            return;
        }

        let request = match content
            .get(REQUEST_KEY)
            .cloned()
            .map(serde_json::from_value::<Request>)
        {
            Some(Ok(request)) if valid_job_id(&request.job_id) => request,
            _ => {
                self.status(
                    &room,
                    Status::rejected(&job_id_of(&content), "malformed request"),
                );
                return;
            }
        };
        if let Err(rejection) = check_room(&self.policy, &room, &self.runner_id).await {
            self.status(&room, Status::rejected(&request.job_id, rejection.reason()));
            return;
        }
        self.rooms
            .lock()
            .unwrap()
            .insert(request.job_id.clone(), room.clone());

        match request.action {
            Action::Ping => {
                let status = Status {
                    info: Some(Box::new(self.executor.info().await)),
                    ..Status::new(&request.job_id, State::Online)
                };
                self.status(&room, status);
            }
            Action::Pull => {
                let status = match self.pull(&request, &client).await {
                    Ok(file) => Status {
                        bundle: Some(file),
                        ..Status::new(&request.job_id, State::Succeeded)
                    },
                    Err(reason) => Status::rejected(&request.job_id, reason),
                };
                self.status(&room, status);
            }
            Action::Stop => {
                if self.executor.stop().is_none() {
                    self.status(
                        &room,
                        Status::rejected(&request.job_id, "nothing is running"),
                    );
                }
            }
            _ => self.start_job(request, room, client).await,
        }
    }

    /// Packs the project and uploads it encrypted; only the owner's devices get the key.
    async fn pull(&self, request: &Request, client: &Client) -> std::result::Result<Value, String> {
        let project = request
            .project
            .clone()
            .filter(|p| valid_project_name(p))
            .ok_or("invalid project name")?;
        let bytes = self.executor.pack(project).await?;
        let file = client
            .upload_encrypted_file(&mut std::io::Cursor::new(bytes))
            .await
            .map_err(|_| "could not upload the project")?;
        serde_json::to_value(file).map_err(|_| "could not encode the project".to_owned())
    }

    async fn start_job(&self, request: Request, room: Room, client: Client) {
        let Some(project) = request.project.filter(|p| valid_project_name(p)) else {
            self.status(
                &room,
                Status::rejected(&request.job_id, "invalid project name"),
            );
            return;
        };
        if request.action == Action::Shell {
            let command = request.command.unwrap_or_default();
            tokio::spawn(
                self.executor
                    .clone()
                    .run_shell(request.job_id, project, command),
            );
            return;
        }
        let bundle = match request.bundle {
            None => None,
            Some(file) => match download_bundle(&client, file).await {
                Ok(bytes) => Some(bytes),
                Err(reason) => {
                    self.status(&room, Status::rejected(&request.job_id, reason));
                    return;
                }
            },
        };
        let executor = self.executor.clone();
        if request.action == Action::Save {
            tokio::spawn(executor.save(request.job_id, project, bundle));
        } else {
            tokio::spawn(executor.run(request.job_id, request.action, project, bundle));
        }
    }
}

fn job_id_of(content: &Value) -> String {
    content
        .get(REQUEST_KEY)
        .and_then(|r| r.get("job_id"))
        .and_then(Value::as_str)
        .filter(|id| valid_job_id(id))
        .unwrap_or("unknown")
        .to_owned()
}

/// Downloads and decrypts the project zip. Only encrypted uploads are accepted.
async fn download_bundle(client: &Client, file: Value) -> std::result::Result<Vec<u8>, String> {
    let file: EncryptedFile =
        serde_json::from_value(file).map_err(|_| "bundle must be an encrypted file")?;
    let request = MediaRequestParameters {
        source: MediaSource::Encrypted(Box::new(file)),
        format: MediaFormat::File,
    };
    let bytes = client
        .media()
        .get_media_content(&request, false)
        .await
        .map_err(|_| "could not download or decrypt the project")?;
    if bytes.len() > crate::bundle::Limits::default().max_bundle_bytes {
        return Err("project bundle is too large".into());
    }
    Ok(bytes)
}

fn status_body(status: &Status) -> String {
    let id = &status.job_id;
    let reason = status
        .reason
        .as_deref()
        .map(|r| format!(": {r}"))
        .unwrap_or_default();
    match status.state {
        State::Online => {
            let info = status.info.as_ref();
            let cargo = info
                .and_then(|i| i.cargo.clone())
                .unwrap_or_else(|| "cargo missing".into());
            let platform = info
                .map(|i| format!("{}/{}", i.os, i.arch))
                .unwrap_or_default();
            let shell = if info.is_some_and(|i| i.shell) {
                ", shell on"
            } else {
                ""
            };
            format!("Runner online ({platform}, {cargo}{shell})")
        }
        State::Running => format!("Job {id} running"),
        State::Succeeded => format!("Job {id} succeeded"),
        State::Failed => match status.exit_code {
            Some(code) if reason.is_empty() => format!("Job {id} failed (exit code {code})"),
            _ => format!("Job {id} failed{reason}"),
        },
        State::Stopped => format!("Job {id} stopped"),
        State::Rejected => format!("Job {id} rejected{reason}"),
    }
}

/// Sends runner events to their rooms, batching output so busy builds don't hit rate limits.
async fn deliver(runtime: Arc<Runtime>, mut rx: mpsc::UnboundedReceiver<RunnerEvent>) {
    let mut buffers: HashMap<String, (u64, String)> = HashMap::new();
    let mut ticker = tokio::time::interval(OUTPUT_FLUSH_INTERVAL);
    loop {
        tokio::select! {
            event = rx.recv() => match event {
                Some(RunnerEvent::Output(output)) => {
                    let (_, buf) = buffers.entry(output.job_id.clone()).or_default();
                    if !buf.is_empty() {
                        buf.push('\n');
                    }
                    buf.push_str(&output.text);
                    if buf.len() >= OUTPUT_CHUNK_BYTES {
                        flush(&runtime, &mut buffers, &output.job_id).await;
                    }
                }
                Some(RunnerEvent::Status(status)) => {
                    flush(&runtime, &mut buffers, &status.job_id).await;
                    send(&runtime, &status.job_id, json!({
                        "msgtype": "m.notice",
                        "body": status_body(&status),
                        STATUS_KEY: status,
                    })).await;
                }
                None => return,
            },
            _ = ticker.tick() => {
                let jobs: Vec<String> = buffers.keys().cloned().collect();
                for job in jobs {
                    flush(&runtime, &mut buffers, &job).await;
                }
            }
        }
    }
}

async fn flush(runtime: &Runtime, buffers: &mut HashMap<String, (u64, String)>, job_id: &str) {
    let Some((seq, buf)) = buffers.get_mut(job_id) else {
        return;
    };
    while !buf.is_empty() {
        let mut cut = buf.len().min(OUTPUT_CHUNK_BYTES);
        while !buf.is_char_boundary(cut) {
            cut -= 1;
        }
        let text: String = buf.drain(..cut).collect();
        let content = json!({
            "msgtype": "m.notice",
            "body": text,
            OUTPUT_KEY: { "job_id": job_id, "seq": *seq, "text": text },
        });
        *seq += 1;
        send(runtime, job_id, content).await;
    }
}

async fn send(runtime: &Runtime, job_id: &str, content: Value) {
    let room = runtime.rooms.lock().unwrap().get(job_id).cloned();
    if let Some(room) = room {
        if let Err(e) = room.send_raw("m.room.message", content).await {
            warn!("could not send runner update: {e}");
        }
    }
}

pub struct Config {
    pub homeserver: String,
    pub owner: OwnedUserId,
    pub workdir: PathBuf,
    pub allow_unsigned_devices: bool,
    pub run_timeout: Duration,
    pub allow_shell: bool,
    /// Starts `code tunnel --name <tunnel>` alongside the runner when set.
    pub tunnel: Option<String>,
    pub auth: Auth,
}

pub enum Auth {
    Token {
        user_id: String,
        device_id: String,
        token: String,
    },
    Password {
        user: String,
        password: String,
    },
}

pub fn config_from_env() -> Result<Config> {
    let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let need = |k: &str| var(k).ok_or_else(|| Error::other(format!("{k} is not set")));
    let owner = need("ANGAARA_RUNNER_OWNER")?
        .as_str()
        .try_into()
        .map_err(|_| Error::other("ANGAARA_RUNNER_OWNER must be a user ID like @you:matrix.org"))?;
    let auth = match (var("ANGAARA_TOKEN"), var("ANGAARA_PASSWORD")) {
        (Some(token), _) => Auth::Token {
            user_id: need("ANGAARA_USER_ID")?,
            device_id: need("ANGAARA_DEVICE_ID")?,
            token,
        },
        (None, Some(password)) => Auth::Password {
            user: need("ANGAARA_USER")?,
            password,
        },
        (None, None) => return Err(Error::other("set ANGAARA_TOKEN or ANGAARA_PASSWORD")),
    };
    let run_minutes = var("ANGAARA_RUNNER_RUN_TIMEOUT_MINUTES")
        .and_then(|m| m.parse::<u64>().ok())
        .unwrap_or(60);
    let tunnel = var("ANGAARA_RUNNER_TUNNEL");
    if let Some(name) = &tunnel {
        let valid = (1..=20).contains(&name.len())
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
        if !valid {
            return Err(Error::other(
                "ANGAARA_RUNNER_TUNNEL must be 1-20 letters, digits or dashes",
            ));
        }
    }
    Ok(Config {
        homeserver: need("ANGAARA_HOMESERVER")?,
        owner,
        workdir: PathBuf::from(var("ANGAARA_RUNNER_DIR").unwrap_or_else(|| "runner-data".into())),
        allow_unsigned_devices: var("ANGAARA_RUNNER_ALLOW_UNSIGNED_DEVICES").as_deref()
            == Some("1"),
        run_timeout: Duration::from_secs(run_minutes * 60),
        allow_shell: var("ANGAARA_RUNNER_ALLOW_SHELL").as_deref() == Some("1"),
        tunnel,
        auth,
    })
}

fn private_dir(path: &std::path::Path) -> Result<()> {
    std::fs::create_dir_all(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// Spawns the VS Code CLI's tunnel. Its output goes to the runner's log, including a
/// sign-in code the first time. The runner's own credentials are not passed on.
fn start_tunnel(name: &str) -> Option<tokio::process::Child> {
    let cli = std::env::var("ANGAARA_RUNNER_CODE").unwrap_or_else(|_| "code".into());
    let mut cmd = tokio::process::Command::new(cli);
    cmd.args(["tunnel", "--name", name, "--accept-server-license-terms"])
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true);
    for (key, _) in std::env::vars() {
        if key.starts_with("ANGAARA_") {
            cmd.env_remove(key);
        }
    }
    match cmd.spawn() {
        Ok(child) => {
            tracing::info!("VS Code tunnel {name} starting");
            Some(child)
        }
        Err(err) => {
            tracing::warn!("couldn't start the VS Code tunnel ({err}); is the code CLI installed?");
            None
        }
    }
}

/// Logs in and serves jobs until the process is stopped.
pub async fn run(config: Config) -> Result<()> {
    private_dir(&config.workdir)?;
    private_dir(&config.workdir.join("projects"))?;
    // Held for the runner's lifetime; kill_on_drop closes the tunnel when the runner stops.
    let _tunnel = config.tunnel.as_deref().and_then(start_tunnel);

    let mut secrets = Vec::new();
    let mut builder = AngaaraBot::builder()
        .homeserver(&config.homeserver)
        .store_path(config.workdir.join("state"))
        .device_name("Angaara Runner")
        .accept_invites_from(config.owner.as_str());
    builder = match &config.auth {
        Auth::Token {
            user_id,
            device_id,
            token,
        } => {
            secrets.push(token.clone());
            builder.access_token(user_id, device_id, token)
        }
        Auth::Password { user, password } => {
            secrets.push(password.clone());
            builder.login(user, password)
        }
    };

    let policy = Policy {
        owner: config.owner.clone(),
        allow_unsigned_devices: config.allow_unsigned_devices,
    };
    let job_config = JobConfig {
        run_timeout: config.run_timeout,
        allow_shell: config.allow_shell,
        tunnel: _tunnel.as_ref().and(config.tunnel.clone()),
        ..JobConfig::default()
    };
    let workdir = config.workdir.clone();
    let allow_shell = config.allow_shell;

    builder
        .on_ready(move |ctx| {
            let (policy, job_config, workdir, mut secrets) = (
                policy.clone(),
                job_config.clone(),
                workdir.clone(),
                secrets.clone(),
            );
            let owner = policy.owner.clone();
            async move {
                let client = ctx.client().clone();
                secrets.extend(client.access_token());
                let (tx, rx) = mpsc::unbounded_channel();
                let runtime = Arc::new(Runtime {
                    policy,
                    runner_id: ctx.user_id(),
                    executor: Executor::new(workdir, job_config, tx.clone(), secrets),
                    events: tx,
                    rooms: Mutex::new(HashMap::new()),
                    seen: Mutex::new(HashSet::new()),
                });
                tokio::spawn(deliver(runtime.clone(), rx));
                client.add_event_handler(
                    move |ev: OriginalSyncRoomMessageEvent,
                          room: Room,
                          raw: RawEvent,
                          encryption: Option<EncryptionInfo>,
                          client: Client| {
                        runtime.clone().handle(ev, room, raw, encryption, client)
                    },
                );
                info!("runner ready as {}; only {owner} can use it", ctx.user_id());
                if allow_shell {
                    warn!("shell is ON: {owner} can run any command as this OS user");
                }
                Ok(())
            }
        })
        .run()
        .await
}
