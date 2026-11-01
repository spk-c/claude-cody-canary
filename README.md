# Claude Code Canary — community distribution mirror

Deterministic regression and compatibility testing for Claude Code releases,
MCP servers, plugins, scenarios and CI.

> **Repository status (November 2026):** This fork currently contains the
> **precompiled JavaScript distribution** of Claude Code Canary v2.1.0 and its
> JSON schemas, **not the original TypeScript source tree**. The original
> `src/`, `tsconfig.json`, development tests, docs, lockfile and Marketplace
> `action.yml` were not included in the imported snapshot. The checked-in
> JavaScript is the code maintained here until original sources are restored.
> Do not assume this repository can rebuild the distribution from TypeScript,
> or that it provides a GitHub Marketplace Action.

## Install and verify

Requires Node.js 20+ and Git.

```bash
git clone https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm install --ignore-scripts
npm run check
node dist/v2-cli.js --help
```

This repository is marked `private: true` in npm metadata to prevent
accidentally republishing the upstream package name from this mirror.
For a local `claude-canary` command, use `npm link` after installing.
The CLI depends on an authenticated Claude Code setup for scenarios that
actually invoke Claude; syntax/security regression tests don't invoke Claude.

## Core commands

```bash
claude-canary doctor
claude-canary init
claude-canary validate .canary/basic.canary.yml
claude-canary run .canary/basic.canary.yml
claude-canary compare .canary/basic.canary.yml --from 2.1.220 --to latest
claude-canary mcp-snapshot .canary/mcp/github.mcp.yml
claude-canary plugin-init ./my-plugin
claude-canary plugin-suite --plugin ./my-plugin --last 10
```

## Security model

- A detached Git worktree isolates tracked file modifications, **not operating-system
  permissions**. Scenario setup/verification commands execute locally with user rights.
- Canary permission instrumentation **records and denies** permission requests; it
  never automatically approves them. Tests that require privileged execution
  need an explicitly configured, separate, disposable environment.
- Scenario pack installation rejects symlinked input and output path components.
- `repro --force` only replaces Canary-marked reproduction bundles inside a
  repository; it refuses unowned or symlinked destinations.
- Compatibility bundles verify all files against their attestation; extra files
  and symlinks invalidate verification. If the attestation file resides inside
  the bundle, specify its location via `--attestation`.
- The MCP inspector enforces an 8 MiB limit on a single unbroken stdout frame.
- Result reuse fingerprints local/global Claude configuration and provider
  environment values. External service state can still change independently.
  Use `--reuse-results` only for trusted, reproducible environments.
- Review reproduction bundles before sharing; pattern-based secret redaction
  cannot identify every project-specific secret.

## Development and CI

`npm run check` validates JavaScript syntax and package entrypoints and runs
Node's built-in regression tests. CI tests Node.js 20 and 22 on Windows and Linux.
There is currently **no TypeScript build step**; source maps point to original
files that were not imported. The GitHub Action described by upstream documentation
is not present in this mirror and is not advertised as available here.

## Credits and license

Based on **Claude Code Canary**, original package by SLP-DEV1, MIT licensed.
See [LICENSE](LICENSE). This fork's fixes and issue tracker:
[spk-c/claude-cody-canary](https://github.com/spk-c/claude-cody-canary).
