//! Runs a real bot against a fake homeserver and checks what it sends back.

use std::time::Duration;

use angaara_bot::prelude::*;
use serde_json::{json, Value};
use wiremock::{
    matchers::{method, path, path_regex, query_param},
    Mock, MockServer, Request, ResponseTemplate,
};

const ROOM: &str = "!room:localhost";

fn sync_with_message(body: &str) -> Value {
    json!({
        "next_batch": "s2",
        "rooms": { "join": { ROOM: {
            "timeline": { "limited": false, "events": [{
                "type": "m.room.message",
                "event_id": "$cmd",
                "sender": "@alice:localhost",
                "origin_server_ts": 1,
                "content": { "msgtype": "m.text", "body": body }
            }]},
            "state": { "events": [] }
        }}}
    })
}

async fn fake_homeserver(first_message: &str) -> MockServer {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/versions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "versions": ["v1.11"] })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/_matrix/client/v3/login"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "user_id": "@bot:localhost", "access_token": "token", "device_id": "BOTDEVICE"
        })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/_matrix/client/v3/keys/upload"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "one_time_key_counts": { "signed_curve25519": 50 }
        })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/_matrix/client/v3/keys/query"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "device_keys": {} })))
        .mount(&server)
        .await;
    // First sync joins the room (backlog is skipped); the second delivers the command.
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(sync_with_message(first_message)))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s2"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "next_batch": "s2" }))
                .set_delay(Duration::from_millis(500)),
        )
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "next_batch": "s1",
            "rooms": { "join": { ROOM: { "timeline": { "events": [] }, "state": { "events": [] } } } }
        })))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path_regex(
            r"^/_matrix/client/v3/rooms/.*/state/m\.room\.encryption",
        ))
        .respond_with(
            ResponseTemplate::new(404)
                .set_body_json(json!({ "errcode": "M_NOT_FOUND", "error": "Event not found" })),
        )
        .mount(&server)
        .await;
    Mock::given(method("PUT"))
        .and(path_regex(r"^/_matrix/client/v3/rooms/.*/(send|state)/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "event_id": "$sent" })))
        .mount(&server)
        .await;
    server
}

async fn wait_for_sent(server: &MockServer, event_type: &str) -> Vec<Value> {
    let needle = format!("/send/{event_type}/");
    for _ in 0..100 {
        let sent: Vec<Value> = server
            .received_requests()
            .await
            .unwrap_or_default()
            .iter()
            .filter(|r: &&Request| r.method.as_str() == "PUT" && r.url.path().contains(&needle))
            .filter_map(|r| serde_json::from_slice(&r.body).ok())
            .collect();
        if !sent.is_empty() {
            return sent;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    for r in server.received_requests().await.unwrap_or_default() {
        eprintln!(
            "{} {}?{}",
            r.method,
            r.url.path(),
            r.url.query().unwrap_or("")
        );
    }
    panic!("bot never sent {event_type}");
}

fn start_bot(server: &MockServer, store: &std::path::Path) {
    let _ = tracing_subscriber::fmt().with_test_writer().try_init();
    let bot = AngaaraBot::builder()
        .homeserver(server.uri())
        .login("bot", "password")
        .store_path(store)
        .command(
            Command::new("roll")
                .arg(Arg::int("sides"))
                .run(|ctx| async move {
                    let sides = ctx.args.int("sides").unwrap();
                    let sent = ctx
                        .reply(
                            Embed::new()
                                .title("Rolled")
                                .field("Sides", sides.to_string()),
                        )
                        .await?;
                    sent.react("🔁").await?;
                    Ok(())
                }),
        );
    tokio::spawn(async move {
        if let Err(e) = bot.run().await {
            eprintln!("bot stopped: {e}");
        }
    });
}

#[tokio::test]
async fn command_replies_with_embed_and_reacts() {
    let server = fake_homeserver("!roll 20").await;
    let store = tempfile::tempdir().unwrap();
    start_bot(&server, store.path());

    let replies = wait_for_sent(&server, "m.room.message").await;
    let reply = &replies[0];
    assert_eq!(reply["m.relates_to"]["m.in_reply_to"]["event_id"], "$cmd");
    assert_eq!(reply["m.mentions"]["user_ids"][0], "@alice:localhost");
    assert_eq!(reply["io.angaara.embed"]["title"], "Rolled");
    assert_eq!(reply["io.angaara.embed"]["fields"][0]["value"], "20");
    assert_eq!(reply["body"], "Rolled\nSides: 20");

    let reactions = wait_for_sent(&server, "m.reaction").await;
    assert_eq!(reactions[0]["m.relates_to"]["rel_type"], "m.annotation");
    assert_eq!(reactions[0]["m.relates_to"]["event_id"], "$sent");
    assert_eq!(reactions[0]["m.relates_to"]["key"], "🔁");
}

#[tokio::test]
async fn bad_args_get_a_usage_notice() {
    let server = fake_homeserver("!roll lots").await;
    let store = tempfile::tempdir().unwrap();
    start_bot(&server, store.path());

    let replies = wait_for_sent(&server, "m.room.message").await;
    assert_eq!(replies[0]["msgtype"], "m.notice");
    assert_eq!(replies[0]["body"], "Usage: !roll <sides:int>");
}

#[tokio::test]
async fn reacting_to_the_bot_lets_it_edit_its_message() {
    // Higher-priority mocks swap the command sync for a reaction to one of the bot's messages.
    let reacted = fake_homeserver("unused").await;
    let bot_message = json!({
        "type": "m.room.message", "event_id": "$botmsg", "sender": "@bot:localhost",
        "origin_server_ts": 1, "room_id": ROOM,
        "content": { "msgtype": "m.text", "body": "Rolled", "io.angaara.embed": { "title": "Rolled" } }
    });
    Mock::given(method("GET"))
        .and(path_regex(r"^/_matrix/client/v3/rooms/.*/event/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(bot_message))
        .with_priority(1)
        .mount(&reacted)
        .await;
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "next_batch": "s2",
            "rooms": { "join": { ROOM: { "timeline": { "events": [{
                "type": "m.reaction", "event_id": "$react", "sender": "@alice:localhost",
                "origin_server_ts": 2,
                "content": { "m.relates_to": { "rel_type": "m.annotation", "event_id": "$botmsg", "key": "🔁" } }
            }]}}}}
        })))
        .with_priority(1)
        .mount(&reacted)
        .await;

    let store = tempfile::tempdir().unwrap();
    let _ = tracing_subscriber::fmt().with_test_writer().try_init();
    let bot = AngaaraBot::builder()
        .homeserver(reacted.uri())
        .login("bot", "password")
        .store_path(store.path())
        .on_reaction(|_ctx, reaction| async move {
            let message = reaction.message().await?;
            if reaction.emoji() == "🔁" && message.from_me() {
                let embed = message.embed().unwrap().footer("Rerolled");
                message.edit(embed).await?;
            }
            Ok(())
        });
    tokio::spawn(async move { bot.run().await });

    let sent = wait_for_sent(&reacted, "m.room.message").await;
    let edit = &sent[0];
    assert_eq!(edit["m.relates_to"]["rel_type"], "m.replace");
    assert_eq!(edit["m.relates_to"]["event_id"], "$botmsg");
    assert_eq!(
        edit["m.new_content"]["io.angaara.embed"]["footer"],
        "Rerolled"
    );
    assert_eq!(edit["body"], "* Rolled\nRerolled");
}

#[tokio::test]
async fn token_login_skips_password_login() {
    let server = fake_homeserver("!roll 6").await;
    let store = tempfile::tempdir().unwrap();
    let bot = AngaaraBot::builder()
        .homeserver(server.uri())
        .access_token("@bot:localhost", "TOKENDEVICE", "secret-token")
        .store_path(store.path())
        .command(
            Command::new("roll")
                .arg(Arg::int("sides"))
                .run(|ctx| async move {
                    ctx.reply("rolled").await?;
                    Ok(())
                }),
        );
    tokio::spawn(async move { bot.run().await });

    let replies = wait_for_sent(&server, "m.room.message").await;
    assert_eq!(replies[0]["body"], "rolled");
    let requests = server.received_requests().await.unwrap();
    assert!(requests
        .iter()
        .all(|r| r.url.path() != "/_matrix/client/v3/login"));
    let sync = requests
        .iter()
        .find(|r| r.url.path().ends_with("/sync"))
        .unwrap();
    assert_eq!(
        sync.headers.get("authorization").unwrap().to_str().unwrap(),
        "Bearer secret-token"
    );
    assert!(store.path().join("session.json").exists());
}

#[tokio::test]
async fn private_bot_declines_strangers_and_locks_its_token() {
    let server = fake_homeserver("unused").await;
    let invite = |room: &str, inviter: &str| {
        json!({ room: { "invite_state": { "events": [
            { "type": "m.room.member", "state_key": "@bot:localhost", "sender": inviter,
              "content": { "membership": "invite" } }
        ]}}})
    };
    let mut invites = invite("!stranger:localhost", "@mallory:localhost");
    invites.as_object_mut().unwrap().extend(
        invite("!owner:localhost", "@owner:localhost")
            .as_object()
            .unwrap()
            .clone(),
    );
    Mock::given(method("GET"))
        .and(path("/_matrix/client/v3/sync"))
        .and(query_param("since", "s1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "next_batch": "s2", "rooms": { "invite": invites }
        })))
        .with_priority(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path_regex(
            r"^/_matrix/client/v3/rooms/.*/(leave|join|forget)$",
        ))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({ "room_id": "!x:localhost" })),
        )
        .mount(&server)
        .await;

    let store = tempfile::tempdir().unwrap();
    let bot = AngaaraBot::builder()
        .homeserver(server.uri())
        .login("bot", "password")
        .store_path(store.path())
        .accept_invites_from("@owner:localhost");
    tokio::spawn(async move { bot.run().await });

    let mut paths = Vec::new();
    for _ in 0..100 {
        paths = server
            .received_requests()
            .await
            .unwrap_or_default()
            .iter()
            .filter(|r| r.method.as_str() == "POST")
            .map(|r| r.url.path().to_owned())
            .collect();
        if paths.iter().any(|p| p.contains("leave")) && paths.iter().any(|p| p.ends_with("/join")) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(
        paths
            .iter()
            .any(|p| p.contains("!stranger:localhost/leave")),
        "{paths:?}"
    );
    assert!(
        paths.iter().any(|p| p.ends_with("!owner:localhost/join")),
        "{paths:?}"
    );
    assert!(
        !paths
            .iter()
            .any(|p| p.ends_with("!stranger:localhost/join")),
        "{paths:?}"
    );

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = |p: &std::path::Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&store.path().join("session.json")), 0o600);
        assert_eq!(mode(store.path()), 0o700);
    }
}
