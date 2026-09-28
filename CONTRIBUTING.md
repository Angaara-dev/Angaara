# Contributing to Angaara

❤️ Thank you for considering contributing to Angaara!

## Reporting bugs and requesting features

Before opening an issue:

- Search existing issues to check it hasn't already been reported.
- For security problems, **don't open an issue**. See [SECURITY.md](SECURITY.md) instead.

When opening an issue, include:

- **Bugs:** what happened, what you expected, steps to reproduce, and your browser/device. Screenshots help a lot.
- **Features:** what you'd like, and the problem it solves for you.

Keep issues to one topic each, and be kind. Everyone here is volunteering their time.

## Pull requests

1. For anything bigger than a small fix, **open an issue first** so we can agree on the approach before you put time in.
2. Fork the repo and branch off `angaara`.
3. Keep PRs focused: one fix or feature per PR.
4. Before submitting, run:
   ```sh
   npm ci
   npm run lint
   npm run build
   ```
5. Describe what changed and why, and link the issue it fixes. For UI changes, add screenshots.
6. Be ready for review feedback. We might ask for changes before merging.

### Getting started

```sh
npm ci      # install
npm start   # dev server
```

The Node version is pinned in `.node-version`.

## AI / LLM usage policy

We understand that AI can speed up research, coding and development, and we're glad you've decided to contribute. Using AI to contribute is fine, as long as you:

- **Disclose it.** Say in your PR which parts were written with AI help.
- **Review it.** Read and test everything before submitting. Don't send code you haven't checked yourself.
- **Understand it.** You should be able to explain any part of your code when asked.

PRs that don't meet these standards may be closed by the maintainers.

## License

Angaara is licensed under **AGPL-3.0-only**. By contributing, you agree your contributions are released under the same license.

Angaara is a fork of [Cinny](https://github.com/cinnyapp/cinny). Please don't send Angaara changes to the Cinny repo. Bugs that also affect Cinny can be reported to them directly, following their own contributing rules.
