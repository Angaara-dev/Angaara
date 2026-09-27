//! The runner against a fake homeserver: strangers get silence, unencrypted requests get rejected.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use angaara_runner::service::{run, Auth, Config};
use serde_json::{json, Value};
use wiremock::{
    matchers::{method, path, path_regex, query_param},
    Mock, MockServer, ResponseTemplate,
};

const ROOM: &str = "!runner:localhost";

fn request(sender: &str, event_id: &str, job_id: &str) -> Value {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    json!({
        "type": "m.room.message", "event_id": event_id, "sender": sender, "origin_server_ts": now,
        "content": {
            "msgtype": "io.angaara.runner.request", "body": "build",
            "io.angaara.runner.request": { "job_id": job_id, "action": "build", "project": "my-bot" }
        }
    })
}

#[tokio::test]
async fn strangers_get_silence_and_unencrypted_requests_are_rejected() {
    let server = MockServer::start().await;
    let ok = |body: Value| ResponseTemplate::new(200).set_body_json(body);
    Mock::given(method("GET"))
        .and(path("/_matrix/client/versions"))
        .respond_with(ok(json!({ "versions": ["v1.11"] })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/_matrix/client/v3/keys/upload"))
        .respond_with(ok(
            json!({ "one_time_key_counts": { "signed_curve25519": 50 } }),
        ))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/_matrix/client/v3/keys/query"))
        .respond_with(ok(json!({ "device_keys": {} })))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s1"))
        .respond_with(ok(
            json!({ "next_batch": "s2", "rooms": { "join": { ROOM: { "timeline": { "events": [
                request("@mallory:localhost", "$evil", "j-evil"),
                request("@owner:localhost", "$plain", "j-plain"),
            ]}}}}}),
        ))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s2"))
        .respond_with(ok(json!({ "next_batch": "s2" })).set_delay(Duration::from_millis(500)))
        .mount(&server)
        .await;
    Mock::given(method("GET")).and(path("/_matrix/client/v3/sync"))
        .respond_with(ok(json!({ "next_batch": "s1", "rooms": { "join": { ROOM: { "timeline": { "events": [] } } } } })))
        .mount(&server).await;
    Mock::given(method("GET"))
        .and(path_regex(r"/state/m\.room\.encryption"))
        .respond_with(
            ResponseTemplate::new(404)
                .set_body_json(json!({ "errcode": "M_NOT_FOUND", "error": "not found" })),
        )
        .mount(&server)
        .await;
    Mock::given(method("PUT"))
        .and(path_regex(r"/send/"))
        .respond_with(ok(json!({ "event_id": "$sent" })))
        .mount(&server)
        .await;

    let workdir = tempfile::tempdir().unwrap();
    let config = Config {
        homeserver: server.uri(),
        owner: "@owner:localhost".try_into().unwrap(),
        workdir: workdir.path().to_path_buf(),
        allow_unsigned_devices: false,
        run_timeout: Duration::from_secs(60),
        allow_shell: false,
        tunnel: None,
        auth: Auth::Token {
            user_id: "@runner:localhost".into(),
            device_id: "RUNNER".into(),
            token: "syt_runner_token".into(),
        },
    };
    tokio::spawn(run(config));

    for _ in 0..100 {
        let any_sent = server
            .received_requests()
            .await
            .unwrap_or_default()
            .iter()
            .any(|r| r.method.as_str() == "PUT" && r.url.path().contains("/send/"));
        if any_sent {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    // Give a stray reply to the stranger a chance to show up before asserting it didn't.
    tokio::time::sleep(Duration::from_millis(500)).await;
    let sent: Vec<Value> = server
        .received_requests()
        .await
        .unwrap()
        .iter()
        .filter(|r| r.method.as_str() == "PUT" && r.url.path().contains("/send/"))
        .filter_map(|r| serde_json::from_slice(&r.body).ok())
        .collect();

    assert_eq!(sent.len(), 1, "{sent:#?}");
    let status = &sent[0]["io.angaara.runner.status"];
    assert_eq!(status["job_id"], "j-plain");
    assert_eq!(status["state"], "rejected");
    assert_eq!(status["reason"], "requests must be end-to-end encrypted");
    assert!(!serde_json::to_string(&sent)
        .unwrap()
        .contains("syt_runner_token"));
    assert!(
        !workdir.path().join("projects/my-bot").exists(),
        "nothing may touch disk"
    );
}
