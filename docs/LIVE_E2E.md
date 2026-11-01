# Claude Code live end-to-end tests

The **automatic** CI verifies TypeScript compilation, 211+ automated tests, an
actual Claude Code binary and a real local MCP stdio server. It does not call a
paid model endpoint and is **not** evidence that the model-backed scenarios pass.

## Authenticated model-backed tests

[Live Claude Code E2E (authenticated)](../.github/workflows/live-claude-e2e.yml)
is a manual-only GitHub Actions workflow. It runs on the reviewed `main`
branch with the repository Actions secret `ANTHROPIC_API_KEY` passed **only**
to the step that actually runs Claude. It never runs on pull requests.

If you *choose* to run this optional workflow, configure the Actions
secret `ANTHROPIC_API_KEY` (never commit the key), select the workflow in
GitHub Actions and run either `core` or `full` on `main`.
Neither suite is required by normal CI or the release workflow.

The workflow's explicit run names are `Live Claude E2E (core)` and
`Live Claude E2E (full)`. These are optional compatibility checks rather
than publication prerequisites.

`core` exercises discovery, `doctor`, `init`, `validate`, version
installation, a model-backed edit, compare, and plugin initialization.
`full` adds experiment, bisect, record/replay, repro bundles, and plugin
compatibility tests. Full uses multiple model calls and can incur API charges.

The fixture uses `acceptEdits`, capped turns and a per-scenario budget;
it is **not an OS sandbox**. Run only on a disposable CI runner. The fixture
must have an exact Canary ownership marker before an existing test directory
can be removed. On failure the fixture is left for diagnostics; on success
it is deleted. Never set `CLAUDE_CANARY_E2E_DIR` to a valuable directory.

A deterministic **offline** negative-executable run is used to generate
a real failed-result artifact for repro testing in `full`, rather than relying
on incidental failures from the model tests.

## Local use

Build first: `npm ci && npm run build`.
With a configured Claude Code CLI and authorization:

```sh
node scripts/live-e2e.mjs core
node scripts/live-e2e.mjs full
```

Optional variables: `CLAUDE_CANARY_E2E_CLAUDE` overrides the CLI;
`CLAUDE_CANARY_E2E_MODEL` chooses a model;
`CLAUDE_CANARY_E2E_KEEP=1` retains successful disposable fixtures;
`CLAUDE_CANARY_E2E_DIR` selects an explicitly owned parent directory.

`scripts/live-provider-e2e.mjs` is an optional compatibility wrapper for
third-party providers, requiring a separately installed router. It is **not** the enabled GitHub Actions workflow and does not define
the project's normal CI or release requirements.
