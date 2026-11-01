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

## Published release and installation

This fork has a published [v2.1.0 GitHub Release](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.1.0).
For **full TypeScript source**, use the GitHub tag's Source code archive.
The separately attached `claude-code-canary-2.1.0.tgz` is an installable
package containing built JavaScript, not full source. npm registry publishing
and a floating `@v2` GitHub Action tag are **not** enabled for this fork.

Use the exact `spk-c/claude-cody-canary@v2.1.0` Action tag.
See [distribution and consumer verification](docs/DISTRIBUTION.md).

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

## Optional live authenticated Claude Code E2E

The manual [Live Claude Code E2E workflow](.github/workflows/live-claude-e2e.yml)
installs the actual Claude Code CLI and exercises a disposable Git scenario via
`scripts/live-e2e.mjs`. It requires the `ANTHROPIC_API_KEY` GitHub Actions
repository secret, and intentionally does not run on pull requests.
Without that credential, **a real provider-backed test is not verified**. The workflow
accepts manual runs only from `main` and exposes the API key solely to the
model-backed E2E step. The disposable fixture refuses to delete unowned folders,
rejects symlinks and limits per-scenario model spending.

The default CI independently tests real MCP stdio transport without paid APIs.

## Credits

The original Claude Code Canary project is attributed to SLP-DEV1, MIT License
(see [LICENSE](LICENSE)). This repository's security changes and CI:
[spk-c/claude-cody-canary](https://github.com/spk-c/claude-cody-canary).

## Current release status

The source build and real Claude CLI/MCP smoke pass in CI; this is not the
same as a successful paid-model `full` E2E run. See
[optional Live E2E](docs/LIVE_E2E.md) and
[release process](docs/RELEASING.md).

CodeQL, Dependabot and full-dependency `npm audit` workflows are included.
The manually triggered GitHub Release workflow uses build, test, source-drift
and dependency-audit checks. It does **not** require branch protection or
authenticated model-backed E2E. No npm publication is enabled.
