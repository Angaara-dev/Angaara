//! Example bot. Run with:
//! ANGAARA_HOMESERVER=https://matrix.org ANGAARA_USER=mybot ANGAARA_PASSWORD=... cargo run --example dice

use angaara_bot::prelude::*;
use rand::Rng;

fn roll_dice(sides: i64, count: i64) -> Vec<i64> {
    let mut rng = rand::rng();
    (0..count).map(|_| rng.random_range(1..=sides)).collect()
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let env = |key: &str| std::env::var(key).map_err(|_| Error::other(format!("{key} is not set")));

    AngaaraBot::builder()
        .homeserver(env("ANGAARA_HOMESERVER")?)
        .login(env("ANGAARA_USER")?, env("ANGAARA_PASSWORD")?)
        .device_name("Dice Bot")
        .command(
            Command::new("roll")
                .description("Roll some dice")
                .arg(Arg::int("sides").description("How many sides"))
                .arg(
                    Arg::int("count")
                        .optional()
                        .description("How many dice, default 1"),
                )
                .run(|ctx| async move {
                    let sides = ctx.args.int("sides").unwrap_or(6).clamp(2, 1000);
                    let count = ctx.args.int("count").unwrap_or(1).clamp(1, 20);
                    let rolls = roll_dice(sides, count);
                    let total: i64 = rolls.iter().sum();

                    let embed = Embed::new()
                        .title("Dice roll")
                        .color("#ff6b3d")
                        .inline_field("Rolls", format!("{rolls:?}"))
                        .inline_field("Total", total.to_string())
                        .footer("React 🔁 to roll again");
                    let sent = ctx.reply(embed).await?;
                    sent.react("🔁").await?;
                    Ok(())
                }),
        )
        .command(
            Command::new("poll")
                .description("Start a quick yes/no poll")
                .arg(Arg::rest("question"))
                .run(|ctx| async move {
                    let question = ctx.args.str("question").unwrap_or_default().to_owned();
                    let poll = ctx
                        .send(Embed::new().title(format!("Poll: {question}")))
                        .await?;
                    poll.react("👍").await?;
                    poll.react("👎").await?;
                    poll.reply_in_thread("Discuss here").await?;
                    Ok(())
                }),
        )
        .on_message(|_ctx, msg| async move {
            if msg.content().eq_ignore_ascii_case("hi bot") {
                let name = msg.author_name().await;
                msg.reply(format!("hey {name}")).await?;
                msg.react("🔥").await?;
            }
            Ok(())
        })
        .on_reaction(|_ctx, reaction| async move {
            // Someone reacted with the reroll emoji to one of our dice rolls: roll again and edit it in place.
            if reaction.emoji() != "🔁" {
                return Ok(());
            }
            let message = reaction.message().await?;
            let Some(old) = message.embed().filter(|_| message.from_me()) else {
                return Ok(());
            };
            let rolls = roll_dice(6, 1);
            let rerolled = old
                .footer(format!("Rerolled by {}: {rolls:?}", reaction.user()))
                .color("#22c55e");
            message.edit(rerolled).await
        })
        .on_ready(|ctx| async move {
            println!("Dice bot ready as {}", ctx.user_id());
            Ok(())
        })
        .run()
        .await
}
