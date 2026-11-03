# Distribution and installation — spk-c fork

This page describes **this fork**, not the upstream SLP-DEV1 publication.
Historical upstream npm, Marketplace, release and floating-tag references
in earlier archived documentation are **not** proof of availability here.

## Verified distribution channels

| Surface | Current fork status | Link |
| --- | --- | --- |
| Source repository | Available with TypeScript source, tests, examples and build tools | [spk-c/claude-cody-canary](https://github.com/spk-c/claude-cody-canary) |
| GitHub Release | **v2.4.0 release target**; immutable tag, checksums and source provenance verified by release workflow | [v2.4.0](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.4.0) |
| Composite GitHub Action | Source in repository at an exact tag; test independently before adopting | `spk-c/claude-cody-canary@v2.4.0` |
| Floating Action channel | **Not published**; do not use `@v2` or `@v1` with this fork | Use the immutable tag |
| npm registry | [`claude-code-canary@2.3.0`](https://www.npmjs.com/package/claude-code-canary/v/2.3.0) **prepared for npm Trusted Publishing** with signed provenance | [npm publishing setup](NPM_PUBLISHING.md) |
| GitHub Marketplace | No Marketplace listing is claimed for this fork | Use the tagged Action directly |

The fork includes an archived/restored TypeScript v2.1.0 source tree (with later fork fixes). See
[source provenance](SOURCE_RESTORATION.md) for limitations, attribution
and why this is not a claim of official upstream ownership.

## Source installation

Download **Source code (zip)** or clone the exact release tag:

```sh
git clone --branch v2.4.0 --depth 1 https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm ci
npm run check
node dist/v2-cli.js --help
```

The full source archive has `src/`, `test/`, `tests/`, `scripts/`,
`schemas/`, `dist/` and TypeScript build configuration.

## Install directly from npm

```sh
npm install --global claude-code-canary@2.3.0
claude-canary --version
```

A clean Windows registry consumer verified the package API and three binaries: `claude-canary`, `claude-canary-dag` and `claude-canary-history`.

## Alternative: install from the verified GitHub Release tarball

From the [GitHub Release](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.3.0),
download both `claude-code-canary-2.3.0.tgz` and `SHA256SUMS`.
Verify the archive checksum, then install into an isolated project:

```sh
sha256sum -c SHA256SUMS
mkdir canary-consumer
cd canary-consumer
npm init -y
npm install ../claude-code-canary-2.3.0.tgz
npx --no-install claude-canary --version
```

The `.tgz` archive is an **installable package**, not full TypeScript
source. Use the GitHub source archive if you need to modify or rebuild it.

## GitHub Action at a pinned release

```yaml
- uses: spk-c/claude-cody-canary@v2.4.0
  with:
    mode: mcp-check
    mcp-contract: .canary/mcp/server.mcp.yml
    mcp-require-baseline: 'false'
```

The contract launches a local MCP server, which is trusted executable CI
input. Review its command before using it in a workflow with credentials.
Model-backed scenarios require separately configured Claude access;
offline MCP contract tests do not.

## Automated verification

The repository tests the source on Linux, Windows and macOS with Node
20/22/24, exercises a fresh installation of an npm-packed tarball, validates
the actual published v2.2.0 Release asset/checksum, and runs the **tagged**
Action against a real local MCP stdio fixture.

These smoke tests prove the checked paths and packaging, **not** broad live
Claude/model compatibility. Paid authenticated E2E remains optional and is
not required to publish a GitHub Release.

For an upcoming new version, update the exact tag in examples and rerun
consumer tests against the new published artifact. Never silently repoint an
existing immutable tag. A floating `v2` channel may be introduced only
with a separate, documented stability policy and successful consumer tests.

## Metadata and attribution

The original MIT copyright and credit belong to SLP-DEV1. This fork is
maintained at `spk-c/claude-cody-canary`; preserve upstream attribution.
The recommended GitHub description/topics and the steps needed to apply them
are documented in [repository metadata](REPOSITORY_METADATA.md). README or
package changes do not themselves update GitHub About settings.

The existing npm package has now been updated through the manual [Trusted Publishing workflow](../.github/workflows/npm-publish.yml), which checked the exact previously published GitHub tarball. The original npm maintainer `slp-dev1` retains account access, and the new package metadata points to this fork.

The v2.2.0 release includes the modern MCP inspector, release-watch retries, verified suite identities, safe digest reuse, DAG orchestration and History indexing. These were tested from the public npm registry. The older v2.1.1 artifacts remain immutable and do not include all these enhancements.

See [historical CI evidence and actual publication](CI_EVIDENCE.md).
