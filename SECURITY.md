# Security Policy

## Supported versions

Only the latest version gets security fixes. That's the `angaara` branch, which is what runs on https://angaara.app. Older builds and self-hosted copies should update to the latest `angaara`.

## Reporting a vulnerability

**Please don't open a public issue, discussion or PR for security problems.**

Report privately instead:
- GitHub: **Security** tab → **Report a vulnerability**
- Email: `security@angaara.app`

Please include:
- What the issue is and what an attacker could do with it
- Steps to reproduce, or a proof of concept
- Affected area (web app, the Worker `/api/*` endpoints, or `bot-sdk`)
- Your Matrix ID or GitHub username if you'd like credit

## What to expect

- We'll reply within **7 days** to confirm we got it.
- We'll keep you updated while we fix it, and aim to ship a fix within **30 days** for serious issues.
- Once it's fixed, we'll credit you in the release notes unless you'd rather stay anonymous.

## Scope

**In scope**
- The Angaara web client (this repo)
- The Cloudflare Worker (`worker/`): GitHub sign-in, XP, perks and the bot DM endpoints
- The bot SDK (`bot-sdk/`)

**Out of scope, please report these to the right place**
- Matrix homeservers such as matrix.org -> the homeserver's operator ([matrix.org security disclosure](https://matrix.org/security-disclosure-policy/))
- Bugs that also exist in upstream Cinny -> [cinnyapp/cinny](https://github.com/cinnyapp/cinny)
- matrix-js-sdk, Element Call and other dependencies -> their own projects
- Spam, social engineering, or denial of service by flooding

## Safe harbor

We won't take action against good-faith research that:
- Only uses accounts you own or have permission to test
- Doesn't access, change or delete other people's data
- Doesn't disrupt the service for others
- Gives us reasonable time to fix things before going public

Thanks for helping keep Angaara safe 🔥
