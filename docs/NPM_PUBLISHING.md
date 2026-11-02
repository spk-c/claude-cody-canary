# Optional npm publication — ownership gate

This source-restored fork currently distributes **GitHub Release tarballs**, not npm registry releases. The package remains private by design to prevent accidental publication to a package name controlled by somebody else.

## Preconditions before enabling npm publish

1. Choose an npm package name **owned by the maintainer** (prefer a verified scope), check availability and verify `npm owner ls <name>` / npm organization access. Neither a GitHub username nor repository ownership proves npm namespace control.
2. Configure npm Trusted Publishing (OIDC) for this exact GitHub repository and the publishing workflow, with minimal `id-token: write` and no long-lived npm token. Ensure npm provenance and 2FA policies are satisfied.
3. Update `package.json` name and `package-lock.json` root package metadata in one reviewed change. Update import smoke tests, documentation and any consumers because renaming affects module imports.
4. Remove `private: true` **only after** verified ownership and publishing configuration. Add a dedicated manually dispatched, immutable-tag-only publish workflow with an explicit confirmation gate. It must validate the tag and commit, run all checks, inspect `npm pack` and use `npm publish --provenance --access public` without a stored npm automation token.
5. Install the actually published package in a clean consumer and verify API imports, both standalone utilities, checksums and intended version. Do not claim npm publication from a successful dry run.

GitHub Release publishing is independently available and must not be blocked by the optional npm channel. The v2.2.0 release candidate does **not** silently claim npm availability.
