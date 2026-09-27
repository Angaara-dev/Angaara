//! angaara-runner: pair it with your Angaara account, then build and run bots on this machine from Angaara.

#[tokio::main]
async fn main() -> angaara_bot::Result<()> {
    tracing_subscriber::fmt::init();
    angaara_runner::service::run(angaara_runner::service::config_from_env()?).await
}
