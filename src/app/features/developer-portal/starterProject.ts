import sdkCargoToml from '../../../../bot-sdk/angaara-bot/Cargo.toml?raw';
import { ZipFile } from '../../utils/zip';
import { CARGO_TOML, DOCKERFILE, ENV_FILE, GITIGNORE, MAIN_RS } from './docs';

// SDK sources are inlined at build time, so the download always matches the SDK in this repo.
const sdkSources = import.meta.glob('../../../../bot-sdk/angaara-bot/src/*.rs', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const STARTER_ROOT = 'my-bot';

const README = `# my-bot

A Matrix bot built with angaara-bot.

1. Install Rust 1.96+ from https://rustup.rs
2. Get your bot's token in Angaara: Home > Developer Tools > Get Bot Token
3. Fill in .env
4. Run: cargo run

The angaara-bot/ folder is the SDK itself, so this project builds without any extra downloads besides crates.io.
`;

export const STARTER_FILES: ZipFile[] = [
  { path: `${STARTER_ROOT}/README.md`, content: README },
  { path: `${STARTER_ROOT}/Cargo.toml`, content: `${CARGO_TOML}\n` },
  { path: `${STARTER_ROOT}/src/main.rs`, content: `${MAIN_RS}\n` },
  { path: `${STARTER_ROOT}/.env`, content: `${ENV_FILE}\n` },
  { path: `${STARTER_ROOT}/.gitignore`, content: `${GITIGNORE}\n` },
  { path: `${STARTER_ROOT}/Dockerfile`, content: `${DOCKERFILE}\n` },
  { path: `${STARTER_ROOT}/angaara-bot/Cargo.toml`, content: sdkCargoToml },
  ...Object.entries(sdkSources)
    .map(([file, content]) => ({
      path: `${STARTER_ROOT}/angaara-bot/src/${file.split('/').pop()}`,
      content,
    }))
    .sort((a, b) => a.path.localeCompare(b.path)),
];
