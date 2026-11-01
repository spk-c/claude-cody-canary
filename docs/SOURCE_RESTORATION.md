# Source restoration and integration testing

The original TypeScript source, scripts, documentation and tests were recovered
from the publicly accessible archival repository
`actions-marketplace-validations/SLP-DEV1_claude-code-canary`,
pinned at commit `0e6ca737711fe3ca29015cebd515be602254cfaa`.

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
