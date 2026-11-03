# npm publishing — existing claude-code-canary package

**Historical v2.2.0 publish (2026-11-02):** The original unscoped npm package [`claude-code-canary`](https://www.npmjs.com/package/claude-code-canary) has been updated to **2.2.0**, with npm maintainer **`slp-dev1`**. The [OIDC publish run 41495335373](https://github.com/spk-c/claude-cody-canary/actions/runs/41495335373) accepted `+ claude-code-canary@2.2.0` and published [signed provenance](https://search.sigstore.dev/?logIndex=3645881951). Its immediate final `npm view` failed while npm processed the package; a later public Registry API read and independent clean Windows installation **succeeded**, verifying CLI/API/DAG/History. **No second publish was performed.**

The repository keeps the **same package name**, `claude-code-canary`, with GitHub repository metadata pointing to `https://github.com/spk-c/claude-cody-canary`. It remains a clearly attributed independent source-restored MIT fork; updating npm metadata does not imply official Anthropic endorsement.

## Current publication and Trusted Publisher settings

**Verified current version:** [`claude-code-canary@2.4.0`](https://www.npmjs.com/package/claude-code-canary/v/2.4.0) was published by the repository's OIDC Trusted Publishing workflow on 2026-11-03. The GitHub release, checksum and clean registry consumer passed independent verification. The 2.2.0 notes above are retained only as publishing history.

1. Sign in at [npmjs.com](https://www.npmjs.com/) with **`slp-dev1`** (the current package owner) and enable account 2FA if not already enabled. This cannot be completed using GitHub permissions alone.
2. Open [the package on npm](https://www.npmjs.com/package/claude-code-canary), choose **Settings → Trusted publishing → Add trusted publisher → GitHub Actions**.
3. Enter these values **exactly** (case sensitive):
   - **Organization or user:** `spk-c`
   - **Repository:** `claude-cody-canary`
   - **Workflow filename:** `npm-publish.yml` (filename only, no path)
   - **Environment:** leave empty (this workflow does not declare an environment)
   - **Allowed actions:** enable **Allow `npm publish`**. `npm stage publish` alone is insufficient. Grant `npm dist-tag` only if a separate workflow ever needs it.
4. Save the Trusted Publisher. **A new configuration expires if no successful publish occurs within two days**; complete the first publication promptly, or create a fresh connection when ready.

GitHub's workflow is configured to use **npm 11.19.1 on Node.js 24**, a GitHub-hosted Ubuntu runner, `id-token: write`, and **no long-lived npm token**. npm OIDC requires npm >=11.5.1, Node >=22.14 and a configured Trusted Publisher matching the workflow.

After the first successful trusted publish, consider **Settings → Publishing access → Require two-factor authentication and disallow tokens** on npm. Traditional tokens are not required by this workflow.

## Publication order for future versions

**v2.4.0 is published on GitHub and npm as of 2026-11-03. Do not republish an immutable version.** For a new release:

1. Merge the changes to `main`, verify that all CI checks and the tagged release packaging tests are green.
2. Publish the next **immutable GitHub Release (for example `v2.4.1`)** using [.github/workflows/release.yml](../.github/workflows/release.yml), from `main` with `version=<next-version>` and `confirmation=PUBLISH`. This creates the exact tarball and `SHA256SUMS` and checks its source and contents. Do not silently rewrite `v2.1.1` or an existing npm version.
3. Once npm Trusted Publishing is configured for the exact workflow filename, use **[Publish npm (trusted OIDC)](../.github/workflows/npm-publish.yml)** from `main` with `version=<next-version>` and `confirmation=PUBLISH_NPM`.
4. The npm workflow requires the published, non-draft GitHub Release, the exact corresponding Git tag, and a successful clean build and test of that tag. It compares the built tarball **byte-for-byte** with the previously published GitHub Release asset and verifies its checksum before calling `npm publish --provenance --access public` via GitHub OIDC.
5. The workflow waits for npm registry propagation, then verifies the new npm version and installs it into a clean consumer, checking CLI, API, DAG and History utilities.

If any validation fails, **npm publication must not happen**. A successful GitHub Release and a successful `npm pack` alone do **not** mean that npm was updated.

Install the current published v2.4.0 release:

```sh
npm install --global claude-code-canary@2.4.0
claude-canary --version
```

`claude-canary-dag` and `claude-canary-history` are the other two installed commands. When making the next version, increase the version in `package.json`, lockfile, source and committed `dist/` together, and publish a **new immutable release**.

## Troubleshooting

- **npm 403 / permission denied:** Confirm that `slp-dev1` still owns the package and that Trusted Publishing was configured in that package's Settings. GitHub ownership alone cannot grant npm write access.
- **npm 404 / OIDC exchange refused:** Confirm `spk-c`, `claude-cody-canary`, `npm-publish.yml`, any optional environment and the **Allow npm publish** setting exactly match. Check whether the Trusted Publisher has expired.
- **GitHub Release missing / checksum mismatch:** Publish the expected immutable release first; do not bypass artifact verification or point a tag at different code.
- **Version already exists:** npm versions are immutable; publish a higher unused version instead.
- **Publish returned success but immediate npm view returned 404:** npm may take several minutes to process and propagate a newly published package. **Do not republish the same version**. Check the GitHub log for `+ claude-code-canary@X.Y.Z` and signed provenance; then retry a fresh npm registry read and clean installation. The verification workflow on `main` now waits for bounded registry propagation.
- **No model-backed tests:** Successful source/consumer CI does not imply that the optional paid Anthropic API E2E has run.

See [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/) and [release instructions](RELEASING.md).
