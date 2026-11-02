# Distribution and installation — spk-c fork

This page describes **this fork**, not the upstream SLP-DEV1 publication.
Historical upstream npm, Marketplace, release and floating-tag references
in earlier archived documentation are **not** proof of availability here.

## Verified distribution channels

| Surface | Current fork status | Link |
| --- | --- | --- |
| Source repository | Available with TypeScript source, tests, examples and build tools | [spk-c/claude-cody-canary](https://github.com/spk-c/claude-cody-canary) |
| GitHub Release | **v2.1.1 published**; immutable tag and downloadable package | [v2.1.1](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.1.1) |
| Composite GitHub Action | Source in repository at an exact tag; test independently before adopting | `spk-c/claude-cody-canary@v2.1.1` |
| Floating Action channel | **Not published**; do not use `@v2` or `@v1` with this fork | Use the immutable tag |
| npm registry | **Not published by this fork**; `package.json` intentionally has `"private": true` | Install the Release tarball directly |
| GitHub Marketplace | No Marketplace listing is claimed for this fork | Use the tagged Action directly |

The fork includes an archived/restored TypeScript v2.1.0 source tree (with later fork fixes). See
[source provenance](SOURCE_RESTORATION.md) for limitations, attribution
and why this is not a claim of official upstream ownership.

## Source installation

Download **Source code (zip)** or clone the exact release tag:

```sh
git clone --branch v2.1.1 --depth 1 https://github.com/spk-c/claude-cody-canary.git
cd claude-cody-canary
npm ci
npm run check
node dist/v2-cli.js --help
```

The full source archive has `src/`, `test/`, `tests/`, `scripts/`,
`schemas/`, `dist/` and TypeScript build configuration.

## Package installation without npm publication

From the [GitHub Release](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.1.1),
download both `claude-code-canary-2.1.1.tgz` and `SHA256SUMS`.
Verify the archive checksum, then install into an isolated project:

```sh
sha256sum -c SHA256SUMS
mkdir canary-consumer
cd canary-consumer
npm init -y
npm install ../claude-code-canary-2.1.1.tgz
npx --no-install claude-canary --version
```

The `.tgz` archive is an **installable package**, not full TypeScript
source. Use the GitHub source archive if you need to modify or rebuild it.

## GitHub Action at a pinned release

```yaml
- uses: spk-c/claude-cody-canary@v2.1.1
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
the actual published v2.1.1 Release asset/checksum, and runs the **tagged**
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

The newly developed 2026 MCP stdio/HTTP inspector, retry-safe watch behavior,
verified suite identities, digest reuse, DAG scripts and history indexing are
currently merged on `main` **after** v2.1.1. They are not part of the immutable
published v2.1.1 package or GitHub Action. The v2.2.0 candidate explicitly packs DAG and History as standalone commands;
its build-time packed-consumer checks passed on Linux, Windows and macOS.
These commands remain **unreleased** until a new immutable version tag,
GitHub Release asset and successful published-consumer verification exist.
See [verified CI logs](CI_EVIDENCE.md) for real historical test output.
