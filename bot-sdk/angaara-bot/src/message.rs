use matrix_sdk::{
    ruma::{OwnedEventId, OwnedUserId, RoomId, UserId},
    Room,
};
use serde_json::{json, Value};

use crate::{
    content::{Content, EMBED_KEY},
    context::Context,
    embed::Embed,
    error::{Error, Result},
};

/// A text message in a room, either received or sent by the bot.
#[derive(Clone)]
pub struct Message {
    pub(crate) ctx: Context,
    pub(crate) room: Room,
    pub(crate) event_id: OwnedEventId,
    pub(crate) sender: OwnedUserId,
    pub(crate) body: String,
    pub(crate) thread_root: Option<OwnedEventId>,
    pub(crate) content: Value,
}

impl Message {
    pub fn id(&self) -> &OwnedEventId {
        &self.event_id
    }

    pub fn room(&self) -> &Room {
        &self.room
    }

    pub fn room_id(&self) -> &RoomId {
        self.room.room_id()
    }

    pub fn author(&self) -> &UserId {
        &self.sender
    }

    /// The plain-text body of the message.
    pub fn content(&self) -> &str {
        &self.body
    }

    /// The raw event content, for custom fields this crate doesn't parse.
    pub fn raw_content(&self) -> &Value {
        &self.content
    }

    pub fn from_me(&self) -> bool {
        self.sender == self.ctx.user_id()
    }

    /// Root event of the thread this message is in, if any.
    pub fn thread_root(&self) -> Option<&OwnedEventId> {
        self.thread_root.as_ref()
    }

    pub fn embed(&self) -> Option<Embed> {
        serde_json::from_value(self.content.get(EMBED_KEY)?.clone()).ok()
    }

    /// Display name of the author in this room, falling back to their user ID.
    pub async fn author_name(&self) -> String {
        match self.room.get_member_no_sync(&self.sender).await {
            Ok(Some(member)) => member.name().to_owned(),
            _ => self.sender.to_string(),
        }
    }

    /// Sends a message in the same room (and thread) without quoting this one.
    pub async fn send(&self, content: impl Into<Content>) -> Result<Message> {
        let mut json = content.into().to_json();
        if let Some(root) = &self.thread_root {
            json.insert(
                "m.relates_to".into(),
                json!({ "rel_type": "m.thread", "event_id": root, "is_falling_back": true,
                        "m.in_reply_to": { "event_id": self.event_id } }),
            );
        }
        self.ctx.send_json(&self.room, json).await
    }

    /// Replies to this message, pinging its author. Stays in the thread if there is one.
    pub async fn reply(&self, content: impl Into<Content>) -> Result<Message> {
        let mut json = content.into().to_json();
        let relates_to = match &self.thread_root {
            Some(root) => {
                json!({ "rel_type": "m.thread", "event_id": root, "is_falling_back": false,
                                  "m.in_reply_to": { "event_id": self.event_id } })
            }
            None => json!({ "m.in_reply_to": { "event_id": self.event_id } }),
        };
        json.insert("m.relates_to".into(), relates_to);
        json.insert("m.mentions".into(), json!({ "user_ids": [self.sender] }));
        self.ctx.send_json(&self.room, json).await
    }

    /// Replies in a thread started from this message (or its existing thread).
    pub async fn reply_in_thread(&self, content: impl Into<Content>) -> Result<Message> {
        let root = self
            .thread_root
            .clone()
            .unwrap_or_else(|| self.event_id.clone());
        let mut json = content.into().to_json();
        json.insert(
            "m.relates_to".into(),
            json!({ "rel_type": "m.thread", "event_id": root, "is_falling_back": true,
                    "m.in_reply_to": { "event_id": self.event_id } }),
        );
        self.ctx.send_json(&self.room, json).await
    }

    /// Adds an emoji reaction. Returns the reaction's event ID so it can be removed later.
    pub async fn react(&self, emoji: &str) -> Result<OwnedEventId> {
        self.ctx.react(&self.room, &self.event_id, emoji).await
    }

    /// Edits the message. Only works on the bot's own messages.
    pub async fn edit(&self, content: impl Into<Content>) -> Result<()> {
        if !self.from_me() {
            return Err(Error::other("bots can only edit their own messages"));
        }
        let new_content = content.into().to_json();
        let body = new_content
            .get("body")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let json = json!({
            "msgtype": new_content.get("msgtype").cloned().unwrap_or(json!("m.text")),
            "body": format!("* {body}"),
            "m.new_content": new_content,
            "m.relates_to": { "rel_type": "m.replace", "event_id": self.event_id },
        });
        self.room.send_raw("m.room.message", json).await?;
        Ok(())
    }

    /// Deletes (redacts) the message. Needs moderator power for other people's messages.
    pub async fn delete(&self, reason: Option<&str>) -> Result<()> {
        self.room.redact(&self.event_id, reason, None).await?;
        Ok(())
    }

    /// Shows or hides "bot is typing..." in this room.
    pub async fn typing(&self, typing: bool) -> Result<()> {
        self.room.typing_notice(typing).await?;
        Ok(())
    }
}
