# GitHub repository protection (administrator action required)

GitHub currently reports `main` as **unprotected** with no enabled
rulesets. The GitHub connector available to this project can edit repository
code but cannot change administrator branch protection, secrets, environments,
or enable GitHub Advanced Security. Those settings are **not** activated by
committing this file.

## Required configuration

With a GitHub repository administrator account:

1. Open **Settings → Rules → Rulesets → New branch ruleset**.
2. Target default branch `main`, enforce the ruleset immediately.
3. Require a pull request before merging; require review if an eligible second
   reviewer exists. Require conversation resolution.
4. Require passing checks from **Source and security CI** (the `verify`
   matrix) and **CodeQL** once the checks have actually run. Use GitHub's
   suggested check names; do not invent required status contexts.
5. Block force pushes and deletion of `main`; restrict bypass permissions.
6. Restrict workflow modification approvals for outside collaborators if
   applicable. Do not grant release credentials to fork pull requests.
7. Under **Settings → Secrets and variables → Actions** add
   `ANTHROPIC_API_KEY` only for an account authorized to pay for real runs.
8. If available, configure a required-reviewer GitHub Actions environment
   for paid E2E/release jobs and associate those workflow jobs with it.

The live workflow checks `refs/heads/main` before execution but this is
**not a substitute for real branch protection**.

For security notifications, enable Dependabot alerts, dependency graph and
private vulnerability reporting under repository security settings where
available.

After configuring, check the GitHub API for `protected: true` and verify
that a test pull request cannot merge until CI is green. Record the date
and designated administrator in your private operations notes.

## Release constraints

The [publish workflow](../.github/workflows/release.yml) has
`contents: write` *only* for the job that explicitly creates tags/releases.
It can run only via manual dispatch on `main`, with `PUBLISH` confirmation
and exact-commit successful full-model evidence. Treat permission to
trigger this workflow as a release-signing authority.
