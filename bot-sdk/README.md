# angaara-bot

A friendly Rust framework for [Matrix](https://matrix.org) bots, inspired by discord.js and poise. Bots work in every Matrix client; [Angaara](../README.md) also renders their embeds and shows their commands in the `/` menu.

Built on the official [`matrix-sdk`](https://crates.io/crates/matrix-sdk), so end-to-end encrypted rooms just work.

## Quick start

```rust
use angaara_bot::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    AngaaraBot::builder()
        .homeserver("https://matrix.org")
        .login("mybot", "password") // only used on first run
        .command(
            Command::new("roll")
                .description("Roll a dice")
                .arg(Arg::int("sides"))
                .run(|ctx| async move {
                    let n = 4; // chosen by fair dice roll
                    let sent = ctx.reply(Embed::new().title("Rolled").description(n.to_string())).await?;
                    sent.react("🔁").await?;
                    Ok(())
                }),
        )
        .on_message(|_ctx, msg| async move {
            if msg.content() == "hi bot" {
                msg.reply("hey").await?;
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
        .run()
        .await
}
```

Try the full example bot:

```sh
ANGAARA_HOMESERVER=https://matrix.org ANGAARA_USER=mybot ANGAARA_PASSWORD=... cargo run --example dice
```

## What you get

| Feature                  | API                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Commands with typed args | `Command::new("roll").arg(Arg::int("sides"))`, bad input gets an automatic usage reply |
| Reply (pings author)     | `msg.reply("hi")`                                                                      |
| React                    | `msg.react("🔥")`                                                                      |
| React to the bot         | `.on_reaction(...)`, `reaction.message().await?`                                       |
| Edit / delete            | `msg.edit(...)`, `msg.delete(None)`                                                    |
| Threads                  | `msg.reply_in_thread(...)`, replies stay in the thread automatically                   |
| Embeds                   | `Embed::new().title(..).field(..)`, with a text fallback for other clients             |
| DMs                      | `ctx.dm(user_id, "psst")`                                                              |
| Typing indicator         | `msg.typing(true)`                                                                     |
| Escape hatch             | `ctx.client()` gives you the full `matrix-sdk` client                                  |

## How it works

- **Login:** use `.access_token(user_id, device_id, token)` with a token from Angaara's **Developer Tools** page (Home, shown when Developer Mode is on), or `.login(username, password)`.
- **Sessions:** the first run logs in and saves `bot-data/session.json`. Later runs reuse the same device, which keeps encryption keys stable. Keep `bot-data/` private and don't delete it.
- **Invites:** the bot joins rooms it's invited to (turn off with `.auto_join(false)`).
- **Backlog:** old messages are skipped at startup, so the bot only answers new ones.
- **Bots ignore bots:** messages sent as `m.notice` (the Matrix convention for bot output) don't trigger handlers.
- **Hosting:** it's a normal binary. Run it on any VPS, Railway, Fly and so on. You pay for your own bot's hosting.

## Angaara conventions

These are custom fields; other clients ignore them and show the fallback.

- `io.angaara.embed` in a message's content: an embed (title, description, color, fields, footer, url). `body` and `formatted_body` always carry a readable fallback.
- `io.angaara.bot.commands` room state event, keyed by the bot's user ID: `{ "prefix": "!", "commands": [{ "name", "description", "args": [{ "name", "type", "required" }] }] }`. Published automatically when the bot has permission to send state in a room.

## Development

```sh
cargo test     # unit tests + end-to-end tests against a fake homeserver
cargo clippy --all-targets
```

## License

AGPL-3.0-only, same as Angaara.
