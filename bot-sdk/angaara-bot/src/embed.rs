use serde::{Deserialize, Serialize};

/// A rich card. Angaara renders it natively; other clients get the text fallback.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Embed {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub fields: Vec<EmbedField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbedField {
    pub name: String,
    pub value: String,
    #[serde(default)]
    pub inline: bool,
}

impl Embed {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn url(mut self, url: impl Into<String>) -> Self {
        self.url = Some(url.into());
        self
    }

    /// Accent color as a hex string, e.g. `"#ff6b3d"`.
    pub fn color(mut self, color: impl Into<String>) -> Self {
        self.color = Some(color.into());
        self
    }

    pub fn field(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.fields.push(EmbedField {
            name: name.into(),
            value: value.into(),
            inline: false,
        });
        self
    }

    pub fn inline_field(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.fields.push(EmbedField {
            name: name.into(),
            value: value.into(),
            inline: true,
        });
        self
    }

    pub fn footer(mut self, footer: impl Into<String>) -> Self {
        self.footer = Some(footer.into());
        self
    }

    /// Plain-text version for clients that don't know about embeds.
    pub fn fallback_text(&self) -> String {
        let mut lines = Vec::new();
        if let Some(title) = &self.title {
            lines.push(title.clone());
        }
        if let Some(description) = &self.description {
            lines.push(description.clone());
        }
        for field in &self.fields {
            lines.push(format!("{}: {}", field.name, field.value));
        }
        if let Some(footer) = &self.footer {
            lines.push(footer.clone());
        }
        // Plain text can't hold a link, so the URL goes on its own line.
        if let Some(url) = &self.url {
            lines.push(url.clone());
        }
        lines.join("\n")
    }

    /// HTML version for clients that render `formatted_body`.
    pub fn fallback_html(&self) -> String {
        let mut html = String::new();
        if let Some(title) = &self.title {
            let title = escape_html(title);
            match &self.url {
                Some(url) => html.push_str(&format!(
                    "<b><a href=\"{}\">{title}</a></b>",
                    escape_html(url)
                )),
                None => html.push_str(&format!("<b>{title}</b>")),
            }
        } else if let Some(url) = &self.url {
            // No title to hang the link on, so show it as is.
            let url = escape_html(url);
            html.push_str(&format!("<a href=\"{url}\">{url}</a>"));
        }
        if let Some(description) = &self.description {
            html.push_str(&format!("<p>{}</p>", escape_html(description)));
        }
        for field in &self.fields {
            html.push_str(&format!(
                "<b>{}</b>: {}<br>",
                escape_html(&field.name),
                escape_html(&field.value)
            ));
        }
        if let Some(footer) = &self.footer {
            html.push_str(&format!("<sub>{}</sub>", escape_html(footer)));
        }
        html
    }
}

pub(crate) fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_includes_everything() {
        let embed = Embed::new()
            .title("Dice")
            .description("You rolled 4")
            .field("Sides", "6");
        assert_eq!(embed.fallback_text(), "Dice\nYou rolled 4\nSides: 6");
    }

    #[test]
    fn html_is_escaped() {
        let embed = Embed::new().title("<script>");
        assert_eq!(embed.fallback_html(), "<b>&lt;script&gt;</b>");
    }

    #[test]
    fn url_survives_fallbacks() {
        let linked = Embed::new().title("Docs").url("https://example.org");
        assert_eq!(linked.fallback_text(), "Docs\nhttps://example.org");
        let bare = Embed::new().url("https://example.org");
        assert_eq!(
            bare.fallback_html(),
            "<a href=\"https://example.org\">https://example.org</a>"
        );
    }
}
