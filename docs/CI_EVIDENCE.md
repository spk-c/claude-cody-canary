# Verified CI output snapshots

These are short excerpts from **actual completed GitHub Actions logs** on **2 November 2026**. They are historical verification examples, **not simulated output, screenshots, live status indicators or evidence of paid-model E2E**. For current status, follow the linked workflow runs.

## Source CI — main commit `cda4ff2479cd99d7e3c343a2d9bd3f87787277ea`

[Source and security CI run 41427744433](https://github.com/spk-c/claude-cody-canary/actions/runs/41427744433), Ubuntu / Node.js 22:

~~~text
Version metadata is synchronized at 2.2.0.
Test Files  53 passed (53)
Tests       211 passed (211)
Documentation link check passed: 43 Markdown files, 33 local links checked.
~~~

The first and last lines are verbatim log messages; the Vitest counts above have ANSI styling and padding removed for readability. They represent this **historical commit**, not the current number of files or tests.

## Clean consumer — packed development candidate

[Clean consumer run 41427744387](https://github.com/spk-c/claude-cody-canary/actions/runs/41427744387), [Ubuntu package-consumer job](https://github.com/spk-c/claude-cody-canary/actions/runs/41427744387/job/125218356190):

~~~text
Clean package consumer successfully imported API and ran CLI.
Packaged DAG/History binaries and privacy-safe history index verified.
~~~

The consumer test installed a new tarball from that exact source commit into a fresh directory. **It did not publish a v2.2.0 release.** The same workflow's Windows and macOS consumer jobs also completed successfully.

## Already published v2.1.1 composite Action

[Tagged Action test, run 41427744387](https://github.com/spk-c/claude-cody-canary/actions/runs/41427744387/job/125218356171) exercised the released tag and reported `CANARY_PASSED: true` for its offline MCP contract fixture.

## What these checks do not establish

- They do **not** prove that the manual, authenticated `core` or `full` Claude model E2E suites passed.
- These historical **pre-release** CI checks alone did not establish publication. Later publication evidence appears below.
- They do **not** assert comprehensive security or compatibility for untrusted scenario code.

See [live E2E](LIVE_E2E.md), [distribution](DISTRIBUTION.md) and [security](SECURITY_MODEL.md).

## v2.2.0 GitHub and npm publication (2026-11-02)

- [GitHub Release workflow 41494983662](https://github.com/spk-c/claude-cody-canary/actions/runs/41494983662) completed successfully, including source audit, checksum, tarball consumer verification and build provenance. [Immutable release v2.2.0](https://github.com/spk-c/claude-cody-canary/releases/tag/v2.2.0).
- [npm Trusted Publishing workflow 41495335373](https://github.com/spk-c/claude-cody-canary/actions/runs/41495335373) successfully ran `npm publish --provenance`, returning `+ claude-code-canary@2.2.0` and a [signed transparency-log entry](https://search.sigstore.dev/?logIndex=3645881951). **The overall workflow concluded failure** because its immediate `npm view` saw npm's temporary processing delay (404); this must not be described as an all-green run.
- After publication processing, a public npm Registry API check confirmed version `2.2.0` and the maintained fork repository URL. A separate clean Windows installation from the public npm registry verified CLI, API, DAG, History and privacy-safe history indexing. The npm `latest` dist-tag was `2.2.0`.

[PR #35](https://github.com/spk-c/claude-cody-canary/pull/35) corrects the post-publish retry behavior for future releases, without altering the immutable v2.2.0 tag.
