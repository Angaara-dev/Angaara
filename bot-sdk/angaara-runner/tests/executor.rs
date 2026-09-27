//! Runs real cargo jobs through the executor and checks what comes out.

use std::{io::Write, time::Duration};

use angaara_runner::{
    job::{Executor, JobConfig, RunnerEvent},
    protocol::{Action, State},
};
use tokio::sync::mpsc;

fn project_zip(main_rs: &str) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut out);
    let opts =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let files = [
        (
            "Cargo.toml",
            "[package]\nname = \"demo\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[workspace]\n",
        ),
        ("src/main.rs", main_rs),
        (".env", "BOT_TOKEN=syt_projectsecret123\n"),
    ];
    for (name, body) in files {
        zip.start_file(name, opts).unwrap();
        zip.write_all(body.as_bytes()).unwrap();
    }
    zip.finish().unwrap();
    out.into_inner()
}

async fn collect_until_done(
    rx: &mut mpsc::UnboundedReceiver<RunnerEvent>,
    job_id: &str,
) -> (Vec<String>, State) {
    let mut lines = Vec::new();
    loop {
        let event = tokio::time::timeout(Duration::from_secs(300), rx.recv())
            .await
            .expect("job took too long")
            .expect("channel closed");
        match event {
            RunnerEvent::Output(o) if o.job_id == job_id => lines.push(o.text),
            RunnerEvent::Status(s) if s.job_id == job_id && s.state != State::Running => {
                return (lines, s.state)
            }
            _ => {}
        }
    }
}

#[tokio::test]
async fn runs_projects_with_secrets_scrubbed_and_host_env_hidden() {
    let workdir = tempfile::tempdir().unwrap();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let executor = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig::default(),
        tx,
        vec!["syt_runnersecret456".to_owned()],
    );
    // Simulate the runner's own credentials being in its environment.
    std::env::set_var("ANGAARA_TOKEN", "syt_runnersecret456");

    let main_rs = r#"fn main() {
    println!("hello from the bot");
    println!("project token: {}", std::env::var("BOT_TOKEN").unwrap_or_default());
    println!("runner token visible: {}", std::env::var("ANGAARA_TOKEN").is_ok());
}"#;
    tokio::spawn(executor.clone().run(
        "job1".into(),
        Action::Run,
        "demo".into(),
        Some(project_zip(main_rs)),
    ));
    let (lines, state) = collect_until_done(&mut rx, "job1").await;
    let all = lines.join("\n");

    assert_eq!(state, State::Succeeded, "{all}");
    assert!(all.contains("hello from the bot"));
    assert!(all.contains("project token: [redacted]"), "{all}");
    assert!(!all.contains("syt_projectsecret123"));
    assert!(all.contains("runner token visible: false"), "{all}");
}

#[tokio::test]
async fn stop_kills_the_program_and_busy_runner_rejects_new_jobs() {
    let workdir = tempfile::tempdir().unwrap();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let executor = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig::default(),
        tx,
        vec![],
    );

    let main_rs = r#"fn main() {
    println!("started");
    loop { std::thread::sleep(std::time::Duration::from_millis(100)); }
}"#;
    tokio::spawn(executor.clone().run(
        "long".into(),
        Action::Run,
        "demo".into(),
        Some(project_zip(main_rs)),
    ));

    // Wait until the program is actually running.
    loop {
        match tokio::time::timeout(Duration::from_secs(300), rx.recv())
            .await
            .unwrap()
            .unwrap()
        {
            RunnerEvent::Output(o) if o.text == "started" => break,
            _ => {}
        }
    }

    executor
        .clone()
        .run("second".into(), Action::Build, "demo".into(), None)
        .await;
    let busy = loop {
        if let RunnerEvent::Status(s) = rx.recv().await.unwrap() {
            if s.job_id == "second" {
                break s;
            }
        }
    };
    assert_eq!(busy.state, State::Rejected);

    assert_eq!(executor.stop().as_deref(), Some("long"));
    let (_, state) = collect_until_done(&mut rx, "long").await;
    assert_eq!(state, State::Stopped);
}

#[tokio::test]
async fn unsafe_bundles_fail_cleanly() {
    let workdir = tempfile::tempdir().unwrap();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let executor = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig::default(),
        tx,
        vec![],
    );

    let mut out = std::io::Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut out);
    zip.start_file("../../escape.txt", zip::write::SimpleFileOptions::default())
        .unwrap();
    zip.write_all(b"nope").unwrap();
    zip.finish().unwrap();

    tokio::spawn(executor.run(
        "evil".into(),
        Action::Build,
        "demo".into(),
        Some(out.into_inner()),
    ));
    let (_, state) = collect_until_done(&mut rx, "evil").await;
    assert_eq!(state, State::Failed);
    assert!(!workdir.path().join("escape.txt").exists());
    assert!(!workdir.path().parent().unwrap().join("escape.txt").exists());
}

#[cfg(unix)]
#[tokio::test]
async fn shell_is_opt_in_and_keeps_secrets_hidden() {
    let workdir = tempfile::tempdir().unwrap();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let locked = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig::default(),
        tx.clone(),
        vec![],
    );
    tokio::spawn(locked.run_shell("off".into(), "demo".into(), "echo hi".into()));
    let (_, state) = collect_until_done(&mut rx, "off").await;
    assert_eq!(state, State::Rejected);

    let executor = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig {
            allow_shell: true,
            ..JobConfig::default()
        },
        tx,
        vec!["syt_runnersecret789".to_owned()],
    );
    std::env::set_var("ANGAARA_RUNNER_TEST_SECRET", "syt_runnersecret789");
    let project = workdir.path().join("projects/demo");
    std::fs::create_dir_all(&project).unwrap();
    std::fs::write(project.join(".env"), "BOT_TOKEN=syt_projectsecret123\n").unwrap();

    let command = "pwd; echo \"bot=$BOT_TOKEN\"; echo \"leak=${ANGAARA_RUNNER_TEST_SECRET:-none}\"; echo syt_runnersecret789; exit 3";
    tokio::spawn(executor.run_shell("sh1".into(), "demo".into(), command.into()));
    let (lines, state) = collect_until_done(&mut rx, "sh1").await;
    let all = lines.join("\n");

    assert_eq!(state, State::Failed, "{all}");
    assert!(all.contains("projects/demo"), "{all}");
    assert!(all.contains("bot=[redacted]"), "{all}");
    assert!(all.contains("leak=none"), "{all}");
    assert!(!all.contains("syt_"), "{all}");
}

#[tokio::test]
async fn save_writes_files_without_building() {
    let workdir = tempfile::tempdir().unwrap();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let executor = Executor::new(
        workdir.path().to_path_buf(),
        JobConfig::default(),
        tx,
        vec![],
    );

    executor
        .clone()
        .save(
            "s1".into(),
            "demo".into(),
            Some(project_zip("fn main() {}")),
        )
        .await;
    let (lines, state) = collect_until_done(&mut rx, "s1").await;
    assert_eq!(state, State::Succeeded);
    assert!(lines.is_empty());
    let project = workdir.path().join("projects/demo");
    assert!(project.join("src/main.rs").is_file());
    assert!(!project.join("target").exists(), "save must not build");

    executor.save("s2".into(), "demo".into(), None).await;
    let (_, state) = collect_until_done(&mut rx, "s2").await;
    assert_eq!(state, State::Rejected);
}
