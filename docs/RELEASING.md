# Releasing the source-restored fork

The latest published fork release remains **v2.1.1**. The next candidate is
**v2.2.0**; prepare versioned source, lockfile and committed `dist/` together
and run the complete CI before publishing. A GitHub Release is
published only when the release workflow is manually triggered. Model-backed
Claude E2E and GitHub branch protection are **not** requirements.

## Release checks

- `npm ci`, `npm run check`, `npm run check:dist`, and the high-severity
  `npm audit` must succeed.
- All CI checks and CodeQL are expected to be green before publishing.
- The release version must match `package.json`.
- Review `CHANGELOG.md` and retain MIT license and attribution.
- Release CI generates a GitHub artifact build-provenance attestation for the `.tgz`.

## GitHub Release

Go to [Publish CI-verified GitHub Release](../.github/workflows/release.yml),
select branch `main`, and enter the newly prepared **`X.Y.Z` or `vX.Y.Z`**
(matching `package.json`) plus `confirmation: PUBLISH`. The workflow
normalizes both formats to a single immutable tag; a different version,
prerelease, arbitrary ref or invalid input is rejected.

The workflow:

1. Verifies that it is running on `main`, normalizes and validates the exact
   version, and checks the checkout SHA.
2. Installs locked dependencies, builds, runs tests, verifies the committed
   `dist/`, audits dependencies and checks the package tarball.
3. Creates the immutable exact version tag without replacing a preexisting tag.
4. Publishes a GitHub Release with the package `.tgz` and `SHA256SUMS`;
   it will not overwrite an existing release.

No API key or paid-model E2E run is needed. A model-backed `core` or `full`
test can still be run independently, but it does not gate publication. The
absence of such a test must not be mistaken for verified model compatibility.

## npm publication

`package.json` retains `"private": true`. See [npm ownership and trusted publishing](NPM_PUBLISHING.md). The release workflow creates a
GitHub Release, **not** an npm registry publication. A separately selected
package name, ownership verification and Trusted Publishing are needed before
adding npm publication.

## Future version updates

```sh
npm version 2.2.0 --no-git-tag-version
# Synchronize src/version.ts, regenerate and commit dist/ and package-lock.json.
npm run build
npm run check
npm run check:dist
```

Commit the source/version metadata and generated distribution together before
releasing. Do not rewrite existing tags; publish a new patch release for fixes.
