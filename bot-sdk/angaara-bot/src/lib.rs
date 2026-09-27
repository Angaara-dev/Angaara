//! A friendly Matrix bot framework for Angaara, inspired by discord.js and poise.
//! Works with any Matrix client; Angaara additionally renders embeds and the `/` command menu.

mod bot;
mod command;
mod content;
mod context;
mod embed;
mod error;
mod message;
mod reaction;

pub use bot::{AngaaraBot, BotBuilder, COMMANDS_STATE_KEY};
pub use command::{Arg, ArgKind, Args, Command, CommandContext};
pub use content::{Content, EMBED_KEY};
pub use context::Context;
pub use embed::{Embed, EmbedField};
pub use error::{Error, Result};
pub use message::Message;
pub use reaction::Reaction;

/// Re-exported so bots can reach Matrix types without adding matrix-sdk themselves.
pub use matrix_sdk;

pub mod prelude {
    pub use crate::{
        AngaaraBot, Arg, Args, Command, CommandContext, Content, Context, Embed, Error, Message,
        Reaction, Result,
    };
}
