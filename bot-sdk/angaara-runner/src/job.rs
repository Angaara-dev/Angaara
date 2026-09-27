//! Runs one job at a time (cargo, or a shell command if enabled) with a scrubbed environment, timeouts and a kill switch.

use std::{
    path::PathBuf,
    process::Stdio,
    sync::{Arc, Mutex},
    time::Duration,
};

use tokio::{
    io::{AsyncBufReadExt, AsyncRead, BufReader},
    process::{Child, Command},
    sync::{mpsc, oneshot},
};

use crate::{
    bundle::{self, Limits},
    protocol::{Action, Output, RunnerInfo, State, Status},
    secrets::{parse_env, Redactor},
};

#[derive(Debug)]
pub enum RunnerEvent {
    Status(Status),
    Output(Output),
}

#[derive(Debug, Clone)]
pub struct JobConfig {
    pub build_timeout: Duration,
    pub run_timeout: Duration,
    pub max_output_bytes: usize,
    pub limits: Limits,
    /// Allows `shell` jobs. Off by default.
    pub allow_shell: bool,
    /// Name of the VS Code tunnel the runner keeps open, if any.
    pub tunnel: Option<String>,
}

impl Default for JobConfig {
    fn default() -> Self {
        Self {
            build_timeout: Duration::from_secs(20 * 60),
            run_timeout: Duration::from_secs(60 * 60),
            max_output_bytes: 4 * 1024 * 1024,
            limits: Limits::default(),
            allow_shell: false,
            tunnel: None,
        }
    }
}

/// Only these host variables reach cargo. Everything else (including the runner's own token) is dropped.
const PASSTHROUGH_ENV: &[&str] = &[
    "PATH",
    "HOME",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "RUSTUP_TOOLCHAIN",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "USERPROFILE",
    "SYSTEMROOT",
    "APPDATA",
    "LOCALAPPDATA",
];

/// Longest command line a `shell` job accepts.
pub const MAX_COMMAND_BYTES: usize = 4096;

enum Task {
    Cargo(&'static str),
    Shell(String),
}

pub struct Executor {
    workdir: PathBuf,
    config: JobConfig,
    events: mpsc::UnboundedSender<RunnerEvent>,
    base_secrets: Vec<String>,
    current: Mutex<Option<(String, oneshot::Sender<()>)>>,
}

impl Executor {
    pub fn new(
        workdir: PathBuf,
        config: JobConfig,
        events: mpsc::UnboundedSender<RunnerEvent>,
        base_secrets: Vec<String>,
    ) -> Arc<Self> {
        Arc::new(Self {
            workdir,
            config,
            events,
            base_secrets,
            current: Mutex::new(None),
        })
    }

    fn emit_status(&self, status: Status) {
        let _ = self.events.send(RunnerEvent::Status(status));
    }

    /// Reserves the single job slot, or returns None if a job is already running.
    fn try_reserve(&self, job_id: &str) -> Option<oneshot::Receiver<()>> {
        let mut current = self.current.lock().unwrap();
        if current.is_some() {
            return None;
        }
        let (tx, rx) = oneshot::channel();
        *current = Some((job_id.to_owned(), tx));
        Some(rx)
    }

    fn release(&self, job_id: &str) {
        let mut current = self.current.lock().unwrap();
        if current.as_ref().is_some_and(|(id, _)| id == job_id) {
            *current = None;
        }
    }

    /// Stops the running job, if any. Returns the ID of the job that was stopped.
    pub fn stop(&self) -> Option<String> {
        let (job_id, kill) = self.current.lock().unwrap().take()?;
        let _ = kill.send(());
        Some(job_id)
    }

    pub async fn info(&self) -> RunnerInfo {
        let cargo = tokio::time::timeout(Duration::from_secs(10), async {
            let mut cmd = Command::new("cargo");
            cmd.arg("--version").stdin(Stdio::null());
            scrub_env(&mut cmd);
            cmd.output().await.ok()
        })
        .await
        .ok()
        .flatten()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned());
        RunnerInfo {
            version: env!("CARGO_PKG_VERSION").to_owned(),
            os: std::env::consts::OS.to_owned(),
            arch: std::env::consts::ARCH.to_owned(),
            cargo,
            shell: self.config.allow_shell,
            projects_dir: std::path::absolute(self.workdir.join("projects"))
                .ok()
                .map(|p| p.to_string_lossy().into_owned()),
            tunnel: self.config.tunnel.clone(),
            busy: self.current.lock().unwrap().is_some(),
            projects: list_projects(&self.workdir.join("projects")),
        }
    }

    /// Runs a cargo job to completion, reporting everything through the event channel.
    pub async fn run(
        self: Arc<Self>,
        job_id: String,
        action: Action,
        project: String,
        bundle: Option<Vec<u8>>,
    ) {
        let Some(subcommand) = action.cargo_subcommand() else {
            return;
        };
        self.start(job_id, Task::Cargo(subcommand), project, bundle)
            .await;
    }

    /// Zips the runner's copy of a project so it can be sent back to Angaara.
    pub async fn pack(&self, project: String) -> std::result::Result<Vec<u8>, String> {
        let (limits, dir) = (
            self.config.limits,
            self.workdir.join("projects").join(project),
        );
        tokio::task::spawn_blocking(move || bundle::pack(&dir, limits))
            .await
            .map_err(|_| "could not pack project".to_owned())?
    }

    /// Writes the uploaded files without building. Skips the job slot so it works while a bot runs.
    pub async fn save(self: Arc<Self>, job_id: String, project: String, bundle: Option<Vec<u8>>) {
        let Some(bytes) = bundle else {
            self.emit_status(Status::rejected(&job_id, "nothing to save"));
            return;
        };
        let (limits, target) = (
            self.config.limits,
            self.workdir.join("projects").join(project),
        );
        let status =
            match tokio::task::spawn_blocking(move || bundle::extract(&bytes, &target, limits))
                .await
            {
                Ok(Ok(_)) => Status::new(&job_id, State::Succeeded),
                Ok(Err(reason)) => Status {
                    reason: Some(reason),
                    ..Status::new(&job_id, State::Failed)
                },
                Err(_) => Status {
                    reason: Some("could not unpack project".into()),
                    ..Status::new(&job_id, State::Failed)
                },
            };
        self.emit_status(status);
    }

    /// Runs a shell command in the project folder, if the runner allows it.
    pub async fn run_shell(self: Arc<Self>, job_id: String, project: String, command: String) {
        if !self.config.allow_shell {
            self.emit_status(Status::rejected(
                &job_id,
                "shell is off on this runner; start it with ANGAARA_RUNNER_ALLOW_SHELL=1",
            ));
            return;
        }
        if command.trim().is_empty() || command.len() > MAX_COMMAND_BYTES {
            self.emit_status(Status::rejected(&job_id, "command is empty or too long"));
            return;
        }
        self.start(job_id, Task::Shell(command), project, None)
            .await;
    }

    async fn start(&self, job_id: String, task: Task, project: String, bundle: Option<Vec<u8>>) {
        let Some(kill_rx) = self.try_reserve(&job_id) else {
            self.emit_status(Status::rejected(
                &job_id,
                "runner is busy with another job; press Stop first",
            ));
            return;
        };
        let final_status = self.execute(&job_id, task, &project, bundle, kill_rx).await;
        self.release(&job_id);
        self.emit_status(final_status);
    }

    async fn execute(
        &self,
        job_id: &str,
        task: Task,
        project: &str,
        bundle: Option<Vec<u8>>,
        kill_rx: oneshot::Receiver<()>,
    ) -> Status {
        let fail = |reason: String| Status {
            reason: Some(reason),
            ..Status::new(job_id, State::Failed)
        };
        let dir = self.workdir.join("projects").join(project);

        if let Some(bytes) = bundle {
            let (limits, target) = (self.config.limits, dir.clone());
            let extracted =
                tokio::task::spawn_blocking(move || bundle::extract(&bytes, &target, limits)).await;
            match extracted {
                Ok(Ok(_)) => {}
                Ok(Err(reason)) => return fail(reason),
                Err(_) => return fail("could not unpack project".into()),
            }
        }
        if matches!(task, Task::Shell(_)) {
            if let Err(reason) = bundle::ensure_real_dir(&dir) {
                return fail(reason);
            }
        } else if !dir.join("Cargo.toml").is_file() {
            return fail("no project uploaded yet".into());
        }

        let env_vars = std::fs::read_to_string(dir.join(".env"))
            .ok()
            .filter(|s| s.len() <= 64 * 1024)
            .map(|s| parse_env(&s))
            .unwrap_or_default();
        let redactor = Redactor::new(
            self.base_secrets
                .iter()
                .cloned()
                .chain(env_vars.values().cloned()),
        );

        let (mut cmd, program) = match &task {
            Task::Cargo(subcommand) => {
                let mut cmd = Command::new("cargo");
                cmd.arg(subcommand);
                (cmd, "cargo")
            }
            Task::Shell(command) => (shell_command(command), SHELL),
        };
        cmd.current_dir(&dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        scrub_env(&mut cmd);
        cmd.env("CARGO_TERM_COLOR", "never");
        if matches!(
            task,
            Task::Cargo("run") | Task::Cargo("test") | Task::Shell(_)
        ) {
            cmd.envs(&env_vars);
        }
        #[cfg(unix)]
        cmd.process_group(0);

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(_) if program == "cargo" => {
                return fail("cargo not found on the runner; install Rust from rustup.rs".into())
            }
            Err(_) => return fail(format!("could not start {program}")),
        };
        self.emit_status(Status::new(job_id, State::Running));

        let (line_tx, line_rx) = mpsc::unbounded_channel();
        let readers = [
            child
                .stdout
                .take()
                .map(|out| tokio::spawn(read_lines(out, line_tx.clone()))),
            child
                .stderr
                .take()
                .map(|err| tokio::spawn(read_lines(err, line_tx.clone()))),
        ];
        drop(line_tx);
        let forwarder = tokio::spawn(forward_output(
            line_rx,
            self.events.clone(),
            job_id.to_owned(),
            redactor,
            self.config.max_output_bytes,
        ));

        let timeout = if matches!(task, Task::Cargo("run") | Task::Shell(_)) {
            self.config.run_timeout
        } else {
            self.config.build_timeout
        };
        let outcome = tokio::select! {
            status = child.wait() => Ok(status),
            _ = kill_rx => Err(State::Stopped),
            _ = tokio::time::sleep(timeout) => Err(State::Failed),
        };
        if outcome.is_err() {
            kill_tree(&mut child).await;
        }
        for reader in readers.into_iter().flatten() {
            let _ = reader.await;
        }
        let _ = forwarder.await;

        match outcome {
            Ok(Ok(status)) if status.success() => Status {
                exit_code: status.code(),
                ..Status::new(job_id, State::Succeeded)
            },
            Ok(Ok(status)) => Status {
                exit_code: status.code(),
                ..Status::new(job_id, State::Failed)
            },
            Ok(Err(_)) => fail(format!("could not wait for {program}")),
            Err(State::Stopped) => Status::new(job_id, State::Stopped),
            Err(_) => fail(format!(
                "timed out after {} minutes",
                timeout.as_secs() / 60
            )),
        }
    }
}

#[cfg(unix)]
const SHELL: &str = "sh";
#[cfg(windows)]
const SHELL: &str = "powershell";

fn list_projects(dir: &std::path::Path) -> Vec<String> {
    let mut projects: Vec<String> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| crate::protocol::valid_project_name(name))
        .collect();
    projects.sort();
    projects
}

fn shell_command(command: &str) -> Command {
    let mut cmd = Command::new(SHELL);
    #[cfg(unix)]
    cmd.arg("-c");
    #[cfg(windows)]
    cmd.args(["-NoProfile", "-NonInteractive", "-Command"]);
    cmd.arg(command);
    cmd
}

fn scrub_env(cmd: &mut Command) {
    cmd.env_clear();
    for key in PASSTHROUGH_ENV {
        if let Some(value) = std::env::var_os(key) {
            cmd.env(key, value);
        }
    }
}

/// Kills cargo and everything it started (like the bot from `cargo run`).
async fn kill_tree(child: &mut Child) {
    #[cfg(unix)]
    if let Some(pid) = child.id() {
        // SAFETY: plain syscall on the process group we created with process_group(0).
        unsafe {
            libc::killpg(pid as libc::pid_t, libc::SIGKILL);
        }
    }
    let _ = child.kill().await;
}

async fn read_lines(stream: impl AsyncRead + Unpin, tx: mpsc::UnboundedSender<String>) {
    let mut lines = BufReader::new(stream).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(line).is_err() {
            break;
        }
    }
}

async fn forward_output(
    mut lines: mpsc::UnboundedReceiver<String>,
    events: mpsc::UnboundedSender<RunnerEvent>,
    job_id: String,
    redactor: Redactor,
    max_bytes: usize,
) {
    let mut sent = 0usize;
    let mut seq = 0u64;
    let mut truncated = false;
    while let Some(line) = lines.recv().await {
        if truncated {
            continue;
        }
        let text = redactor.scrub(&line);
        sent += text.len() + 1;
        let text = if sent > max_bytes {
            truncated = true;
            "[output truncated]".to_owned()
        } else {
            text
        };
        let _ = events.send(RunnerEvent::Output(Output {
            job_id: job_id.clone(),
            seq,
            text,
        }));
        seq += 1;
    }
}
