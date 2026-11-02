# Claude Code Canary Roadmap

Claude Code Canary exists to answer one question reliably:

> **What broke, when did it break, and can I prove it without guessing?**

## Status

The roadmap from v1.3 through v2.2 is implemented in the v2 compatibility platform. **Implementation does not mean that all enhancements have been published in the historical immutable v2.1.1 release; v2.3.0 was published to GitHub Releases and npm on 2026-11-02 (UTC). Later unreleased work remains on `main`.** The v2.0.0 release unified release watching, scenario suites, compatibility evidence, CI reporting, trust regression testing and programmatic compatibility queries behind one local-first toolchain; v2.1 and v2.2 deepen developer experience and ecosystem publishing on top of that contract.

| Milestone | Implementation status | Implemented capabilities |
| --- | --- | --- |
| **v1.3** | ✅ Complete | Release watch, scenario suites, deterministic sharding, selective execution, run budgets, safe result reuse, flakiness analysis and failure fingerprints. |
| **v1.4** | ✅ Complete | Static HTML, JUnit, SARIF, GitHub summaries, local trends and explicit baseline proposals. |
| **v1.5** | ✅ Complete | Compatibility manifests, `canary.lock`, open registries, evidence-derived badges and inspectable scenario packs. |
| **v1.6** | ✅ Complete | Permission-policy coverage, hook/monitor trust checks, isolated MCP fixtures, gateway matrices and signed/checksummed attestations. |
| **v2.0** | ✅ Complete | Versioned public schemas, compatibility query/explain APIs, compatibility graph, multi-registry aggregation and the expanded TypeScript API. |
| **v2.1** | ✅ Complete | Suite bootstrap/migration, semantic evidence diffs, large-report navigation, workspace examples, evidence diagnostics and scheduled release watching. |
| **v2.2** | ✅ Complete | Static registries, signed manifests, community pack metadata/catalogs, evidence-backed badges and conflict-aware registry exchange. |

The implementation remains local-first: core compatibility workflows do not require a Canary-hosted service, and portable evidence excludes prompts, transcripts, credentials and raw environment values by default.

## v2.0 release contract

The v2 major keeps the existing deterministic scenario model and old CLI workflows while adding a v2 command surface and public compatibility contracts.

Key guarantees:

- Node.js 20+ remains supported.
- Existing `run`, `compare`, `bisect`, `pr-check`, baseline, plugin, MCP, experiment, record/replay, agent-team and Doctor workflows remain available.
- New Action modes include first-class `suite` and `watch` orchestration.
- The historical upstream uses floating `v1` / `v2` Action channels. **This fork has not published those tags**: use an exact immutable GitHub Release tag.
- This fork publishes GitHub Releases after deterministic source, security, audit and packaging gates. Authenticated `Live Claude E2E (full)` is optional and is **not** claimed to have passed when credentials were not supplied.
- Public v2 compatibility schemas are explicitly versioned; breaking changes require a new schema/major contract rather than silent mutation.

## Post-v2 direction

The next work should deepen usability and ecosystem adoption rather than re-create the compatibility core.

### v2.1 — Developer experience

- ✅ interactive `suite init` bootstrap with deterministic non-interactive flags;
- ✅ `suite migrate` helpers for legacy suite layouts with dry-run, fail-closed mapping and safe in-place backups;
- ✅ semantic `lock diff` / manifest diff explanations with impact classification and machine-readable JSON;
- ✅ richer static `report` navigation for large suites with search, filters, sorting, pagination and suite progress summaries;
- ✅ documented, parser-validated examples for monorepos and multi-plugin workspaces with affected-path selection patterns;
- ✅ fast `compat diagnose` diagnostics for invalid/stale manifests, registries and lockfiles with actionable fixes and CI-friendly JSON;
- ✅ end-to-end scheduled GitHub Actions `watch` example with persisted state, explicit known-good bootstrap, artifact retention and retry-safe exit handling.

### v2.2 — Ecosystem publishing

- ✅ first-class static registry publishing for GitHub Pages/Releases with content-addressed manifests, deterministic checksums, CLI/API helpers and a parser-validated Pages workflow;
- ✅ deterministic Ed25519 compatibility-manifest signing and verification with a pinned, verify-before-upload GitHub Release workflow;
- ✅ reusable community scenario-pack discovery metadata and deterministic multi-pack catalogs derived from verified pack contents;
- ✅ locally generated evidence-backed SVG badges with machine-readable manifest/evidence bindings and publishable Markdown;
- ✅ conflict-aware registry import/export with filtered subsets, full-manifest identity, collision-safe deduplication and explicit contradictory-result handling.

### Post-v2.1.1 scale and reliability work (published in v2.2.0)

- ✅ shard-result merging with collision/coverage checks and shared execution identities;
- ✅ per-suite executable/configuration hash memoization with live file metadata invalidation;
- ✅ one-pass compiled-glob scenario discovery and existing incremental selection;
- ✅ repository-local bounded DAG-style orchestration for suite and MCP check nodes (plugin/DAG remote scheduling remains future work);
- ✅ compact repository-local privacy-preserving historical summary index;
- ✅ reliable scheduled release-watch retries and infrastructure classification;
- ✅ explicit modern MCP 2026-07-28 stdio and limited read-only Streamable HTTP inspection;
- ✅ GitHub release build-provenance attestation in the **v2.2.0 release workflow** (existing v2.1.1 assets are unchanged).

These enhancements are now part of the immutable **v2.2.0 GitHub Release and npm artifacts**. DAG and History ship as separate CLI commands and were verified by a fresh public npm registry consumer installation. Future improvements require a new version.

### Future major ideas

A later major may add optional hosted visualization or shared indexing, but hosted infrastructure must remain optional. Local files, reproducible evidence and deterministic queries remain the source of truth.

## Product principles

Every future roadmap item should preserve these constraints:

- **Real Claude Code behavior over synthetic benchmarks.** Canary is not an LLM leaderboard.
- **Deterministic evidence over subjective grading.** Prefer assertions, lifecycle events, schemas, diffs, metrics and exit categories.
- **Exact-version reproducibility.** A failure must be replayable against the exact Git commit and Claude Code release that produced it.
- **Local-first and CI-friendly.** Core functionality must not depend on a hosted Canary service.
- **Privacy by default.** Portable artifacts should exclude prompts, transcripts, credentials and raw environment values unless explicitly requested.
- **Fail closed around integrity.** Unknown release metadata, malformed contracts, unsafe fixture export and incompatible baselines must not silently pass.
- **No hidden side effects.** Discovery/reporting stays read-only; mutating fixtures remain confined to Canary-owned temporary state.

The historical release record is maintained in [CHANGELOG.md](CHANGELOG.md).

## v2.3.0 published platform

The published v2.3.0 release includes bounded CI failure diagnostics, read-only live MCP discovery, opt-in loopback negative probes, scenario replay, optional SQLite history, and explicitly approved read-only Claude/Codex/Qwen one-shot execution. These are limited, opt-in features rather than complete protocol/fuzz conformance or standardized cross-provider benchmarks. See [platform feature guide](docs/PLATFORM_NEXT.md).

## v2.4 MCP conformance — active work (Issue #41)

- ✅ Existing read-only 2026-07-28 stdio and Streamable HTTP discovery; zero `tools/call` invocations.
- ✅ Local-only opt-in malformed-envelope HTTP checks (maximum three), no redirects, no credential forwarding.
- 🛠 Unreleased: enforce 24 total discovery requests and a 30-second wall-clock budget in live audits; correlate negative responses to exact request IDs and reject URLs containing fragments.
- ⬜ Add explicit MCP session lifecycle, notifications/cancellation, safe negative stdio fixtures and MRTR handling; never run destructive tools automatically.
- ⬜ Validate trusted transports, bounded output, privacy and platform parity with Linux/macOS/Windows CI before calling v2.4 complete.

## v2.5 dashboard and agent quality — planned (Issue #43)

- Extend local SQLite dashboards with failure clusters, searchable artifacts and reproducible version/OS/plugin comparisons.
- Add statistically conservative repeated-run comparisons and clear insufficient-data/not-comparable states.
- Improve provider-specific telemetry and credential isolation without persisting prompts or model outputs.

## v2.3 CI quality follow-ups — planned (Issue #42)

- Test real GitHub workflow attempts including cancelled runners and permission edge cases.
- Provide privacy-safe failure triage suggestions and stronger dependency/fixture replay cases.

