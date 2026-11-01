# Scaling suites, sharding, incremental selection and caches

Canary's current `suite` command already offers selection/sharding and
verified-identity **local** cached results. This fork adds a strict multi-job
shard merge tool without changing the published v2.1.1 CLI or result schema.

## Incremental suite planning (no model calls)

```sh
node dist/v2-cli.js suite .canary/release.suite.yml --list --json \
  --changed src/api.ts,src/runner.ts
```

A changed file activates scenarios whose `affects` patterns match, plus
`always_run` scenarios. Entries with no `affects` patterns are always
included for safety. Review the `selected` and `skipped` lists before
running. The CLI's `--list` mode is side-effect-free; it does not run Claude.

## Deterministic CI sharding

On shard N of M, use the *same* suite, selection tags and repository revision:

```sh
node dist/v2-cli.js suite .canary/release.suite.yml --shard 1/4 --json
node dist/v2-cli.js suite .canary/release.suite.yml --shard 2/4 --json
node dist/v2-cli.js suite .canary/release.suite.yml --shard 3/4 --json
node dist/v2-cli.js suite .canary/release.suite.yml --shard 4/4 --json
```

Each shard writes an ordinary suite JSON artifact in `.canary/results/`.
Collect **all** shard JSON files in one trusted downstream job.

```sh
npm run shards:merge -- --output merged.json shard-1.json shard-2.json shard-3.json shard-4.json
```

The merged result is a regular Canary suite JSON plus a Markdown summary.
The stricter wrapper rejects missing/duplicate shards, different suite
metadata, incompatible filters, incomplete fail-fast selections, repeated
scenario paths and missing assignments. It returns nonzero for a failing
scenario and does not overwrite an existing output. The underlying
`claude-canary suite combine` remains available, but is a low-level
aggregation that does not enforce these global coverage guarantees.

**Important:** New `suite --shard` runs now include an `executionIdentity`
SHA-256 binding the Git commit, full suite definition, discovered scenarios,
tag/affected-path filter, platform/Node major, Canary version and hashed
provider environment. The strict merge refuses partial/mismatched identities.
For older v2.1.1 suite results without that field, the compatibility path
still validates coverage, but you must externally enforce identical
Git/Claude/runtime settings. Never merge artifacts from different machines
or executions without checking this identity and the actual tool version.

## Cache without stale-result risk

`--reuse-results` uses the existing `schemaVersion:2` identity, including
Git commit, scenario content, executable SHA-256, runtime/environment
fingerprint, Canary version, platform, Node major and feature flags.
Failed runs are never stored as successful cache hits.

Prefer reuse on a **trusted machine with unchanged configuration**, not
across arbitrary hosted runners. GitHub-hosted runner paths, credentials and
provider settings may differ, preventing valid hits or making shared
caches inappropriate. CI now caches the **npm dependency download cache**
through `actions/setup-node`, not model results.

For an explicit local run:

```sh
node dist/v2-cli.js suite .canary/release.suite.yml --reuse-results
```

## Offline scale measurements

```sh
npm run benchmark:shards -- 10000 16
```

Generates synthetic pass-only suite shard objects in memory and measures
time and heap usage of the strict merge. The benchmark does not spend API
tokens, touch GitHub or certify model accuracy. Run representative local
benchmarks before deciding on more complex DAG orchestration or long-term
history indexing.

A general bounded DAG scheduler and persistent history index remain
separate roadmap items; they are **not** claimed to exist in this release.

### Per-suite digest reuse (after v2.1.1)

Cache-eligible suite workers now share a short-lived digest memo for Claude
executables and configuration files. Every memo lookup rechecks live file
identity (device/inode, size and modification/change timestamps), and any
change while hashing fails closed. Environment values and the suite/cache
identity are still recomputed for each scenario, so changing provider settings
invalidates cache keys rather than silently reusing stale results.

This only reduces hashing overhead within one suite process. It does not
share hashes between machines, runs, different repositories or credentials.

## Distribution status

All core scale updates described here are merged on `main` after the
published v2.1.1 tag. The optional DAG orchestrator and compact history
index are repository scripts; see [orchestration and history](ORCHESTRATION_HISTORY.md).
Neither these scripts nor the new merged source enhancements are claimed
as shipped in the immutable v2.1.1 release.
