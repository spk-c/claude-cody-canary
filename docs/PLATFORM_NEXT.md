# Platform features: v2.3.0 and unreleased hardening

This document documents the platform capabilities added for **v2.3.0**. Earlier published releases, including immutable v2.2.0, do not contain these features.

## Offline CLI, no API key required

After `npm ci && npm run build`:

```sh
node dist/v2-cli.js ci analyze path/to/ci.log
node dist/v2-cli.js mcp conformance path/to/captured-envelopes.json
node dist/v2-cli.js minimize steps.json 'failure marker'
node dist/v2-cli.js stats 90 100 65 100
# Unreleased: input JSON with id, baselinePasses, baselineRuns, candidatePasses, candidateRuns
node dist/v2-cli.js stats family ./comparisons.json
node dist/v2-cli.js plugin scan ./my-plugin
node dist/v2-cli.js security audit .claude/settings.json
node dist/v2-cli.js agent doctor
node dist/v2-cli.js smart select scenarios.json --changed src/index.ts,src/api.ts
npm run history:index -- .canary/results
node dist/v2-cli.js dashboard .canary/results/history-index.json .canary/results/dashboard.html
```

### Scope and boundaries

- **CI analysis** uses fixed signal codes, fingerprint grouping and recommended next actions. It does not send logs to a service or emit raw lines; it is a diagnostic heuristic, not proof of root cause.
- **MCP conformance** validates offline JSON-RPC envelopes and includes bounded, explicitly trusted live discovery plus optional malformed-envelope probes against numeric loopback HTTP endpoints. It never calls `tools/call`. This is not full MCP conformance; remote active fuzzing, SSE, generic MRTR and notifications/cancellation remain unsupported.
- **Regression minimization** is a bounded, predicate-driven delta debugger. Its CLI reduces a JSON string array by preserving a literal failure marker. Complex Claude scenario dependencies and environment state are not automatically minimized.
- **Statistics** uses Wilson confidence intervals and conservative nonoverlap for pass/fail rates. Small samples are explicitly marked insufficient; this is not a formal replacement for experimental design.
- **Plugin scanning** reuses existing symlink-safe plugin discovery without launching plugins; findings are structural recommendations, not runtime proof.
- **Security audit** checks broad permission rules and simple risky hook patterns in static settings JSON. It does not execute hooks or audit all possible shell syntaxes.
- **Agent adapters** discover Claude, Codex and Qwen, and can execute reviewed read-only, one-shot commands only with explicit `--trusted`. Output metrics are provider-specific and not universally comparable; full cross-provider benchmarks remain future work.
- **Smart selection** ranks matching, always-run and unmapped cases; it never silently drops cases with no affects mapping. Its CLI expects a JSON list of `{name, affects, failureCount?, alwaysRun?, lastDurationMs?}`.
- **History dashboard** writes standalone privacy-preserving HTML and optionally imports sanitized history into local SQLite (Node 22.5+). It uses no hosted service; rich time-series comparisons, live updates and interactive editing remain future work.

### Security

Review input files. Commands accept local files (bounded by size), do not launch model-backed jobs, and never run plugin hooks or settings commands. Canary continues to require trusted scenario configurations for active execution. Dashboard output must be generated at a newly chosen path (no overwrite). CI failures and tool error outputs remain visible as status codes, not silently retried.

### Remaining work towards complete product scope

1. Expand bounded live MCP checks beyond read-only discovery and local negative HTTP probes, with explicit session/cancellation/notification coverage and verified MRTR states.
2. Improve real GitHub CI failure diagnosis beyond existing attempt/job provenance and privacy-safe error categories.
3. Extend trusted worktree replay into a broader fixture coverage matrix without assuming it is an OS sandbox.
4. Expand existing SQLite history dashboards with confidence intervals, local time-series and richer performance analysis.
5. Verify Claude, Qwen and Codex adapter parity and telemetry contracts across provider versions without persisting prompts or raw outputs.

These are not represented as completed until actual integration tests pass.

## Extended integrated features

The following integrated CLI commands are available in v2.3.0:

```sh
claude-canary ci run spk-c claude-cody-canary 41522087038
claude-canary mcp live ./trusted.mcp.yml --trusted
claude-canary mcp live ./local.mcp.yml --trusted --negative
# Unreleased roadmap extensions (not in npm v2.3.0):
claude-canary mcp stdio-negative C:/fixtures/reviewed.cjs --trusted
claude-canary mcp listen http://127.0.0.1:3000/mcp --trusted
claude-canary agent compare ./baseline-cohort.json ./candidate-cohort.json
claude-canary agent run codex ./review-prompt.txt --trusted
claude-canary minimize replay ./trusted-replay.json --trusted
claude-canary suite ./release.suite.yml --priority-history ./priorities.json
claude-canary history sqlite-import .canary/results/history-index.json .canary/results/history.sqlite
claude-canary history sqlite-trends .canary/results/history.sqlite
# Unreleased: group by version, OS and plugin
claude-canary history sqlite-matrix .canary/results/history.sqlite
claude-canary history sqlite-dashboard .canary/results/history.sqlite ./dashboard.html
```

**GitHub Actions diagnostics** retrieve metadata across attempts, not raw logs. A public repository can be inspected without credentials; private repositories can use `--token-env GITHUB_TOKEN` with a least-privilege environment variable. Original failed attempts remain in results after successful retries.

**Live MCP** always requires a reviewed contract and explicit `--trusted` acknowledgement. Its normal checks use existing read-only discovery, never `tools/call`. Negative/malformed request tests use a maximum of three requests and can run only against numeric loopback HTTP endpoints. No redirect following or credential forwarding; an OS network sandbox is not supplied. **Unreleased v2.4 hardening:** live discovery is capped at 24 total requests and 30 seconds across all pages/transports; responses to negative probes must match the originating JSON-RPC ID, timeout options are validated before connecting, and URL fragments are rejected.

**Agent execution** requires explicit `--trusted`, a prompt file, and runs Claude in plan mode, Codex in a read-only sandbox, or Qwen in plan mode. Agents may still make provider API calls/costs. Raw prompt/output, credentials and transcripts are not retained in results. Provider-specific metrics are emitted only when recognized. Native read-only modes are not substitutes for running within a real OS sandbox when testing untrusted extensions.

**Scenario minimization** runs approved shell commands inside a fresh detached Git worktree for each test. This is not an OS sandbox and is suitable for trusted fixture repositories only. Input schema: `{version:1,steps:[{id,command,dependsOn?:string[]}],verifyCommand,expectedExitCode, failureMarker?}`. A matching failure exit code (and optional marker) must reproduce in the original case. Execution is bounded by time, attempts and step count.

**Suite prioritization** takes a `--priority-history` JSON map of normalized scenario path to `{failureCount,lastDurationMs?}`. It changes only the order of selected tests and is intentionally rejected in strict shard mode, preserving deterministic shard identity. No selected test is dropped.

**Persistent history** uses Node.js built-in SQLite on **Node 22.5+**; Canary's other CLI commands still support Node.js 20. It stores only sanitized run/suite/watch summaries from the existing history index with idempotent imports and bounded retention. It refuses a symlink database. No hosted service or model subscription is required.

**Unreleased development extensions:** Streamable HTTP now consumes bounded request-scoped SSE event streams and validates notification/event correlation. MCP 2026-07-28 is stateless: it does **not** use the 2025 `Mcp-Session-Id` handshake; supported legacy stdio still initializes and checks negotiated versions. On stdio timeouts Canary sends a best-effort `notifications/cancelled` before terminating the process. The opt-in `mcp listen` command tests only numeric-loopback `subscriptions/listen`, requires an acknowledgement, and disconnects after one notification or a short timeout; it does not test remote subscription resilience. The opt-in `mcp stdio-negative` only launches a reviewed local `.cjs` test fixture under Node, without inherited process secrets, with three negative envelopes. The offline MRTR helper can construct a manually approved next-round request but never sends it, elicits input, or calls tools automatically.

**Unreleased local analytics:** Offline dashboard includes up to 90 daily trend bars, failure grouping and Wilson intervals (only observed outcomes). `agent compare` requires versioned, strict cohort JSON with identical per-scenario SHA-256 hashes and uses conservative pass-rate intervals; token and cost metrics are marked not comparable for different providers. No live paid-model E2E benchmark or cross-provider price equivalence is implied. Further version × plugin × OS breakdown requires an expanded history schema, and interactive MRTR orchestration remains intentionally disabled for read-only audits.

Full automated model-backed production performance benchmarking, multi-provider token normalization, remote MCP protocol-fuzz coverage and a full generic multi-round-trip MCP client are out of scope here; do not claim those as complete conformance certifications.

### Runner reliability and ARM coverage

Normal release-gating source CI tests Node 20/22/24 on Linux, Windows, and the
supported standard **macOS 15 Intel** runner. GitHub Actions repeatedly left
Apple Silicon runners unassigned long enough to prevent other successful
checks from completing. Rather than permanently remove ARM testing, a separate
`macOS Apple Silicon compatibility` workflow runs macOS 15 ARM on Node 20/22
on a weekly schedule and supports manual dispatch. This **does not count as
an ARM release gate**, and ARM failures must be investigated rather than hidden.

### Unreleased history matrix

SQLite schema v2 migrates existing v1 databases while preserving stored rows and IDs. Only validated version, OS and plugin identifiers are accepted. Older rows display as unknown. The dashboard shows dimension filters, and `history sqlite-matrix` aggregates the retained database. Results are descriptive, not matched experimental comparisons.

`stats family ./comparisons.json` accepts an array of `id`, `baselinePasses`, `baselineRuns`, `candidatePasses`, `candidateRuns` records. It applies a conservative family-wise correction, with insufficient-data results for small samples.
