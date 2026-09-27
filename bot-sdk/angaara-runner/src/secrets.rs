//! `.env` parsing for `cargo run`, and scrubbing secrets out of build output.

use std::collections::BTreeMap;

/// Variables a project's `.env` may not override, since they change how programs load.
fn blocked(key: &str) -> bool {
    matches!(key, "PATH" | "HOME" | "CARGO_HOME" | "RUSTUP_HOME")
        || key.starts_with("LD_")
        || key.starts_with("DYLD_")
}

/// Parses simple `KEY=value` lines. Comments, blanks and invalid keys are skipped.
pub fn parse_env(contents: &str) -> BTreeMap<String, String> {
    let mut vars = BTreeMap::new();
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let valid_key = key
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
            && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
        if !valid_key || blocked(key) {
            continue;
        }
        let value = value.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|v| v.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
            .unwrap_or(value);
        vars.insert(key.to_owned(), value.to_owned());
    }
    vars
}

/// Replaces known secret values with `[redacted]` before output leaves the machine.
#[derive(Debug, Clone, Default)]
pub struct Redactor {
    secrets: Vec<String>,
}

impl Redactor {
    pub fn new(secrets: impl IntoIterator<Item = String>) -> Self {
        // Very short values would redact random words, so ignore them.
        let mut secrets: Vec<String> = secrets.into_iter().filter(|s| s.len() >= 6).collect();
        secrets.sort_by_key(|s| std::cmp::Reverse(s.len()));
        secrets.dedup();
        Self { secrets }
    }

    pub fn scrub(&self, text: &str) -> String {
        self.secrets.iter().fold(text.to_owned(), |acc, secret| {
            acc.replace(secret, "[redacted]")
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_env_files() {
        let vars = parse_env(
            "# comment\nANGAARA_TOKEN=\"abc123def\"\nexport NAME='bot'\nBAD KEY=x\nPATH=/evil\nLD_PRELOAD=x.so\n\nEMPTY=\n",
        );
        assert_eq!(vars.get("ANGAARA_TOKEN").unwrap(), "abc123def");
        assert_eq!(vars.get("NAME").unwrap(), "bot");
        assert_eq!(vars.get("EMPTY").unwrap(), "");
        assert!(!vars.contains_key("PATH"));
        assert!(!vars.contains_key("LD_PRELOAD"));
        assert!(!vars.contains_key("BAD KEY"));
    }

    #[test]
    fn scrubs_secrets() {
        let redactor = Redactor::new(["syt_supersecret".to_owned(), "abc".to_owned()]);
        assert_eq!(
            redactor.scrub("token=syt_supersecret abc"),
            "token=[redacted] abc"
        );
    }
}
