// Bot docs as data: rendered on the Developer Tools page and exported as Markdown for LLMs.
export type DocBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; lang: string; code: string; file?: string };

export type DocSection = { id: string; title: string; blocks: DocBlock[] };

// The starter download ships the SDK source in angaara-bot/, so no registry or GitHub access is needed.
export const ANGAARA_BOT_DEPENDENCY = 'angaara-bot = { path = "angaara-bot" }';

export const CARGO_TOML = `[package]
name = "my-bot"
version = "0.1.0"
edition = "2021"

[dependencies]
${ANGAARA_BOT_DEPENDENCY}
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
rand = "0.9"`;

export const MAIN_RS = `use angaara_bot::prelude::*;
use rand::Rng;

#[tokio::main]
async fn main() -> Result<()> {
    let env = |k: &str| std::env::var(k).map_err(|_| Error::other(format!("{k} is not set")));

    AngaaraBot::builder()
        .homeserver(env("ANGAARA_HOMESERVER")?)
        .access_token(env("ANGAARA_USER_ID")?, env("ANGAARA_DEVICE_ID")?, env("ANGAARA_TOKEN")?)
        .command(
            Command::new("ping")
                .description("Check the bot is alive")
                .run(|ctx| async move {
                    ctx.reply("pong").await?;
                    Ok(())
                }),
        )
        .command(
            Command::new("roll")
                .description("Roll a dice")
                .arg(Arg::int("sides").description("How many sides"))
                .run(|ctx| async move {
                    let sides = ctx.args.int("sides").unwrap_or(6).clamp(2, 1000);
                    let n = rand::rng().random_range(1..=sides);
                    let sent = ctx
                        .reply(Embed::new().title("Rolled").description(n.to_string()).color("#ff6b3d"))
                        .await?;
                    sent.react("🔁").await?;
                    Ok(())
                }),
        )
        .on_message(|_ctx, msg| async move {
            if msg.content().eq_ignore_ascii_case("hi bot") {
                msg.reply(format!("hey {}", msg.author_name().await)).await?;
            }
            Ok(())
        })
        .on_reaction(|_ctx, reaction| async move {
            if reaction.emoji() == "🔁" {
                let message = reaction.message().await?;
                if message.from_me() {
                    message.edit("Rolled again!").await?;
                }
            }
            Ok(())
        })
        .on_ready(|ctx| async move {
            println!("Bot is online as {}", ctx.user_id());
            Ok(())
        })
        .run()
        .await
}`;

export const ENV_FILE = `ANGAARA_HOMESERVER=https://matrix.org
ANGAARA_USER_ID=@yourbot:matrix.org
ANGAARA_DEVICE_ID=YOURDEVICEID
ANGAARA_TOKEN=paste-your-token-here`;

export const GITIGNORE = `target/
bot-data/
.env`;

export const DOCKERFILE = `FROM rust:1.96 AS build
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/my-bot /usr/local/bin/my-bot
# bot-data holds the session and encryption keys; mount it as a volume so it survives restarts.
VOLUME /app/bot-data
CMD ["my-bot"]`;

// Loads .env into the current shell, then runs the bot (like `dotnet run`).
export const RUN_BASH = `cd my-bot
set -a; source .env; set +a
cargo run`;

export const RUN_POWERSHELL = `cd my-bot
Get-Content .env | ForEach-Object { if ($_ -match '^\\s*([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2] } }
cargo run`;

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'run',
    title: 'Run script in shell',
    blocks: [
      {
        kind: 'text',
        text: 'This is the cargo version of dotnet run. Open a terminal in the folder that holds my-bot, then paste the one that matches your shell. It loads .env and starts the bot. Stop it with Ctrl+C.',
      },
      { kind: 'code', lang: 'sh', file: 'Linux / macOS terminal', code: RUN_BASH },
      {
        kind: 'code',
        lang: 'powershell',
        file: 'VS Code terminal on Windows (PowerShell, the default)',
        code: RUN_POWERSHELL,
      },
      { kind: 'code', lang: 'sh', file: 'Git Bash', code: RUN_BASH },
      {
        kind: 'text',
        text: 'VS Code on Linux or macOS uses bash or zsh, so use the Linux / macOS one there. Open the terminal with Ctrl+` (backtick).',
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI code review',
    blocks: [
      {
        kind: 'text',
        text: 'Build Tools has an AI Review chat next to the editor (the editor is Monaco, the one inside VS Code). It sees your whole project and the angaara-bot SDK, so you can ask it to review a file, find bugs or explain an error. Click AI Review > Key and fill in ai-settings.json:',
      },
      {
        kind: 'code',
        lang: 'json',
        file: 'ai-settings.json',
        code: `{
  "provider": "anthropic",
  "model": "claude-opus-5",
  "anthropicKey": "sk-ant-...",
  "openaiKey": ""
}`,
      },
      {
        kind: 'list',
        items: [
          'anthropicKey comes from console.anthropic.com and openaiKey from platform.openai.com. You only need the one you use.',
          'Pick Claude or OpenAI and the model in the chat header. Choose Custom... to type any other model ID, like a new release.',
          'Your files are sent with prompt caching: the SDK and your project are cached, so follow-up questions reuse them at a fraction of the cost. The chat shows how many tokens came from the cache.',
          'Your key goes straight from your browser to that provider. It stays in memory unless you tick "Remember on this device".',
          '.env files are never sent, so your bot token stays private.',
          'GitHub Copilot has no public API for other apps. To use Copilot, open the project in VS Code from the Runner panel.',
          'Full Screen gives the editor and chat the whole window. Esc exits.',
        ],
      },
    ],
  },
  {
    id: 'intro',
    title: 'What is angaara-bot?',
    blocks: [
      {
        kind: 'text',
        text: 'angaara-bot is a Rust framework for Matrix bots, inspired by discord.js. A Matrix bot is just a normal Matrix account that a program logs into. Bots work in every Matrix app; Angaara additionally renders their embeds and lists their commands.',
      },
      {
        kind: 'list',
        items: [
          'Encrypted rooms work out of the box (built on the official matrix-sdk).',
          'No bot approval process, no intents, no verification. Make an account and go.',
          'You host your bot yourself, on any machine that can run a Rust binary.',
        ],
      },
    ],
  },
  {
    id: 'setup',
    title: 'Setup in 5 steps',
    blocks: [
      {
        kind: 'list',
        items: [
          'Install Rust 1.96 or newer from https://rustup.rs',
          'Create a Matrix account for your bot (e.g. on matrix.org), like any normal account. Use a different account from your own.',
          'In Angaara: Settings > Developer Tools > turn on Developer Mode, then open Home > Developer Tools.',
          'Use "Get Bot Token" with the bot account to get its User ID, Device ID and token.',
          'Download the starter project (Developer Tools > Starter Project), fill in .env, then run it (see Run script in shell).',
        ],
      },
    ],
  },
  {
    id: 'template',
    title: 'Starter template',
    blocks: [
      {
        kind: 'text',
        text: 'The downloadable starter project contains these files plus the angaara-bot SDK source in angaara-bot/.',
      },
      { kind: 'code', lang: 'toml', file: 'Cargo.toml', code: CARGO_TOML },
      { kind: 'code', lang: 'rust', file: 'src/main.rs', code: MAIN_RS },
      { kind: 'code', lang: 'sh', file: '.env', code: ENV_FILE },
      { kind: 'code', lang: 'gitignore', file: '.gitignore', code: GITIGNORE },
      {
        kind: 'text',
        text: 'Load the .env and run. See Run script in shell at the top for the command for your terminal.',
      },
      {
        kind: 'text',
        text: 'Then invite the bot to a room (Developer Tools > Invite Bot) and type !ping.',
      },
    ],
  },
  {
    id: 'commands',
    title: 'Commands',
    blocks: [
      {
        kind: 'text',
        text: 'Commands start with the prefix (default "!"). Arguments are typed and checked for you; if someone gets them wrong, the bot replies with a usage hint automatically.',
      },
      {
        kind: 'code',
        lang: 'rust',
        code: `Command::new("poll")
    .description("Start a poll")
    .arg(Arg::text("tag"))                  // one word, or "quoted words"
    .arg(Arg::int("minutes").optional())    // optional args come last
    .arg(Arg::rest("question"))             // everything left over
    .run(|ctx| async move {
        let question = ctx.args.str("question").unwrap_or_default();
        let minutes = ctx.args.int("minutes").unwrap_or(5);
        ctx.reply(format!("Poll: {question} ({minutes} min)")).await?;
        Ok(())
    })`,
      },
      {
        kind: 'list',
        items: [
          'Arg types: Arg::text, Arg::int, Arg::number, Arg::bool, Arg::user (a Matrix ID like @me:matrix.org), Arg::rest.',
          'Read them with ctx.args.str / int / number / bool / user("name"), which return Option.',
          'Change the prefix with .prefix("?") on the builder.',
          'The command list is published to each room so Angaara can show it (needs permission to send room state, usually moderator).',
        ],
      },
    ],
  },
  {
    id: 'messages',
    title: 'Messages: reply, react, edit, delete',
    blocks: [
      {
        kind: 'text',
        text: 'Command handlers get a CommandContext, which works like the message that triggered it. on_message handlers get the Message directly.',
      },
      {
        kind: 'code',
        lang: 'rust',
        code: `let text = msg.content();          // the text
let sender = msg.author();         // sender's Matrix ID
let name = msg.author_name().await; // sender's display name
let mine = msg.from_me();          // did the bot send it?

msg.reply("hi").await?;        // reply (pings the author), returns the sent Message
msg.send("hi").await?;         // same room, no quote
msg.react("🔥").await?;        // add a reaction
msg.edit("fixed").await?;      // only the bot's own messages
msg.delete(Some("spam")).await?; // needs moderator power for others' messages
msg.typing(true).await?;       // "bot is typing..."`,
      },
    ],
  },
  {
    id: 'reactions',
    title: 'Reactions (react to the bot)',
    blocks: [
      {
        kind: 'code',
        lang: 'rust',
        code: `.on_reaction(|_ctx, reaction| async move {
    let emoji = reaction.emoji();      // e.g. "👍"
    let who = reaction.user();         // who reacted
    let message = reaction.message().await?; // the message they reacted to
    if message.from_me() && reaction.emoji() == "✅" {
        message.edit("Confirmed!").await?;
    }
    reaction.remove().await?;          // remove it (own reactions, or with moderator power)
    Ok(())
})`,
      },
    ],
  },
  {
    id: 'embeds',
    title: 'Embeds',
    blocks: [
      {
        kind: 'text',
        text: 'Embeds are rich cards. Other Matrix apps show a plain-text version automatically.',
      },
      {
        kind: 'code',
        lang: 'rust',
        code: `let embed = Embed::new()
    .title("Server stats")
    .description("All systems go")
    .url("https://example.com")
    .color("#ff6b3d")
    .field("Uptime", "3 days")
    .inline_field("Users", "42")
    .footer("Updated just now");

ctx.reply(embed).await?;
ctx.reply(Content::text("Here you go:").with_embed(Embed::new().title("Card"))).await?;`,
      },
    ],
  },
  {
    id: 'threads-dms',
    title: 'Threads, DMs and sending anywhere',
    blocks: [
      {
        kind: 'code',
        lang: 'rust',
        code: `msg.reply_in_thread("Let's discuss here").await?; // replies to a thread stay in it automatically
ctx.bot.dm(msg.author(), "psst").await?;           // DM (creates the room if needed)
ctx.bot.send(msg.room_id(), "hello room").await?;  // send to any joined room
let me = ctx.bot.user_id();                        // the bot's own ID
let client = ctx.bot.client();                     // full matrix-sdk client for anything else`,
      },
      {
        kind: 'text',
        text: 'In on_message and on_reaction handlers, the first argument is the same Context (ctx.bot in commands).',
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Good to know',
    blocks: [
      {
        kind: 'list',
        items: [
          'The bot joins rooms it is invited to. Turn off with .auto_join(false).',
          'Old messages are skipped on startup; the bot only answers new ones.',
          'Messages sent as notices (Content::text("..").as_notice()) are ignored by other bots, which prevents bot loops.',
          'bot-data/ holds the session and encryption keys. Keep it private, back it up, and do not delete it, or encrypted rooms break.',
          'Handlers return Result; errors are logged and the bot keeps running. Use Error::other("message") for your own errors.',
          'Public homeservers like matrix.org rate-limit busy bots. For big bots, run your own homeserver.',
        ],
      },
    ],
  },
  {
    id: 'hosting',
    title: 'Hosting',
    blocks: [
      {
        kind: 'text',
        text: 'Run cargo build --release and keep the binary running on any VPS, home server, Raspberry Pi, Railway, Fly and so on. Hosting costs are yours. Docker example:',
      },
      { kind: 'code', lang: 'dockerfile', file: 'Dockerfile', code: DOCKERFILE },
    ],
  },
];

export const docsToMarkdown = (sections: DocSection[]): string => {
  const out: string[] = [
    '# angaara-bot documentation',
    'Rust framework for Matrix bots (Angaara). Use only the APIs shown here.',
  ];
  sections.forEach((section) => {
    out.push(`## ${section.title}`);
    section.blocks.forEach((block) => {
      if (block.kind === 'text') out.push(block.text);
      if (block.kind === 'list') out.push(block.items.map((item) => `- ${item}`).join('\n'));
      if (block.kind === 'code') {
        const heading = block.file ? `**${block.file}**\n` : '';
        out.push(`${heading}\`\`\`${block.lang}\n${block.code}\n\`\`\``);
      }
    });
  });
  return out.join('\n\n');
};
