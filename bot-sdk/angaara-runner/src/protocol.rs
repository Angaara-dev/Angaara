//! Wire format between Angaara and the runner. Everything travels as encrypted room messages.

use serde::{Deserialize, Serialize};

/// `msgtype` of a job request message sent by Angaara.
pub const REQUEST_MSGTYPE: &str = "io.angaara.runner.request";
pub const REQUEST_KEY: &str = "io.angaara.runner.request";
pub const STATUS_KEY: &str = "io.angaara.runner.status";
pub const OUTPUT_KEY: &str = "io.angaara.runner.output";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Ping,
    Check,
    Build,
    Test,
    Run,
    Stop,
    /// Only replaces the runner's copy of the project with the uploaded files.
    Save,
    /// Sends the runner's copy of the project back, as an encrypted zip.
    Pull,
    /// Any shell command in the project folder. Only works when the runner opts in.
    Shell,
}

impl Action {
    /// The cargo subcommand for actions that run cargo. Nothing else is ever executed.
    pub fn cargo_subcommand(self) -> Option<&'static str> {
        match self {
            Action::Check => Some("check"),
            Action::Build => Some("build"),
            Action::Test => Some("test"),
            Action::Run => Some("run"),
            Action::Ping | Action::Stop | Action::Save | Action::Pull | Action::Shell => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Request {
    pub job_id: String,
    pub action: Action,
    #[serde(default)]
    pub project: Option<String>,
    /// Encrypted zip of the project, as a Matrix `EncryptedFile` object.
    #[serde(default)]
    pub bundle: Option<serde_json::Value>,
    /// The command line for `shell` jobs.
    #[serde(default)]
    pub command: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Online,
    Running,
    Succeeded,
    Failed,
    Stopped,
    Rejected,
}

#[derive(Debug, Clone, Serialize)]
pub struct Status {
    pub job_id: String,
    pub state: State,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<Box<RunnerInfo>>,
    /// The project zip for `pull`, as a Matrix `EncryptedFile` object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundle: Option<serde_json::Value>,
}

impl Status {
    pub fn new(job_id: &str, state: State) -> Self {
        Self {
            job_id: job_id.to_owned(),
            state,
            exit_code: None,
            reason: None,
            info: None,
            bundle: None,
        }
    }

    pub fn rejected(job_id: &str, reason: impl Into<String>) -> Self {
        Self {
            reason: Some(reason.into()),
            ..Self::new(job_id, State::Rejected)
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RunnerInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cargo: Option<String>,
    pub shell: bool,
    /// Absolute path of the projects folder, so Angaara can open it in VS Code.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projects_dir: Option<String>,
    /// VS Code tunnel the runner started, so Angaara can open the project through it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tunnel: Option<String>,
    /// A job is running right now, so a reloaded page still knows to offer Stop.
    pub busy: bool,
    /// Projects stored on the runner, so Angaara can open one.
    pub projects: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Output {
    pub job_id: String,
    pub seq: u64,
    pub text: String,
}

/// Job IDs end up in file-free places only, but keep them boring anyway.
pub fn valid_job_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Project names become directory names, so only allow a safe subset.
pub fn valid_project_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit())
        && name.len() <= 64
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_request() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "job_id": "abc-1", "action": "build", "project": "my-bot"
        }))
        .unwrap();
        assert_eq!(req.action, Action::Build);
        assert_eq!(req.action.cargo_subcommand(), Some("build"));
    }

    #[test]
    fn rejects_unknown_actions() {
        let req = serde_json::from_value::<Request>(serde_json::json!({
            "job_id": "a", "action": "format_disk"
        }));
        assert!(req.is_err());
    }

    #[test]
    fn project_names_are_safe() {
        assert!(valid_project_name("my-bot"));
        assert!(!valid_project_name("../etc"));
        assert!(!valid_project_name(".hidden"));
        assert!(!valid_project_name("My-Bot"));
        assert!(!valid_project_name(""));
        assert!(!valid_project_name("a/b"));
    }

    #[test]
    fn job_ids_are_safe() {
        assert!(valid_job_id("job_123-abc"));
        assert!(!valid_job_id("job 1"));
        assert!(!valid_job_id(&"a".repeat(65)));
    }
}
