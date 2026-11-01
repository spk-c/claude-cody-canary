import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// This marker proves that an existing fixture is owned by this test harness.
// Without it, --keep / CLAUDE_CANARY_E2E_DIR must never delete user files.
export const LIVE_FIXTURE_MARKER = '.claude-canary-live-fixture';
const MARKER_CONTENT = 'claude-canary disposable live e2e fixture v1\n';

function isChild(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function noSymlinkComponents(target) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const component of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error('Refusing symlink component in live E2E path: ' + current);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function assertSafeLocations(workRoot, repoRoot) {
  await noSymlinkComponents(workRoot);
  const actualWork = await realpath(workRoot);
  const actualRepo = await realpath(repoRoot);
  const fixture = path.join(actualWork, 'fixture');
  if (fixture === actualRepo || isChild(actualRepo, fixture) || isChild(fixture, actualRepo)) {
    throw new Error('Live E2E fixture cannot overlap the source repository.');
  }
  await noSymlinkComponents(fixture);
  return { root: actualWork, fixture };
}

async function requireOwnedFixture(fixture) {
  const info = await lstat(fixture);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error('Refusing to remove non-directory or symlinked live fixture.');
  }
  const markerPath = path.join(fixture, LIVE_FIXTURE_MARKER);
  const markerInfo = await lstat(markerPath).catch((error) => {
    if (error?.code === 'ENOENT') throw new Error('Refusing to remove unowned live fixture: ownership marker is missing.');
    throw error;
  });
  if (!markerInfo.isFile() || markerInfo.isSymbolicLink() ||
      await readFile(markerPath, 'utf8') !== MARKER_CONTENT) {
    throw new Error('Refusing to remove unowned live fixture: ownership marker is invalid.');
  }
}

export async function prepareLiveFixture(workRoot, repoRoot) {
  await noSymlinkComponents(workRoot);
  await mkdir(workRoot, { recursive: true });
  const { fixture } = await assertSafeLocations(workRoot, repoRoot);
  try {
    await requireOwnedFixture(fixture);
    await rm(fixture, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(fixture);
  await writeFile(path.join(fixture, LIVE_FIXTURE_MARKER), MARKER_CONTENT, 'utf8');
  return fixture;
}

export async function cleanupLiveFixture(workRoot, repoRoot, ownsWorkRoot) {
  const { root, fixture } = await assertSafeLocations(workRoot, repoRoot);
  try { await requireOwnedFixture(fixture); }
  catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await rm(fixture, { recursive: true, force: true });
  if (ownsWorkRoot) {
    // Root came from mkdtemp; it is owned by this process, never user supplied.
    await rm(root, { recursive: true, force: true });
  }
}
