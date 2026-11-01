# Release process for the source-restored fork

Current metadata is v2.1.0, but **there is no published release yet**.
The repo's GitHub Release workflow is deliberately gated. Do not interpret
a passing unit test suite or Claude CLI MCP smoke test as a full release gate.

## Preconditions

- Protect `main` and restrict who can merge or dispatch workflows (see
  [REPOSITORY_SECURITY.md](REPOSITORY_SECURITY.md)).
- All Source and security CI and CodeQL checks are green.
- `npm ci && npm run check && npm run check:dist` pass.
- `npm audit --audit-level=high` reports no high or critical advisories.
- The final release commit has a **successful authenticated** `Live Claude E2E
  (full)` workflow_dispatch run on `main`. The same exact SHA must be released.
- Changelog version and License/MIT attribution reviewed.

## GitHub Release (no npm publishing)

Open [Publish verified GitHub Release](../.github/workflows/release.yml)
and dispatch it **from main** with `version: v2.1.0` (or the version that
matches package.json) and `confirmation: PUBLISH`.

The workflow:
1. Checks current main SHA, tag syntax and version metadata.
2. Rebuilds and runs the complete test suite, package dry-run and security audit.
3. Queries GitHub Actions and requires a successful authenticated
   `Live Claude E2E (full)` run on the **exact same commit SHA**.
4. Creates the exact immutable `vX.Y.Z` tag if it does not already exist.
5. Publishes a GitHub Release containing an npm-compatible `.tgz` tarball
   and `SHA256SUMS`, or refuses to overwrite an existing release.

There is **no implicit npm publish or floating major alias update**. This
fork still has `"private": true` in package.json. Publishing to npm would
require a deliberately selected available scoped name, appropriate registry
ownership and configured npm Trusted Publishing. Do not remove `private`
or publish under the upstream package name without verifying ownership.

## Bumping the version

After committing a reviewed changelog entry, invoke:

```sh
npm run release:version -- 2.1.1
npm run build
npm run check
npm run check:dist
```

Commit the updated version source, package, lockfile and generated dist files.
Run `full` authenticated E2E on that resulting exact commit before publishing.
To correct an existing published release, create a new version rather than
rewriting tags or replacing artifacts.
