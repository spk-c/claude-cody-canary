# Claude Code Canary — source-restored security fork

Claude Code regression testing, MCP contract checking, release comparison, plugin
compatibility testing, and evidence capture.

This fork now includes the TypeScript source, tests, documentation, examples and
GitHub Action from a publicly accessible archive of the original MIT project
(version 2.1.0). The import provenance and safety limitations are documented in
[Source restoration](docs/SOURCE_RESTORATION.md).

**Security:** The permission probe denies rather than auto-approves requests.
Isolated Git worktrees are not OS sandboxes. Never run untrusted scenarios with
production credentials or on unrestricted hosts.

## Develop and test

Node.js 20+ and Git are required.

```sh
git clone https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm ci
npm run check
node dist/v2-cli.js doctor
```

`npm run check` validates TypeScript, runs Vitest, builds all JavaScript output,
then executes security and MCP/CLI integration tests and documentation checks.
The lockfile pins production and development dependencies; CI runs `npm ci`.

## Live authenticated Claude Code E2E

The manual [Live Claude Code E2E workflow](.github/workflows/live-claude-e2e.yml)
installs the actual Claude Code CLI and exercises a disposable Git scenario via
`scripts/live-e2e.mjs`. It requires the `ANTHROPIC_API_KEY` GitHub Actions
repository secret, and intentionally does not run on pull requests.
Without that credential, **a real provider-backed test is not verified**.

The default CI independently tests real MCP stdio transport without paid APIs.

## Credits

The original Claude Code Canary project is attributed to SLP-DEV1, MIT License
(see [LICENSE](LICENSE)). This repository's security changes and CI:
[spk-c/claude-cody-canary](https://github.com/spk-c/claude-cody-canary).
