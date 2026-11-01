import test from 'node:test';
import assert from 'node:assert/strict';
import { findVerifiedFullE2E } from '../scripts/check-release-evidence.mjs';

const sha = 'a'.repeat(40);
const good = {
  event: 'workflow_dispatch', status: 'completed', conclusion: 'success',
  head_sha: sha, head_branch: 'main', display_title: 'Live Claude E2E (full)',
  html_url: 'https://github.com/example/repo/actions/runs/123',
};
test('successful manual full E2E at exact SHA unlocks release', () => {
  assert.equal(findVerifiedFullE2E({ workflow_runs: [good] }, sha)?.html_url, good.html_url);
});
for (const [name, field, value] of [
  ['core suite', 'display_title', 'Live Claude E2E (core)'],
  ['different commit', 'head_sha', 'b'.repeat(40)],
  ['wrong branch', 'head_branch', 'feature/untrusted'],
  ['failed run', 'conclusion', 'failure'],
  ['cancelled run', 'conclusion', 'cancelled'],
  ['uncompleted run', 'status', 'in_progress'],
  ['non-manual run', 'event', 'push'],
]) {
  test('release gate rejects ' + name, () => {
    assert.equal(findVerifiedFullE2E({ workflow_runs: [{ ...good, [field]: value }] }, sha), null);
  });
}
test('release gate fails closed on bad API response and invalid SHA', () => {
  assert.equal(findVerifiedFullE2E({}, sha), null);
  assert.equal(findVerifiedFullE2E({workflow_runs: [good]}, 'main'), null);
});
