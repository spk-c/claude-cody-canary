import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeReleaseTag } from '../scripts/normalize-release-version.mjs';

for (const value of ['2.1.0', 'v2.1.0']) {
  test(`accepts ${value} and normalizes to v2.1.0`, () => {
    assert.equal(normalizeReleaseTag(value, '2.1.0'), 'v2.1.0');
  });
}
for (const value of [
  '', 'v', 'v2.1', '2.1', 'vv2.1.0', 'V2.1.0', ' v2.1.0',
  'v2.1.0 ', 'v2.1.0-beta.1', '2.1.0+build', 'v2.1.0/other',
  '$(echo unsafe)', '--help', '../v2.1.0', 'v2.1.0\nfoo=bar',
]) {
  test(`rejects malformed input ${JSON.stringify(value)}`, () => {
    assert.throws(() => normalizeReleaseTag(value, '2.1.0'), /Version must/);
  });
}
test('rejects a version that does not match the package', () => {
  assert.throws(() => normalizeReleaseTag('v2.1.1', '2.1.0'), /mismatch/);
  assert.throws(() => normalizeReleaseTag('2.0.0', '2.1.0'), /mismatch/);
});
test('rejects invalid or prerelease package metadata', () => {
  assert.throws(() => normalizeReleaseTag('v2.1.0', '2.1.0-rc.1'), /stable/);
  assert.throws(() => normalizeReleaseTag('v2.1.0', undefined), /stable/);
});
test('CLI emits a safe GitHub Actions output in either accepted form', () => {
  const entry = fileURLToPath(new URL('../scripts/normalize-release-version.mjs', import.meta.url));
  for (const input of ['2.1.0', 'v2.1.0']) {
    const result = spawnSync(process.execPath, [entry, input], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'tag=v2.1.0\n');
  }
});
test('CLI fails on a mismatched version without producing an output', () => {
  const entry = fileURLToPath(new URL('../scripts/normalize-release-version.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry, '9.9.9'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /mismatch/);
});
