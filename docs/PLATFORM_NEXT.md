# Experimental platform features (development branch)

This document describes source-level features introduced **after** published v2.2.0.
They are not yet available through the immutable v2.2.0 package or Action.

## Offline CLI, no API key required

After `npm ci && npm run build`:

```sh
node dist/v2-cli.js ci analyze path/to/ci.log
node dist/v2-cli.js mcp conformance path/to/captured-envelopes.json
node dist/v2-cli.js minimize steps.json 'failure marker'
node dist/v2-cli.js stats 90 100 65 100
node dist/v2-cli.js plugin scan ./my-plugin
node dist/v2-cli.js security audit .claude/settings.json
node dist/v2-cli.js agent doctor
node dist/v2-cli.js smart select scenarios.json --changed src/index.ts,src/api.ts
npm run history:index -- .canary/results
node dist/v2-cli.js dashboard .canary/results/history-index.json .canary/results/dashboard.html
```

### Scope and boundaries

- **CI analysis** uses fixed signal codes, fingerprint grouping and recommended next actions. It does not send logs to a service or emit raw lines; it is a diagnostic heuristic, not proof of root cause.
- **MCP conformance** validates saved JSON-RPC envelopes and includes a deterministic malformed-envelope corpus via the TypeScript API. It does not connect to untrusted MCP servers, fuzz live network endpoints, test all MCP methods, or support interactive MRTR.
- **Regression minimization** is a bounded, predicate-driven delta debugger. Its CLI reduces a JSON string array by preserving a literal failure marker. Complex Claude scenario dependencies and environment state are not automatically minimized.
- **Statistics** uses Wilson confidence intervals and conservative nonoverlap for pass/fail rates. Small samples are explicitly marked insufficient; this is not a formal replacement for experimental design.
- **Plugin scanning** reuses existing symlink-safe plugin discovery without launching plugins; findings are structural recommendations, not runtime proof.
- **Security audit** checks broad permission rules and simple risky hook patterns in static settings JSON. It does not execute hooks or audit all possible shell syntaxes.
- **Agent adapters** report whether Claude, Codex and Qwen executables are available. Running Codex/Qwen and normalizing their telemetry will require explicit per-agent adapters and integration tests.
- **Smart selection** ranks matching, always-run and unmapped cases; it never silently drops cases with no affects mapping. Its CLI expects a JSON list of `{name, affects, failureCount?, alwaysRun?, lastDurationMs?}`.
- **History dashboard** writes a local standalone HTML view of a privacy-preserving history index. It uses no CDN or remote API. It does not yet include live updates, a persistent SQLite store or interactive editing.

### Security

Review input files. Commands accept local files (bounded by size), do not launch model-backed jobs, and never run plugin hooks or settings commands. Canary continues to require trusted scenario configurations for active execution. Dashboard output must be generated at a newly chosen path (no overwrite). CI failures and tool error outputs remain visible as status codes, not silently retried.

### Next steps towards complete product scope

1. Safely test live MCP server conformance with explicit allowlisted transports, request budgets, response limits, protocol-version negotiation and negative-case isolation.
2. Integrate the CI analyzer with GitHub Actions API job metadata and rerun provenance.
3. Add scenario dependency-aware minimization and reproducible fixture snapshots.
4. Extend the dashboard to SQLite-backed local time-series and richer performance analysis.
5. Implement and validate distinct Claude, Qwen and Codex execution adapters with explicit user permission and telemetry normalization.

These are not represented as completed until actual integration tests pass.
