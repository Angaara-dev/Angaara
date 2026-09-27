use std::{collections::HashMap, future::Future, ops::Deref, pin::Pin, sync::Arc};

use matrix_sdk::ruma::OwnedUserId;
use serde::Serialize;

use crate::{context::Context, error::Result, message::Message};

pub(crate) type BoxFuture = Pin<Box<dyn Future<Output = Result<()>> + Send>>;
pub(crate) type CommandHandler = Arc<dyn Fn(CommandContext) -> BoxFuture + Send + Sync>;

/// The type of a command argument. Angaara's `/` menu shows these.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ArgKind {
    Text,
    Int,
    Number,
    Bool,
    User,
    /// Everything left in the message, e.g. the question in `!poll is rust cool?`.
    Rest,
}

#[derive(Debug, Clone, Serialize)]
pub struct Arg {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: ArgKind,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl Arg {
    fn new(name: impl Into<String>, kind: ArgKind) -> Self {
        Self {
            name: name.into(),
            kind,
            required: true,
            description: None,
        }
    }

    pub fn text(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::Text)
    }

    pub fn int(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::Int)
    }

    pub fn number(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::Number)
    }

    pub fn bool(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::Bool)
    }

    pub fn user(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::User)
    }

    pub fn rest(name: impl Into<String>) -> Self {
        Self::new(name, ArgKind::Rest)
    }

    pub fn optional(mut self) -> Self {
        self.required = false;
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    fn validate(&self, value: &str) -> bool {
        match self.kind {
            ArgKind::Text | ArgKind::Rest => true,
            ArgKind::Int => value.parse::<i64>().is_ok(),
            ArgKind::Number => value.parse::<f64>().is_ok(),
            ArgKind::Bool => parse_bool(value).is_some(),
            ArgKind::User => OwnedUserId::try_from(value).is_ok(),
        }
    }
}

/// A `!command` the bot responds to.
#[derive(Clone)]
pub struct Command {
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) args: Vec<Arg>,
    pub(crate) handler: Option<CommandHandler>,
}

impl Command {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into().to_lowercase(),
            description: None,
            args: Vec::new(),
            handler: None,
        }
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn arg(mut self, arg: Arg) -> Self {
        self.args.push(arg);
        self
    }

    /// The code that runs when someone uses the command.
    pub fn run<F, Fut>(mut self, handler: F) -> Self
    where
        F: Fn(CommandContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        self.handler = Some(Arc::new(move |ctx| Box::pin(handler(ctx))));
        self
    }

    pub fn usage(&self, prefix: &str) -> String {
        let args: Vec<String> = self
            .args
            .iter()
            .map(|arg| {
                let kind = serde_json::to_value(arg.kind).unwrap_or_default();
                let label = format!("{}:{}", arg.name, kind.as_str().unwrap_or("text"));
                if arg.required {
                    format!("<{label}>")
                } else {
                    format!("[{label}]")
                }
            })
            .collect();
        format!("{prefix}{} {}", self.name, args.join(" "))
            .trim_end()
            .to_owned()
    }

    /// Matches raw argument text against this command's args.
    pub(crate) fn parse_args(&self, input: &str) -> Option<Args> {
        let mut tokens = tokenize(input);
        let mut values = HashMap::new();
        for arg in &self.args {
            let value = if arg.kind == ArgKind::Rest {
                let rest = tokens.join(" ");
                tokens.clear();
                (!rest.is_empty()).then_some(rest)
            } else if tokens.is_empty() {
                None
            } else {
                Some(tokens.remove(0))
            };
            match value {
                Some(value) if arg.validate(&value) => {
                    values.insert(arg.name.clone(), value);
                }
                Some(_) => return None,
                None if arg.required => return None,
                None => {}
            }
        }
        tokens.is_empty().then_some(Args { values })
    }
}

/// Serializable command list published so Angaara can autocomplete it.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct CommandManifest {
    pub prefix: String,
    pub commands: Vec<CommandInfo>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct CommandInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub args: Vec<Arg>,
}

impl PartialEq for Arg {
    fn eq(&self, other: &Self) -> bool {
        self.name == other.name
            && self.kind == other.kind
            && self.required == other.required
            && self.description == other.description
    }
}

/// Parsed, already type-checked command arguments.
#[derive(Debug, Clone, Default)]
pub struct Args {
    values: HashMap<String, String>,
}

impl Args {
    pub fn str(&self, name: &str) -> Option<&str> {
        self.values.get(name).map(String::as_str)
    }

    pub fn int(&self, name: &str) -> Option<i64> {
        self.values.get(name)?.parse().ok()
    }

    pub fn number(&self, name: &str) -> Option<f64> {
        self.values.get(name)?.parse().ok()
    }

    pub fn bool(&self, name: &str) -> Option<bool> {
        parse_bool(self.values.get(name)?)
    }

    pub fn user(&self, name: &str) -> Option<OwnedUserId> {
        OwnedUserId::try_from(self.values.get(name)?.as_str()).ok()
    }
}

/// Everything a command handler gets. Derefs to the triggering [`Message`], so `ctx.reply(..)` works.
#[derive(Clone)]
pub struct CommandContext {
    pub bot: Context,
    pub message: Message,
    pub args: Args,
}

impl Deref for CommandContext {
    type Target = Message;

    fn deref(&self) -> &Message {
        &self.message
    }
}

fn parse_bool(value: &str) -> Option<bool> {
    match value.to_lowercase().as_str() {
        "true" | "yes" | "on" | "1" => Some(true),
        "false" | "no" | "off" | "0" => Some(false),
        _ => None,
    }
}

/// Splits on whitespace, keeping "quoted strings" together.
fn tokenize(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for c in input.chars() {
        match c {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roll() -> Command {
        Command::new("roll")
            .arg(Arg::int("sides"))
            .arg(Arg::int("count").optional())
    }

    #[test]
    fn parses_typed_args() {
        let args = roll().parse_args("20 3").unwrap();
        assert_eq!(args.int("sides"), Some(20));
        assert_eq!(args.int("count"), Some(3));
    }

    #[test]
    fn rejects_bad_types_and_extra_args() {
        assert!(roll().parse_args("twenty").is_none());
        assert!(roll().parse_args("").is_none());
        assert!(roll().parse_args("6 1 9").is_none());
    }

    #[test]
    fn rest_and_quotes() {
        let cmd = Command::new("poll")
            .arg(Arg::text("tag"))
            .arg(Arg::rest("question"));
        let args = cmd.parse_args("\"hot take\" is rust cool?").unwrap();
        assert_eq!(args.str("tag"), Some("hot take"));
        assert_eq!(args.str("question"), Some("is rust cool?"));
    }

    #[test]
    fn usage_string() {
        assert_eq!(roll().usage("!"), "!roll <sides:int> [count:int]");
    }
}
