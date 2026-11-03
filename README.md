# Claude Code Canary

**Regression and compatibility testing for Claude Code, plugins, and Model Context Protocol (MCP) servers.**

Detect breaking changes between Claude Code releases, run repeatable scenarios in CI, check MCP contracts, and generate inspectable evidence instead of relying on subjective pass/fail claims.

[![Source and security CI](https://github.com/spk-c/claude-cody-canary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/spk-c/claude-cody-canary/actions/workflows/ci.yml)
[![Consumer smoke](https://github.com/spk-c/claude-cody-canary/actions/workflows/consumer-smoke.yml/badge.svg?branch=main)](https://github.com/spk-c/claude-cody-canary/actions/workflows/consumer-smoke.yml)
[![CodeQL](https://github.com/spk-c/claude-cody-canary/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/spk-c/claude-cody-canary/actions/workflows/codeql.yml)
[![GitHub release](https://img.shields.io/github/v/release/spk-c/claude-cody-canary?label=release)](https://github.com/spk-c/claude-cody-canary/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](package.json)

> **Independent source-restored fork.** This is not an official Anthropic project. The original Claude Code Canary project is credited to SLP-DEV1 under the MIT license. See [source restoration and provenance](docs/SOURCE_RESTORATION.md).

## What can you test?

| Capability | What it helps you verify |
| --- | --- |
| **Claude Code release regression tests** | Run scenarios against exact releases, compare results, and bisect the first failing version. |
| **MCP contract testing** | Check the tools, schemas, capabilities and transport exposed by a trusted MCP server; offline stdio checks need no model API key. |
| **Plugin compatibility** | Build plugin smoke suites and compare behavior across Claude Code versions. |
| **CI regression gates** | Run `compare`, `pr-check`, `baseline-check`, `suite` and `watch` with a composite GitHub Action. |
| **Reproducible evidence** | Collect JSON, Markdown, HTML, JUnit and SARIF outputs, failure fingerprints and reproducible run metadata. |
| **Security and trust checks** | Verify permission behavior, hooks and isolated fixtures with fail-closed validations; these are *not* OS sandboxing. |
| **Large-suite tooling (v2.2.0)** | Shard merging, bounded DAG orchestration and a compact privacy-preserving history index are included in the published `v2.2.0` release and npm package. |

## Start here: run an offline MCP check

The **stable fork release is [v2.3.0](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.3.0)**. Node.js **20+** and Git are required.

~~~sh
git clone --branch v2.3.0 --depth 1 https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm ci
npm run build
node dist/v2-cli.js --version
node dist/v2-cli.js mcp-check .github/fixtures/consumer-mcp.mcp.yml
~~~

The last command uses this repository's included *local* MCP stdio fixture: no Anthropic API key or paid model call is needed. The fixture is for demonstration, not an assertion about your own MCP server.

To check your own server, create and review a [contract file](docs/MCP_CONTRACTS.md) and then run `node dist/v2-cli.js mcp-check path/to/server.mcp.yml`. MCP contracts can launch commands; only run servers and files you trust.

**Prefer an installable archive?** Download the release's `.tgz` and `SHA256SUMS`, verify the checksum, and install the tarball in a new project following [distribution and installation](docs/DISTRIBUTION.md). **npm installation is available:** `npm install --global claude-code-canary@2.3.0`. Version **2.3.0** is prepared for npm Trusted Publishing by this fork via npm Trusted Publishing with signed provenance. The original package name and MIT attribution are preserved. See [npm publishing](docs/NPM_PUBLISHING.md).

## GitHub Actions: offline MCP contract gate

For a repository with a reviewed contract at `.canary/mcp/server.mcp.yml`, use the exact stable tag:

~~~yaml
- uses: spk-c/claude-cody-canary@v2.3.0
  with:
    mode: mcp-check
    mcp-contract: .canary/mcp/server.mcp.yml
    mcp-require-baseline: 'false'
~~~

This runs a real local contract check and needs no paid API. The full [GitHub Action guide](docs/GITHUB_ACTION.md) covers scenario suites, release watch, PR checks, result artifacts and safe credential handling. There is **no floating `@v2` Action tag** in this fork.

## Release v2.3.0 and existing v2.2 utilities

The [v2.3.0 GitHub Release](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.3.0) and [npm v2.3.0 package](https://www.npmjs.com/package/claude-code-canary/v/2.3.0) are published. The release tarball passed CI, security checks, clean installation and provenance attestation.

For development from `main`:

~~~sh
git clone https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm ci
npm run check
node dist/v2-cli.js --help
~~~

Version 2.3.0 retains the standalone commands `claude-canary-dag` and `claude-canary-history`. In a source checkout, use `npm run dag:run -- <manifest.yml>` and `npm run history:index -- .canary/results`. After npm installation, run `claude-canary-dag <manifest.yml>` and `claude-canary-history .canary/results`. See [DAG and history guide](docs/ORCHESTRATION_HISTORY.md) and [scaling guide](docs/SCALING.md).

## Verified examples, not mock screenshots

Recent [CI evidence with actual log excerpts](docs/CI_EVIDENCE.md) includes the 211 passing Vitest tests and successful packaged CLI/API/DAG/history smoke tests from **2 November 2026**. Those results validate the tested paths, **not** live model-backed behavior.

The separate [authenticated Claude Code E2E workflow](.github/workflows/live-claude-e2e.yml) requires an `ANTHROPIC_API_KEY` secret and manual dispatch from `main`. It is not a release gate and is not claimed to have passed merely because offline CI is green.

## New platform capabilities in v2.3.0

Version 2.3.0 adds new offline CLI tools for CI diagnostics, MCP envelope conformance, delta debugging, security/plugin scans, statistical comparisons, safe test prioritization, agent discovery and an interactive local history dashboard. These shipped in **npm v2.3.0**. Subsequent roadmap features on the development branch are not yet published; see the [platform guide](docs/PLATFORM_NEXT.md). See [platform guide](docs/PLATFORM_NEXT.md) for scope and examples.\n\n## Verified-answer E2E (unreleased development feature)

The current source branch adds a bounded E2E harness for Claude, Codex and Qwen. By default, `claude-canary agent e2e manifest.json` is an **offline preview only**; it never launches a model. The optional execution mode requires both `--trusted` and `--allow-provider-costs`. Independently supplied expected-answer SHA-256 hashes are checked against provider output, and only sanitized observations are reported.

Provider-reported spending thresholds are **not hard billing caps**: a request may exceed a limit before cost telemetry arrives. Canary stops subsequent requests when cost is missing or the reported threshold is exceeded. Review provider billing controls and the [full manifest and safety guide](docs/PLATFORM_NEXT.md) before enabling execution. These improvements are not yet included in npm v2.3.0.

## Documentation\n
| Guide | Topics |
| --- | --- |
| [Getting started / distribution](docs/DISTRIBUTION.md) | Stable releases, source checkout, checksums, package and Action installation |
| [MCP contract testing](docs/MCP_CONTRACTS.md) | Server contracts, snapshots and compatibility checks |
| [GitHub Action](docs/GITHUB_ACTION.md) | CI modes, inputs, outputs and security |
| [Plugin compatibility](docs/PLUGIN_COMPATIBILITY.md) | Plugin scenarios and release comparisons |
| [Scenario suites and scaling](docs/SCALING.md) | Sharding, incremental selection and safe caching |
| [DAG and history](docs/ORCHESTRATION_HISTORY.md) | Bounded execution graphs and compact run history |
| [Reports](docs/REPORT_NAVIGATION.md) | Navigable reports and evidence |
| [Security model](docs/SECURITY_MODEL.md) | Threat model, permissions and isolation limits |
| [Roadmap](ROADMAP.md) | Implemented capabilities and future plans |
| [Release process](docs/RELEASING.md) | Source tests, audits and immutable release publication |

## Security, licensing and fork transparency

Scenario setup and verification commands may execute code. **Git worktrees are not operating-system sandboxes**; run only reviewed scenarios, plugins and MCP servers with least-privilege credentials. The permission probe denies rather than automatically approves permission requests. Portable compatibility evidence excludes prompts, transcripts and raw credentials by default; see the [security model](docs/SECURITY_MODEL.md).

This fork restores TypeScript source, tests, docs and a composite Action from a public archive of the original MIT-licensed project. Restoration provenance and its limitations are recorded in [SOURCE_RESTORATION.md](docs/SOURCE_RESTORATION.md). The original author is **SLP-DEV1**. Fork maintenance and hardening: **spk-c**.

**Repository naming:** the GitHub URL intentionally remains `spk-c/claude-cody-canary`; the software and npm package metadata use `claude-code-canary`. The [repository metadata proposal](docs/REPOSITORY_METADATA.md) documents the recommended description and topics without renaming the repository.
