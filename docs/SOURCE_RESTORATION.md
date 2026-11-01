# Source restoration and integration testing

The original TypeScript source, scripts, documentation and tests were recovered
from the publicly accessible archival repository
`actions-marketplace-validations/SLP-DEV1_claude-code-canary`,
pinned at commit `0e6ca737711fe3ca29015cebd515be602254cfaa`.

## Original v1 source cross-check (maintainer-provided ZIP)

An original v1 working copy of `SLP-DEV1/claude-code-canary` was provided
as `claude-code-canary.zip`. Its Git history identifies commit
`e1127a1ec40ffcdff87a6b66487f7dd537b2a36c` (2026-08-27,
`fix: enable verbose for Claude stream-json`). The included v1.0.0 Git tag
points to `247f4da33a5907b5c18d1800238c5c83ae925f5e`.

The supplied v1 tree has **24 TypeScript source files** and **19 test files**.
All 49 sampled source, test and core metadata files match the Git `HEAD` in
the same ZIP after normalizing Windows CRLF line endings. All 24 source paths
and 19 test paths already exist in this fork's newer v2.1.0 tree. The old
runner's `--verbose` stream-json fix is also already incorporated.

The original issue and pull-request templates were missing and have been
restored with updated version, repository and privacy guidance. No old v1
source implementation was copied over the hardened v2 code. The full ZIP,
`.git`, `node_modules` and `.canary/results` were not imported because
they are unnecessary and can contain machine-local material.

The user-provided Git snapshot strengthens provenance for v1, but it is
not independent proof that the separate v2.1.0 archival mirror was an
official upstream release.

The archive matches the project's declared version 2.1.0. Previously merged
security patches were ported from this fork's compiled `dist/` back into `src/`.
This is a source recovery, not an assertion of official upstream repository
control or provenance. Review the archive and maintain the MIT attribution.

Reproducible compilation:
```sh
npm ci
npm run lint
npm run build
npm run test:security
npm test
```

CI runs a real stdio MCP server and asserts its initialization/tool listing.
For a live model-backed Claude Code exercise, use the manual
`Live Claude Code E2E (authenticated)` workflow. It requires the repository
secret `ANTHROPIC_API_KEY`; it is intentionally **not** run on pull requests,
because scenario code can run commands and should never receive secrets from
untrusted branches. The workflow installs the official Claude Code CLI and
runs the original `scripts/live-e2e.mjs` against disposable fixtures.
Tests requiring a provider cannot be claimed as executed if credentials
have not been supplied.

## Authenticated-run safety

The manual workflow rejects non-`main` refs before checkout, installs the
trusted default branch and passes `ANTHROPIC_API_KEY` only to the final
model-backed step. The `core` suite is the default; `full` runs additional
model-backed scenarios and can cost substantially more. Store the key as a
repository environment secret with deployment protection rules if possible.
Never dispatch model-backed runs on unreviewed code. The original
`bypassPermissions` setting was replaced with `acceptEdits` for the live fixture,
which is also subject to a per-scenario `max_budget_usd` limit.

If `CLAUDE_CANARY_E2E_DIR` is supplied, its `fixture` child is deleted only
when it bears Canary's own exact ownership marker and has no symlinked
path components. Unmarked directories are intentionally retained.

The live model run is still not claimed successful until its authenticated
workflow is explicitly launched and finishes successfully.
