use std::{collections::HashMap, future::Future, path::PathBuf, sync::Arc, time::Duration};

use matrix_sdk::ruma::api::error::ErrorKind;
use matrix_sdk::{
    authentication::{matrix::MatrixSession, SessionTokens},
    config::SyncSettings,
    deserialized_responses::RawAnySyncOrStrippedState,
    event_handler::{Ctx, RawEvent},
    ruma::events::{
        reaction::OriginalSyncReactionEvent,
        room::{
            member::StrippedRoomMemberEvent,
            message::{MessageType, OriginalSyncRoomMessageEvent, Relation},
        },
        StateEventType,
    },
    Client, Room, RoomState, SessionMeta,
};
use serde_json::Value;
use tracing::{debug, info, warn};

use crate::{
    command::{BoxFuture, Command, CommandContext, CommandInfo, CommandManifest},
    context::{thread_root_of, Context},
    error::{Error, Result},
    message::Message,
    reaction::Reaction,
};

/// State event Angaara reads to show a bot's commands in the `/` menu.
pub const COMMANDS_STATE_KEY: &str = "io.angaara.bot.commands";

type MessageHandler = Arc<dyn Fn(Context, Message) -> BoxFuture + Send + Sync>;
type ReactionHandler = Arc<dyn Fn(Context, Reaction) -> BoxFuture + Send + Sync>;
type ReadyHandler = Arc<dyn Fn(Context) -> BoxFuture + Send + Sync>;

/// Entry point: `AngaaraBot::builder()...run().await`.
pub struct AngaaraBot;

impl AngaaraBot {
    pub fn builder() -> BotBuilder {
        BotBuilder::default()
    }
}

pub struct BotBuilder {
    homeserver: Option<String>,
    username: Option<String>,
    password: Option<String>,
    token: Option<(String, String, String)>,
    store_path: PathBuf,
    device_name: String,
    prefix: String,
    auto_join: bool,
    invite_allowlist: Option<Vec<String>>,
    commands: Vec<Command>,
    on_message: Vec<MessageHandler>,
    on_reaction: Vec<ReactionHandler>,
    on_ready: Vec<ReadyHandler>,
}

impl Default for BotBuilder {
    fn default() -> Self {
        Self {
            homeserver: None,
            username: None,
            password: None,
            token: None,
            store_path: PathBuf::from("bot-data"),
            device_name: "Angaara Bot".into(),
            prefix: "!".into(),
            auto_join: true,
            invite_allowlist: None,
            commands: Vec::new(),
            on_message: Vec::new(),
            on_reaction: Vec::new(),
            on_ready: Vec::new(),
        }
    }
}

impl BotBuilder {
    pub fn homeserver(mut self, url: impl Into<String>) -> Self {
        self.homeserver = Some(url.into());
        self
    }

    /// Only used on first run; after that the saved session is reused (keeps E2EE keys stable).
    pub fn login(mut self, username: impl Into<String>, password: impl Into<String>) -> Self {
        self.username = Some(username.into());
        self.password = Some(password.into());
        self
    }

    /// Log in with an existing access token, e.g. from Angaara's Developer Tools.
    pub fn access_token(
        mut self,
        user_id: impl Into<String>,
        device_id: impl Into<String>,
        token: impl Into<String>,
    ) -> Self {
        self.token = Some((user_id.into(), device_id.into(), token.into()));
        self
    }

    /// Where the session and encryption database live. Keep it private and persistent.
    pub fn store_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.store_path = path.into();
        self
    }

    pub fn device_name(mut self, name: impl Into<String>) -> Self {
        self.device_name = name.into();
        self
    }

    pub fn prefix(mut self, prefix: impl Into<String>) -> Self {
        self.prefix = prefix.into();
        self
    }

    /// Accept room invites automatically (default: on).
    /// Only accept invites from these users and decline everyone else's. Use for private bots.
    pub fn accept_invites_from(mut self, user_id: impl Into<String>) -> Self {
        self.invite_allowlist
            .get_or_insert_with(Vec::new)
            .push(user_id.into());
        self
    }

    pub fn auto_join(mut self, auto_join: bool) -> Self {
        self.auto_join = auto_join;
        self
    }

    pub fn command(mut self, command: Command) -> Self {
        self.commands.push(command);
        self
    }

    /// Runs for every text message from someone else, commands included.
    pub fn on_message<F, Fut>(mut self, handler: F) -> Self
    where
        F: Fn(Context, Message) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        self.on_message
            .push(Arc::new(move |ctx, msg| Box::pin(handler(ctx, msg))));
        self
    }

    /// Runs when someone else reacts to any message the bot can see.
    pub fn on_reaction<F, Fut>(mut self, handler: F) -> Self
    where
        F: Fn(Context, Reaction) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        self.on_reaction.push(Arc::new(move |ctx, reaction| {
            Box::pin(handler(ctx, reaction))
        }));
        self
    }

    /// Runs once after login and the first sync.
    pub fn on_ready<F, Fut>(mut self, handler: F) -> Self
    where
        F: Fn(Context) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        self.on_ready
            .push(Arc::new(move |ctx| Box::pin(handler(ctx))));
        self
    }

    /// Logs in, then syncs forever.
    pub async fn run(self) -> Result<()> {
        init_logging();
        let homeserver = self
            .homeserver
            .clone()
            .ok_or_else(|| Error::other("homeserver not set"))?;
        std::fs::create_dir_all(&self.store_path)?;
        restrict_permissions(&self.store_path, 0o700)?;
        self.drop_stale_session()?;

        let client = Client::builder()
            .homeserver_url(&homeserver)
            .sqlite_store(self.store_path.join("db"), None)
            .build()
            .await
            .map_err(|e| Error::other(format!("could not build client: {e}")))?;
        self.login_or_restore(&client).await?;
        if let Err(e) = client.whoami().await {
            if e.client_api_error_kind().is_some_and(|k| {
                matches!(k, ErrorKind::UnknownToken { .. } | ErrorKind::MissingToken)
            }) {
                // Forget the rejected login and its keys so a corrected token starts clean.
                let _ = std::fs::remove_file(self.store_path.join("session.json"));
                let _ = std::fs::remove_dir_all(self.store_path.join("db"));
                return Err(Error::Login(
                    "the homeserver rejected the access token; check the user id, device id and token".into(),
                ));
            }
            warn!("could not check the login: {e}");
        }
        let ctx = Context::new(client.clone());
        info!("logged in as {}", ctx.user_id());

        info!("syncing, the first run can take a minute");
        // Skip the backlog so the bot doesn't answer old messages on startup.
        let response = client.sync_once(SyncSettings::default()).await?;

        let shared = Arc::new(Shared::from_builder(&self));
        client.add_event_handler_context(shared.clone());
        client.add_event_handler(on_room_message);
        client.add_event_handler(on_room_reaction);
        if self.auto_join {
            client.add_event_handler(on_invite);
        }

        for room in client.joined_rooms() {
            publish_commands(&room, &shared).await;
        }
        for handler in &self.on_ready {
            if let Err(e) = handler(ctx.clone()).await {
                warn!("on_ready handler failed: {e}");
            }
        }

        let mut settings = SyncSettings::default().token(response.next_batch);
        loop {
            // Network blips shouldn't kill the bot; a dead token still should.
            match client.sync(settings).await {
                Ok(()) => return Ok(()),
                Err(e) if is_auth_error(&e) => return Err(e.into()),
                Err(e) => warn!("sync failed, retrying in 5s: {e}"),
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
            settings = SyncSettings::default();
        }
    }

    /// A new token in the config wins over the saved session. A different account or device
    /// also gets a fresh store, since the old encryption keys belong to the old device.
    fn drop_stale_session(&self) -> Result<()> {
        let session_file = self.store_path.join("session.json");
        let (Some((user_id, device_id, token)), Ok(saved)) =
            (&self.token, std::fs::read_to_string(&session_file))
        else {
            return Ok(());
        };
        let Ok(saved) = serde_json::from_str::<MatrixSession>(&saved) else {
            return Ok(());
        };
        let same_device =
            saved.meta.user_id.as_str() == user_id && saved.meta.device_id.as_str() == device_id;
        if same_device && &saved.tokens.access_token == token {
            return Ok(());
        }
        warn!("access token changed, replacing the saved session");
        std::fs::remove_file(&session_file)?;
        if !same_device {
            let db = self.store_path.join("db");
            if db.exists() {
                std::fs::remove_dir_all(db)?;
            }
        }
        Ok(())
    }

    async fn login_or_restore(&self, client: &Client) -> Result<()> {
        let session_file = self.store_path.join("session.json");
        if session_file.exists() {
            let session: MatrixSession =
                serde_json::from_str(&std::fs::read_to_string(&session_file)?)?;
            client.restore_session(session).await?;
            return Ok(());
        }

        if let Some((user_id, device_id, token)) = &self.token {
            let user_id = user_id
                .as_str()
                .try_into()
                .map_err(|_| Error::Login(format!("invalid user id {user_id}")))?;
            let session = MatrixSession {
                meta: SessionMeta {
                    user_id,
                    device_id: device_id.as_str().into(),
                },
                tokens: SessionTokens {
                    access_token: token.clone(),
                    refresh_token: None,
                },
            };
            client.restore_session(session.clone()).await?;
            write_private(&session_file, &serde_json::to_string(&session)?)?;
            return Ok(());
        }

        let (Some(username), Some(password)) = (&self.username, &self.password) else {
            return Err(Error::Login(
                "no saved session; call .access_token(..) or .login(username, password)".into(),
            ));
        };
        client
            .matrix_auth()
            .login_username(username, password)
            .initial_device_display_name(&self.device_name)
            .await
            .map_err(|e| Error::Login(e.to_string()))?;
        let session = client
            .matrix_auth()
            .session()
            .ok_or_else(|| Error::Login("no session".into()))?;
        write_private(&session_file, &serde_json::to_string(&session)?)?;
        Ok(())
    }
}

struct Shared {
    prefix: String,
    invite_allowlist: Option<Vec<String>>,
    commands: HashMap<String, Command>,
    manifest: CommandManifest,
    on_message: Vec<MessageHandler>,
    on_reaction: Vec<ReactionHandler>,
}

impl Shared {
    fn from_builder(builder: &BotBuilder) -> Self {
        let manifest = CommandManifest {
            prefix: builder.prefix.clone(),
            commands: builder
                .commands
                .iter()
                .map(|c| CommandInfo {
                    name: c.name.clone(),
                    description: c.description.clone(),
                    args: c.args.clone(),
                })
                .collect(),
        };
        Self {
            prefix: builder.prefix.clone(),
            invite_allowlist: builder.invite_allowlist.clone(),
            commands: builder
                .commands
                .iter()
                .map(|c| (c.name.clone(), c.clone()))
                .collect(),
            manifest,
            on_message: builder.on_message.clone(),
            on_reaction: builder.on_reaction.clone(),
        }
    }
}

pub(crate) fn build_message(
    ctx: &Context,
    room: &Room,
    event: &OriginalSyncRoomMessageEvent,
    content: Value,
) -> Message {
    let thread_root = content.as_object().and_then(thread_root_of);
    Message {
        ctx: ctx.clone(),
        room: room.clone(),
        event_id: event.event_id.clone(),
        sender: event.sender.clone(),
        body: event.content.body().to_owned(),
        thread_root,
        content,
    }
}

async fn on_room_message(
    event: OriginalSyncRoomMessageEvent,
    room: Room,
    raw: RawEvent,
    client: Client,
    Ctx(shared): Ctx<Arc<Shared>>,
) {
    if room.state() != RoomState::Joined || Some(event.sender.as_ref()) == client.user_id() {
        return;
    }
    // Skip edits and m.notice, which by convention is other bots' output.
    if matches!(event.content.relates_to, Some(Relation::Replacement(_)))
        || matches!(event.content.msgtype, MessageType::Notice(_))
    {
        return;
    }

    let content = serde_json::from_str::<Value>(raw.0.get())
        .ok()
        .and_then(|v| v.get("content").cloned())
        .unwrap_or_default();
    let ctx = Context::new(client);
    let message = build_message(&ctx, &room, &event, content);

    if let Some(input) = message.content().strip_prefix(shared.prefix.as_str()) {
        run_command(&ctx, &shared, &message, input).await;
    }
    for handler in &shared.on_message {
        if let Err(e) = handler(ctx.clone(), message.clone()).await {
            warn!("on_message handler failed: {e}");
        }
    }
}

async fn run_command(ctx: &Context, shared: &Shared, message: &Message, input: &str) {
    let (name, rest) = input.split_once(char::is_whitespace).unwrap_or((input, ""));
    let Some(command) = shared.commands.get(&name.to_lowercase()) else {
        return;
    };
    let Some(handler) = command.handler.clone() else {
        return;
    };

    let Some(args) = command.parse_args(rest) else {
        let usage = format!("Usage: {}", command.usage(&shared.prefix));
        if let Err(e) = message.reply(crate::Content::text(usage).as_notice()).await {
            warn!("could not send usage for {name}: {e}");
        }
        return;
    };

    let command_ctx = CommandContext {
        bot: ctx.clone(),
        message: message.clone(),
        args,
    };
    if let Err(e) = handler(command_ctx).await {
        warn!("command {name} failed: {e}");
    }
}

async fn on_room_reaction(
    event: OriginalSyncReactionEvent,
    room: Room,
    client: Client,
    Ctx(shared): Ctx<Arc<Shared>>,
) {
    if room.state() != RoomState::Joined || Some(event.sender.as_ref()) == client.user_id() {
        return;
    }
    let reaction = Reaction {
        ctx: Context::new(client.clone()),
        room: room.clone(),
        event_id: event.event_id.clone(),
        sender: event.sender.clone(),
        emoji: event.content.relates_to.key.clone(),
        target_id: event.content.relates_to.event_id.clone(),
    };
    for handler in &shared.on_reaction {
        if let Err(e) = handler(Context::new(client.clone()), reaction.clone()).await {
            warn!("on_reaction handler failed: {e}");
        }
    }
}

async fn on_invite(
    event: StrippedRoomMemberEvent,
    room: Room,
    client: Client,
    Ctx(shared): Ctx<Arc<Shared>>,
) {
    if Some(event.state_key.as_ref()) != client.user_id() || room.state() != RoomState::Invited {
        return;
    }
    if let Some(allowed) = &shared.invite_allowlist {
        if !allowed.iter().any(|id| id == event.sender.as_str()) {
            info!(
                "declining invite to {} from {}",
                room.room_id(),
                event.sender
            );
            if let Err(e) = room.leave().await {
                debug!("could not decline invite: {e}");
            }
            return;
        }
    }
    // Joining right after an invite can race the server, so retry with backoff.
    tokio::spawn(async move {
        let mut delay = Duration::from_secs(2);
        for _ in 0..5 {
            match room.join().await {
                Ok(()) => {
                    info!("joined {}", room.room_id());
                    publish_commands(&room, &shared).await;
                    return;
                }
                Err(e) => {
                    debug!("join of {} failed, retrying: {e}", room.room_id());
                    tokio::time::sleep(delay).await;
                    delay *= 2;
                }
            }
        }
        warn!("gave up joining {}", room.room_id());
    });
}

/// Publishes the command list if it changed. Needs permission to send state; skipped quietly if not.
async fn publish_commands(room: &Room, shared: &Shared) {
    if shared.manifest.commands.is_empty() {
        return;
    }
    let Some(user_id) = room.client().user_id().map(ToOwned::to_owned) else {
        return;
    };
    let Ok(wanted) = serde_json::to_value(&shared.manifest) else {
        return;
    };

    let current = room
        .get_state_event(StateEventType::from(COMMANDS_STATE_KEY), user_id.as_str())
        .await
        .ok()
        .flatten()
        .and_then(|raw| match raw {
            RawAnySyncOrStrippedState::Sync(raw) => {
                raw.get_field::<Value>("content").ok().flatten()
            }
            RawAnySyncOrStrippedState::Stripped(_) => None,
        });
    if current.as_ref() == Some(&wanted) {
        return;
    }

    if let Err(e) = room
        .send_state_event_raw(COMMANDS_STATE_KEY, user_id.as_str(), wanted)
        .await
    {
        debug!("could not publish commands in {}: {e}", room.room_id());
    }
}

/// Writes a file only the current user can read (it holds the bot's access token).
fn write_private(path: &std::path::Path, contents: &str) -> Result<()> {
    std::fs::write(path, contents)?;
    restrict_permissions(path, 0o600)
}

#[cfg(unix)]
fn restrict_permissions(path: &std::path::Path, mode: u32) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &std::path::Path, _mode: u32) -> Result<()> {
    Ok(())
}

fn is_auth_error(e: &matrix_sdk::Error) -> bool {
    matches!(
        e.client_api_error_kind(),
        Some(ErrorKind::UnknownToken { .. } | ErrorKind::MissingToken | ErrorKind::Forbidden)
    )
}

/// Prints the bot's own logs to stderr, unless the app set up its own logging.
/// The Matrix library's internal errors are mostly harmless retries, so they stay hidden.
fn init_logging() {
    use tracing_subscriber::{
        filter::{LevelFilter, Targets},
        layer::SubscriberExt,
        util::SubscriberInitExt,
    };
    let filter = Targets::new()
        .with_default(LevelFilter::OFF)
        .with_target("angaara_bot", tracing::Level::INFO);
    let _ = tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(std::io::stderr)
                .with_ansi(false),
        )
        .with(filter)
        .try_init();
}
