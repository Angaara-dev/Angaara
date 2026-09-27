use serde_json::{json, Map, Value};

use crate::embed::{escape_html, Embed};

/// Custom content key Angaara reads to render embeds.
pub const EMBED_KEY: &str = "io.angaara.embed";

/// What a bot can send: text, an embed, or both. Build it from `&str`, `String` or `Embed`.
#[derive(Debug, Clone, Default)]
pub struct Content {
    pub text: Option<String>,
    pub embed: Option<Embed>,
    pub notice: bool,
}

impl Content {
    pub fn text(text: impl Into<String>) -> Self {
        Self {
            text: Some(text.into()),
            ..Self::default()
        }
    }

    pub fn embed(embed: Embed) -> Self {
        Self {
            embed: Some(embed),
            ..Self::default()
        }
    }

    pub fn with_embed(mut self, embed: Embed) -> Self {
        self.embed = Some(embed);
        self
    }

    /// Sends as `m.notice`, the Matrix convention for bot output that other bots should ignore.
    pub fn as_notice(mut self) -> Self {
        self.notice = true;
        self
    }

    pub(crate) fn body(&self) -> String {
        let parts: Vec<String> = [
            self.text.clone(),
            self.embed.as_ref().map(Embed::fallback_text),
        ]
        .into_iter()
        .flatten()
        .filter(|s| !s.is_empty())
        .collect();
        parts.join("\n\n")
    }

    pub(crate) fn to_json(&self) -> Map<String, Value> {
        let mut content = Map::new();
        let msgtype = if self.notice { "m.notice" } else { "m.text" };
        content.insert("msgtype".into(), json!(msgtype));
        content.insert("body".into(), json!(self.body()));

        if let Some(embed) = &self.embed {
            let mut html = String::new();
            if let Some(text) = &self.text {
                html.push_str(&format!("<p>{}</p>", escape_html(text)));
            }
            html.push_str(&embed.fallback_html());
            content.insert("format".into(), json!("org.matrix.custom.html"));
            content.insert("formatted_body".into(), json!(html));
            content.insert(EMBED_KEY.into(), json!(embed));
        }
        content
    }
}

impl From<&str> for Content {
    fn from(text: &str) -> Self {
        Content::text(text)
    }
}

impl From<String> for Content {
    fn from(text: String) -> Self {
        Content::text(text)
    }
}

impl From<&String> for Content {
    fn from(text: &String) -> Self {
        Content::text(text.clone())
    }
}

impl From<Embed> for Content {
    fn from(embed: Embed) -> Self {
        Content::embed(embed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text() {
        let json = Content::from("hi").to_json();
        assert_eq!(json["msgtype"], "m.text");
        assert_eq!(json["body"], "hi");
        assert!(json.get(EMBED_KEY).is_none());
    }

    #[test]
    fn embed_has_fallbacks() {
        let json = Content::from(Embed::new().title("Hi")).to_json();
        assert_eq!(json["body"], "Hi");
        assert_eq!(json["formatted_body"], "<b>Hi</b>");
        assert_eq!(json[EMBED_KEY]["title"], "Hi");
    }
}
