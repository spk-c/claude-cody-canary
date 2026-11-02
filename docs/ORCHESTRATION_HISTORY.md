# Optional offline DAG orchestration and history indexing

**Release status:** the source and package metadata on `main` (version 2.2.0) include both utilities as standalone package commands, `claude-canary-dag` and `claude-canary-history`. The **last published stable v2.1.1 tarball does not include them**. A new immutable v2.2.0 release is required before those package commands can be used by release consumers.

The scripts can be run from a source checkout after `npm ci` and `npm run build`. No hosted Canary service or provider key is required for local offline MCP contracts.

## Bounded dependency scheduler

Create a trusted YAML file:

```yaml
version: 1
nodes:
  - id: local_mcp
    kind: mcp-check
    file: .github/fixtures/consumer-mcp.mcp.yml
  - id: followup_suite
    kind: suite
    file: .canary/release.suite.yml
    dependsOn: [local_mcp]
```

```sh
npm run dag:run -- .canary/dag.yml 2
# After a v2.2.0 tarball has been released and installed:
# npx --no-install claude-canary-dag .canary/dag.yml 2
```

Supported node kinds: `mcp-check`, `suite`. Canary launches its own
versioned CLI through `node` with fixed argument vectors, never with a shell.
Concurrency is 1–8 (default 2), maximum 64 tasks; cycles, duplicate/missing
dependencies, unknown fields and path traversal are rejected. Each node has
a 10-minute timeout and 1 MiB output cap; failed prerequisites skip dependents.
Only status, exit code, duration and node id/kind appear in
`.canary/results/dag-summary.json`, not raw provider output.
As with scenario files, only run trusted manifests and MCP server commands.

Full plugin command graphs, persistent remote queues, retry policies and
multi-machine scheduling are not implemented in this script.

## Compact privacy-preserving history index

```sh
npm run history:index -- .canary/results
# After a v2.2.0 tarball has been released and installed:
# npx --no-install claude-canary-history .canary/results
```

The index uses known Canary result summaries, no transcripts, prompts, API
keys or raw environment. It reads up to 5,000 JSON files of at most 4 MiB each
from the specified *flat* directory, emits deterministic chronological records,
counts successes/failures and computes a SHA-256 over the index entries.
Unknown schemas are skipped, malformed JSON fails closed. The generated
`history-index.json` is excluded from the next scan.

A SQLite/persistent cross-run index and user interface remain potential
follow-ups; this simple local index avoids a database or network dependency.
