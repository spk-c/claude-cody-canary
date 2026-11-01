# MCP contract testing

Claude Code Canary can inspect an MCP server directly over the MCP stdio transport and turn its exposed surface into a deterministic compatibility contract.

This is intentionally protocol-level testing. It does not ask a model to judge whether a server "looks compatible". Canary initializes the server, enumerates its declared primitives, normalizes their schemas and compares the resulting contract.

## Contract file

```yaml
version: 1
name: github-local

server:
  command: node
  args:
    - ./tools/mock-github-mcp.mjs
  cwd: ../..
  timeout_seconds: 30
  protocol_version: 2025-11-25
  env:
    MCP_TEST_MODE: "1"

expect:
  tools:
    require:
      - search_issues
      - get_pull_request
    deny:
      - delete_repository
    require_read_only:
      - search_issues
      - get_pull_request
    deny_destructive: true

  prompts:
    require:
      - summarize_issue

  resources:
    require:
      - repo://fixture/README.md

  resource_templates:
    require:
      - repo://fixture/{path}

  capabilities:
    tools_list_changed: true
    resources_list_changed: true
    resources_subscribe: false
```

`server.cwd` is resolved relative to the contract file. Environment values are passed to the server process but are never written into the Canary snapshot or report.

Only the standard `stdio` transport is accepted in v1 of the contract format.
The default `protocol_version: 2025-11-25` preserves the legacy
`initialize` / `notifications/initialized` handshake.

For a **2026-07-28 stateless stdio server**, explicitly set:

```yaml
server:
  transport: stdio
  protocol_version: 2026-07-28
  command: node
  args: [./mock-modern.mjs]
```

This runs `server/discover` instead of `initialize`, validates
`supportedVersions` and sends required per-request `_meta` fields with
protocol version, empty client capabilities and Canary client identity on
**every** list request. Results must be `resultType: complete`.
Legacy servers remain supported through their previous handshake.
This opt-in does not auto-downgrade or mask infrastructure faults.
This inspector is intentionally read-only; interactive MRTR
`input_required` results fail closed. An explicit 2026-era **Streamable HTTP** read-only inspector is also available:

```yaml
server:
  transport: streamable-http
  protocol_version: 2026-07-28
  url: https://trusted.example.com/mcp
  timeout_seconds: 15
```

It sends `MCP-Protocol-Version` and `Mcp-Method` headers with the same
required per-request `_meta`. Redirects, URL credentials, HTTP on
non-loopback interfaces and non-JSON (SSE) responses are rejected.
The client never forwards local API keys, cookies or authorization headers.
Local `http://127.0.0.1` is permitted for test fixtures.
Only use endpoints from explicitly trusted sources; untrusted contract
files can cause network requests. Session-based 2025 HTTP compatibility,
SSE subscriptions and interactive MRTR remain separate roadmap work.

## Snapshot a known-good server

```bash
claude-canary mcp-snapshot .canary/mcp/github.mcp.yml
```

The default output is:

```text
.canary/mcp/baselines/<contract-name>.json
```

A snapshot contains:

- negotiated protocol version
- non-secret server metadata
- capabilities
- tools and their normalized input/output JSON Schemas
- tool annotations
- prompts and argument definitions
- resource URIs and MIME types
- resource templates and MIME types
- observed `list_changed` notification counts during inspection
- a SHA-256 fingerprint of the compatibility surface

The fingerprint is verified when the snapshot is loaded. Editing a snapshot without regenerating its fingerprint makes the baseline invalid instead of silently changing the trusted contract.

## Check a server

```bash
claude-canary mcp-check .canary/mcp/github.mcp.yml
```

Canary always evaluates the explicit expectations in the YAML. If the default committed baseline exists, it also compares the live server against that baseline.

Require a committed baseline:

```bash
claude-canary mcp-check .canary/mcp/github.mcp.yml --require-baseline
```

Use a specific baseline:

```bash
claude-canary mcp-check .canary/mcp/github.mcp.yml \
  --baseline .canary/mcp/baselines/github-prod.json
```

Machine-readable output:

```bash
claude-canary mcp-check .canary/mcp/github.mcp.yml --json
```

## Compare two live server versions

Put the baseline and candidate launch commands in separate contract files and run:

```bash
claude-canary mcp-compare \
  .canary/mcp/github-v1.mcp.yml \
  .canary/mcp/github-v2.mcp.yml
```

Breaking by default:

- removed tool
- changed tool input/output schema
- changed tool annotations
- removed prompt
- changed prompt arguments
- removed resource or resource template
- MIME contract changes
- previously enabled boolean capability becoming disabled/missing

Reported as informational by default:

- newly added tools/prompts/resources/templates
- newly enabled capabilities
- negotiated protocol-version changes

The distinction keeps additive server growth from failing CI while still surfacing it in the report. Removing an entire advertised top-level capability is breaking even when that capability had no boolean sub-flags.

## Tool safety assertions

MCP tool annotations can be used as a contract signal:

```yaml
expect:
  tools:
    require_read_only:
      - list_orders
      - get_order
    deny_destructive: true
```

`require_read_only` requires `annotations.readOnlyHint: true` on the named tool. `deny_destructive` fails when any exposed tool declares `annotations.destructiveHint: true`.

These checks validate the server contract. They do not execute mutating tools. Model-driven invocation-policy testing is a separate future layer so contract inspection itself stays side-effect free.

## Pagination and dynamic-list signals

Canary follows MCP `nextCursor` pagination for tools, prompts, resources and resource templates, with a hard 100-page safety limit.

It also records these notifications when observed during the inspection window:

- `notifications/tools/list_changed`
- `notifications/prompts/list_changed`
- `notifications/resources/list_changed`

A declared `listChanged` capability is independently assertable in the contract. A later Canary release can add active refresh fixtures that deliberately cause a server to change its list and verify Claude Code's reaction end to end.

## CI example

```yaml
- name: Check MCP contract
  run: |
    # Install the verified v2.1.0 Release .tgz in your project first.
    npx --no-install claude-canary mcp-check .canary/mcp/github.mcp.yml --require-baseline
```

Commit the `.mcp.yml` file and its reviewed baseline. Do not commit credentials into the contract; reference only non-secret test-mode environment values and inject real secrets through the CI environment if the server truly needs them.

An MCP contract can launch an arbitrary local command. Treat contract files and the referenced server code as executable trusted CI input, just like Canary scenarios and build scripts. Do not run untrusted fork contracts with privileged environment credentials.
