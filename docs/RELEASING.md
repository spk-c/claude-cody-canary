# Releasing the source-restored fork

The latest published GitHub Release and npm package are **v2.2.0** (2026-11-02). For future releases, update source, lockfile and committed `dist/` together, run CI, and manually publish an immutable release. Model-backed
Claude E2E and GitHub branch protection are **not** requirements.

## Release checks

- `npm ci`, `npm run check`, `npm run check:dist`, and the high-severity
  `npm audit` must succeed.
- All CI checks and CodeQL are expected to be green before publishing.
- The release job itself installs the exact candidate tarball in a disposable consumer and runs the CLI/API, DAG and History checks before tagging.
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

The name `claude-code-canary` is owned by the original npm maintainer `slp-dev1` and remains unchanged. npm publication has its own manually triggered [Trusted Publishing workflow](../.github/workflows/npm-publish.yml), and **successfully published v2.2.0 on 2026-11-02**. For each future version, publish the immutable GitHub Release first and then dispatch the npm workflow with `confirmation=PUBLISH_NPM`. Never republish an existing npm version. The original 2.2.0 workflow's immediate Registry verification saw processing lag; an independent public registry installation subsequently passed. See [exact npm setup and troubleshooting](NPM_PUBLISHING.md).

## Future version updates

```sh
npm version 2.2.1 --no-git-tag-version  # example for a future patch release
# Synchronize src/version.ts, regenerate and commit dist/ and package-lock.json.
npm run build
npm run check
npm run check:dist
```

Commit the source/version metadata and generated distribution together before
releasing. Do not rewrite existing tags; publish a new patch release for fixes.
