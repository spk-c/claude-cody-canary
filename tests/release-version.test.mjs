import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeReleaseTag } from '../scripts/normalize-release-version.mjs';

const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const tag = `v${packageVersion}`;

for (const value of [packageVersion, `v${packageVersion}`]) {
  test(`accepts ${value} and normalizes to ${tag}`, () => {
    assert.equal(normalizeReleaseTag(value, packageVersion), tag);
  });
}
for (const value of [
  '', 'v', 'v2.1', '2.1', 'vv2.1.1', 'V2.1.0', ' v2.1.1',
  'v2.1.1 ', 'v2.1.1-beta.1', '2.1.0+build', 'v2.1.1/other',
  '$(echo unsafe)', '--help', '../v2.1.1', 'v2.1.1\nfoo=bar',
]) {
  test(`rejects malformed input ${JSON.stringify(value)}`, () => {
    assert.throws(() => normalizeReleaseTag(value, '2.1.1'), /Version must/);
  });
}
test('rejects a version that does not match the package', () => {
  assert.throws(() => normalizeReleaseTag('v2.1.2', '2.1.1'), /mismatch/);
  assert.throws(() => normalizeReleaseTag('2.0.0', '2.1.1'), /mismatch/);
});
test('rejects invalid or prerelease package metadata', () => {
  assert.throws(() => normalizeReleaseTag('v2.1.1', '2.1.0-rc.1'), /stable/);
  assert.throws(() => normalizeReleaseTag('v2.1.1', undefined), /stable/);
});
test('CLI emits a safe GitHub Actions output in either accepted form', () => {
  const entry = fileURLToPath(new URL('../scripts/normalize-release-version.mjs', import.meta.url));
  for (const input of [packageVersion, `v${packageVersion}`]) {
    const result = spawnSync(process.execPath, [entry, input], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `tag=${tag}\n`);
  }
});
test('CLI fails on a mismatched version without producing an output', () => {
  const entry = fileURLToPath(new URL('../scripts/normalize-release-version.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry, '9.9.9'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /mismatch/);
});

test('npm publication keeps the original package name without accidental private flag', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'claude-code-canary');
  assert.notEqual(pkg.private, true);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.version, pkg.version);
});

test('npm release workflow requires trusted OIDC, manual approval and verified GitHub release', () => {
  const source = readFileSync(new URL('../.github/workflows/npm-publish.yml', import.meta.url), 'utf8');
  for (const requirement of [
    'workflow_dispatch:', 'id-token: write', "test \"$GITHUB_REF\" = 'refs/heads/main'",
    'PUBLISH_NPM', 'gh release view', 'git merge-base --is-ancestor',
    'npm run check', 'npm run check:dist', 'npm audit --audit-level=high',
    'sha256sum --check SHA256SUMS', 'cmp "$RUNNER_TEMP/github-release-pack/',
    'package-consumer-smoke.mjs', 'npm publish --provenance --access public',
    'for attempt in $(seq 1 24)', 'npm view "claude-code-canary@${VERSION}" version --prefer-online',
    'for attempt in $(seq 1 8)',
  ]) {
    assert.ok(source.includes(requirement), 'Missing npm publish safety contract: ' + requirement);
  }
  assert.doesNotMatch(source, /secrets\.NPM_TOKEN|secrets\.NODE_AUTH_TOKEN|secrets\.NPMJS_TOKEN/);
});
