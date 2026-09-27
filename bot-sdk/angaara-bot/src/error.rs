use thiserror::Error;

/// Everything that can go wrong inside a bot.
#[derive(Debug, Error)]
pub enum Error {
    #[error("matrix error: {0}")]
    Matrix(#[from] matrix_sdk::Error),

    #[error("http error: {0}")]
    Http(#[from] matrix_sdk::HttpError),

    #[error("login failed: {0}")]
    Login(String),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

impl Error {
    pub fn other(message: impl Into<String>) -> Self {
        Self::Other(message.into())
    }
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
