use matrix_sdk::{
    ruma::{
        events::{room::message::OriginalSyncRoomMessageEvent, AnySyncTimelineEvent},
        serde::Raw,
        OwnedEventId, OwnedUserId, UserId,
    },
    Room,
};

use crate::{
    context::Context,
    error::{Error, Result},
    message::Message,
};

/// Someone reacted to a message with an emoji.
#[derive(Clone)]
pub struct Reaction {
    pub(crate) ctx: Context,
    pub(crate) room: Room,
    pub(crate) event_id: OwnedEventId,
    pub(crate) sender: OwnedUserId,
    pub(crate) emoji: String,
    pub(crate) target_id: OwnedEventId,
}

impl Reaction {
    pub fn emoji(&self) -> &str {
        &self.emoji
    }

    pub fn user(&self) -> &UserId {
        &self.sender
    }

    pub fn room(&self) -> &Room {
        &self.room
    }

    /// ID of the message that was reacted to.
    pub fn message_id(&self) -> &OwnedEventId {
        &self.target_id
    }

    pub fn from_me(&self) -> bool {
        self.sender == self.ctx.user_id()
    }

    /// Fetches the message that was reacted to.
    pub async fn message(&self) -> Result<Message> {
        let event = self.room.event(&self.target_id, None).await?;
        message_from_raw(&self.ctx, &self.room, event.raw())
            .ok_or_else(|| Error::other("reacted-to event is not a text message"))
    }

    /// Removes this reaction. Only works on the bot's own reactions (or with moderator power).
    pub async fn remove(&self) -> Result<()> {
        self.room.redact(&self.event_id, None, None).await?;
        Ok(())
    }
}

pub(crate) fn message_from_raw(
    ctx: &Context,
    room: &Room,
    raw: &Raw<AnySyncTimelineEvent>,
) -> Option<Message> {
    let event: OriginalSyncRoomMessageEvent = serde_json::from_str(raw.json().get()).ok()?;
    let content = raw
        .get_field::<serde_json::Value>("content")
        .ok()
        .flatten()?;
    Some(crate::bot::build_message(ctx, room, &event, content))
}
