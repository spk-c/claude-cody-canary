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
- They do **not** establish that version 2.2.0 is already published on GitHub Releases or the npm registry.
- They do **not** assert comprehensive security or compatibility for untrusted scenario code.

See [live E2E](LIVE_E2E.md), [distribution](DISTRIBUTION.md) and [security](SECURITY_MODEL.md).
