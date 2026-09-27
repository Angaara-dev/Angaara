# angaara-runner

Build and run your bot projects on a machine of your choice (your PC, a VPS, a Raspberry Pi) while controlling everything from Angaara's Developer Tools.

Everything goes through an end-to-end encrypted Matrix room between you and the runner, so it works behind firewalls and home Wi-Fi with no open ports, domains or certificates.

## Setup

1. Make a Matrix account for the runner (separate from your own and from your bots).
2. Get its token in Angaara: Home > Developer Tools > Get Bot Token.
3. On the runner machine, install Rust from https://rustup.rs, then

```sh
cd bot-sdk
ANGAARA_HOMESERVER=https://matrix.org \
ANGAARA_USER_ID=@my-runner:matrix.org \
ANGAARA_DEVICE_ID=RUNNERDEVICE \
ANGAARA_TOKEN=... \
ANGAARA_RUNNER_OWNER=@you:matrix.org \
cargo run --release -p angaara-runner
```

4. In Angaara, add the runner in Developer Tools. Angaara creates a private encrypted room and invites it.

| Variable                                | Meaning                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ANGAARA_RUNNER_OWNER`                  | The only account allowed to use this runner (required)                                                   |
| `ANGAARA_RUNNER_DIR`                    | Where projects and runner state live (default `runner-data`)                                             |
| `ANGAARA_RUNNER_RUN_TIMEOUT_MINUTES`    | Max time for `run` jobs (default 60, builds are capped at 20)                                            |
| `ANGAARA_RUNNER_ALLOW_UNSIGNED_DEVICES` | Set to `1` to accept devices you never verified (this is not recommended)                                |
| `ANGAARA_RUNNER_ALLOW_SHELL`            | Set to `1` to allow any shell command from Angaara (off by default)                                      |
| `ANGAARA_RUNNER_TUNNEL`                 | Starts `code tunnel` with this name next to the runner, so Angaara's Open in VS Code works from anywhere |

## Security

A runner compiles and runs code, which is remote code execution by design. So the rules are strict:

- **Owner only.** Invites from anyone else are declined. Requests from anyone else are ignored silently.
- **Encrypted only.** Unencrypted requests are rejected. Project files travel as an encrypted upload that only the runner can decrypt. Note that the runner's state folder holds the runner's encryption keys, so if you lose it - you'll have to pair it up again.
- **Trusted devices only.** A request must come from a device cross-signed by the owner. A stolen password alone (a new, unverified login) can't drive the runner. If the owner's identity changes, the runner refuses until re-paired.
- **Private room only.** The room must be encrypted, invite-only, and contain only you and the runner.
- **Replay protection.** Requests older than 5 minutes and duplicates are ignored.
- **Fixed commands.** Only `cargo check`, `build`, `test` and `run` in the project folder, unless you turn on the shell.
- **Safe unpacking.** Project uploads are validated before anything touches disk: no `../` paths, no absolute paths, no symlinks, no writing into `target/` or `.git/`, and size limits against zip bombs.
- **Clean environment.** Cargo gets only basic variables like `PATH` and `HOME`. Note that the runner's own token is not passed on. `cargo run` and `cargo test` also get the project's own `.env`.
- **No leaks in output.** The runner's token and every value from the project's `.env` are replaced with `[redacted]` before output is sent.
- **Limits.** One job at a time, timeouts, output capped at 4 MB, and stop pretty much kills the whole process tree.
- **Private files.** Note that runner state (its session and encryption keys) is stored with owner-only permissions.

**Note:** The code you build runs as the runner's OS user. A malicious dependency or `build.rs` in _your_ project could read that user's files, including the runner's state. Run the runner as a dedicated OS user (or in a container or VM) that has nothing else on it to ensure security.

## Shell and VS Code

With `ANGAARA_RUNNER_ALLOW_SHELL=1`, the Runner panel in Angaara gets a shell prompt and quick tools like `cargo fmt` and `cargo clippy`. Commands run in the project folder (`sh` on Linux and macOS, PowerShell on Windows) with the same owner-only, trusted-device, one-job-at-a-time, timeout and redaction rules as builds. They have no keyboard input, so interactive programs like vim won't work.

The shell can do anything the runner's OS user can, so the dedicated OS user from the note above matters even more here.

The Runner panel can also open the project in VS Code:

- **Same computer:** Open in VS Code.
- **Over SSH:** Open over SSH, with the Remote - SSH extension.
- **Anywhere else:** run `code tunnel --name my-runner` on the runner machine once, then Open Tunnel in Angaara.
- **Automatically:** set `ANGAARA_RUNNER_TUNNEL=my-runner` (and `ANGAARA_RUNNER_CODE` if the `code` CLI isn't on your PATH). The runner starts the tunnel with itself, and Angaara shows a one-click Open in VS Code. Sign the CLI in once with `code tunnel user login`.

After editing in VS Code, turn off "Upload from Angaara" so builds use the runner's files instead of replacing them.

## Development

```sh
cargo test -p angaara-runner   # unit tests, cargo jobs, and a fake homeserver test
```
