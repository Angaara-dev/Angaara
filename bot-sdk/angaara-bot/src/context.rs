use matrix_sdk::{
    ruma::{OwnedEventId, OwnedUserId, RoomId, UserId},
    Client, Room,
};
use serde_json::{json, Map, Value};

use crate::{
    content::Content,
    error::{Error, Result},
    message::Message,
};

/// Cheap-to-clone handle to the bot, passed to every handler.
#[derive(Clone)]
pub struct Context {
    pub(crate) client: Client,
}

impl Context {
    pub(crate) fn new(client: Client) -> Self {
        Self { client }
    }

    /// The underlying matrix-sdk client, for anything this crate doesn't wrap yet.
    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn user_id(&self) -> OwnedUserId {
        self.client.user_id().expect("bot is logged in").to_owned()
    }

    pub fn room(&self, room_id: &RoomId) -> Option<Room> {
        self.client.get_room(room_id)
    }

    /// Sends a message to a room the bot has joined.
    pub async fn send(&self, room_id: &RoomId, content: impl Into<Content>) -> Result<Message> {
        let room = self
            .room(room_id)
            .ok_or_else(|| Error::other(format!("bot is not in room {room_id}")))?;
        self.send_json(&room, content.into().to_json()).await
    }

    /// Sends a direct message, reusing an existing DM room or creating one.
    pub async fn dm(&self, user_id: &UserId, content: impl Into<Content>) -> Result<Message> {
        let room = match self.client.get_dm_room(user_id) {
            Some(room) => room,
            None => self.client.create_dm(user_id).await?,
        };
        self.send_json(&room, content.into().to_json()).await
    }

    pub(crate) async fn send_json(
        &self,
        room: &Room,
        content: Map<String, Value>,
    ) -> Result<Message> {
        let body = content
            .get("body")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let thread_root = thread_root_of(&content);
        let content = Value::Object(content);
        let response = room
            .send_raw("m.room.message", content.clone())
            .await?
            .response;
        Ok(Message {
            ctx: self.clone(),
            room: room.clone(),
            event_id: response.event_id,
            sender: self.user_id(),
            body,
            thread_root,
            content,
        })
    }

    pub(crate) async fn react(
        &self,
        room: &Room,
        event_id: &OwnedEventId,
        emoji: &str,
    ) -> Result<OwnedEventId> {
        let content = json!({
            "m.relates_to": { "rel_type": "m.annotation", "event_id": event_id, "key": emoji }
        });
        Ok(room
            .send_raw("m.reaction", content)
            .await?
            .response
            .event_id)
    }
}

pub(crate) fn thread_root_of(content: &Map<String, Value>) -> Option<OwnedEventId> {
    let relates_to = content.get("m.relates_to")?;
    if relates_to.get("rel_type")?.as_str()? != "m.thread" {
        return None;
    }
    relates_to.get("event_id")?.as_str()?.try_into().ok()
}
