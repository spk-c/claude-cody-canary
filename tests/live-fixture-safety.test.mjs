import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareLiveFixture, cleanupLiveFixture, LIVE_FIXTURE_MARKER } from '../scripts/live-fixture-safety.mjs';

async function roots(t) {
  const base = await mkdtemp(path.join(tmpdir(), 'canary-live-safety-'));
  t.after(() => rm(base, { recursive:true, force:true }));
  const repoRoot = path.join(base, 'repo');
  const workRoot = path.join(base, 'work');
  await mkdir(repoRoot);
  await mkdir(workRoot);
  return { base, repoRoot, workRoot };
}

test('fresh fixture is owned and can be safely rerun without deleting workRoot peers', async (t) => {
  const { repoRoot, workRoot } = await roots(t);
  const fixture = await prepareLiveFixture(workRoot, repoRoot);
  assert.equal(await readFile(path.join(fixture, LIVE_FIXTURE_MARKER), 'utf8'),
    'claude-canary disposable live e2e fixture v1\n');
  await writeFile(path.join(fixture,'generated.txt'),'owned');
  await writeFile(path.join(workRoot,'important.txt'),'preserved');
  assert.equal(await prepareLiveFixture(workRoot,repoRoot),fixture);
  await assert.rejects(access(path.join(fixture,'generated.txt')));
  await cleanupLiveFixture(workRoot,repoRoot,false);
  await assert.rejects(access(fixture));
  assert.equal(await readFile(path.join(workRoot,'important.txt'),'utf8'),'preserved');
});

test('unowned fixture cannot be overwritten or cleaned', async (t) => {
  const { repoRoot, workRoot } = await roots(t);
  const fixture = path.join(workRoot,'fixture');
  await mkdir(fixture);
  await writeFile(path.join(fixture,'private.txt'),'do not delete');
  await assert.rejects(prepareLiveFixture(workRoot,repoRoot),/ownership marker/i);
  await assert.rejects(cleanupLiveFixture(workRoot,repoRoot,false),/ownership marker/i);
  assert.equal(await readFile(path.join(fixture,'private.txt'),'utf8'),'do not delete');
});

test('forged marker is refused', async (t) => {
  const { repoRoot, workRoot } = await roots(t);
  const fixture = path.join(workRoot,'fixture');
  await mkdir(fixture);
  await writeFile(path.join(fixture,LIVE_FIXTURE_MARKER),'not owned');
  await assert.rejects(prepareLiveFixture(workRoot,repoRoot),/ownership marker/i);
});

test('symlinked fixture never removes its outside target', async (t) => {
  const { base, repoRoot, workRoot } = await roots(t);
  const outside = path.join(base,'outside');
  await mkdir(outside);
  await writeFile(path.join(outside,'private.txt'),'keep');
  await symlink(outside,path.join(workRoot,'fixture'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(prepareLiveFixture(workRoot,repoRoot),/symlink/i);
  assert.equal(await readFile(path.join(outside,'private.txt'),'utf8'),'keep');
});

test('live fixtures inside source repository are forbidden', async (t) => {
  const { repoRoot, workRoot } = await roots(t);
  await assert.rejects(prepareLiveFixture(repoRoot, repoRoot),/overlap/i);
  // The repo may not be placed inside the disposable fixture either.
  await mkdir(path.join(workRoot,'fixture'),{recursive:true});
  const nestedRepo = path.join(workRoot,'fixture','source');
  await mkdir(nestedRepo);
  await assert.rejects(prepareLiveFixture(workRoot,nestedRepo),/overlap/i);
});
