import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDetachedWorktree,
  getChangedFiles,
  getHeadCommit,
  getRepoRoot,
  getTrackedChanges,
} from '../src/git.js';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 20_000 }).trim();
}

describe('cross-platform Git worktree paths', () => {
  it('creates and cleans a detached worktree from a repository path containing spaces', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'canary git path '));
    const cwd = path.join(parent, 'project with spaces');
    let worktree: Awaited<ReturnType<typeof createDetachedWorktree>> | undefined;
    try {
      await mkdir(cwd);
      git(cwd, 'init', '-q');
      git(cwd, 'config', 'user.name', 'Canary Tests');
      git(cwd, 'config', 'user.email', 'canary@example.invalid');
      await writeFile(path.join(cwd, 'tracked.txt'), 'before\n', 'utf8');
      git(cwd, 'add', '.');
      git(cwd, 'commit', '-qm', 'first');
      expect(path.resolve(await getRepoRoot(cwd))).toBe(path.resolve(cwd));
      const head = await getHeadCommit(cwd);
      worktree = await createDetachedWorktree(cwd, head);
      expect(await getHeadCommit(worktree.path)).toBe(head);
      expect(await readFile(path.join(worktree.path, 'tracked.txt'), 'utf8')).toBe('before\n');
      await writeFile(path.join(worktree.path, 'tracked.txt'), 'after\n');
      await writeFile(path.join(worktree.path, 'new untracked.txt'), 'new\n');
      expect((await getTrackedChanges(worktree.path)).map((status) => status.trim())).toEqual(['M tracked.txt']);
      expect(await getChangedFiles(worktree.path)).toEqual(['new untracked.txt', 'tracked.txt']);
      await worktree.cleanup();
      worktree = undefined;
      expect(git(cwd, 'worktree', 'list', '--porcelain')).not.toContain('cc-canary-');
      expect(await getTrackedChanges(cwd)).toEqual([]);
    } finally {
      if (worktree) await worktree.cleanup();
      await rm(parent, { recursive: true, force: true });
    }
  });
});
