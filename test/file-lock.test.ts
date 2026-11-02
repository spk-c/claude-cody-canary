import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { withFileLock } from '../src/file-lock.js';

describe('exclusive install lock', () => {
  it('serializes concurrent callers and removes the lock on success', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-lock-'));
    const lock = path.join(root, 'install.lock');
    let active = 0; let peak = 0;
    try {
      const jobs = Array.from({ length: 5 }, (_, i) => withFileLock(lock, async () => {
        active++; peak = Math.max(active, peak);
        await new Promise(resolve => setTimeout(resolve, 30));
        active--;
        return i;
      }, { retryMs: 5, waitMs: 5000 }));
      expect((await Promise.all(jobs)).sort()).toEqual([0, 1, 2, 3, 4]);
      expect(peak).toBe(1);
      await expect(readFile(lock)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('allows recovery from an expired abandoned lock', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-stale-lock-'));
    const lock = path.join(root, 'install.lock');
    try {
      await writeFile(lock, 'abandoned');
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(await withFileLock(lock, async () => 'recovered', { staleMs: 10, retryMs: 5 })).toBe('recovered');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('propagates operation EEXIST failures without silently retrying work', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-operation-error-'));
    const lock = path.join(root, 'install.lock');
    let attempts = 0;
    try {
      await expect(withFileLock(lock, async () => {
        attempts++;
        const error = new Error('Application file already exists') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }, { retryMs: 5, waitMs: 100 })).rejects.toThrow('Application file already exists');
      expect(attempts).toBe(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('stress-tests overlapping Windows exclusive lock contenders', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-stress-lock-'));
    const lock = path.join(root, 'install.lock');
    let active = 0;
    try {
      for (let round = 0; round < 8; round++) {
        const values = await Promise.all(Array.from({length: 10}, (_, i) =>
          withFileLock(lock, async () => {
            expect(++active).toBe(1);
            try { await new Promise(resolve => setTimeout(resolve, 2)); return i; }
            finally { active--; }
          }, {waitMs: 10_000, retryMs: 4})
        ));
        expect(values.sort((a,b) => a-b)).toEqual([0,1,2,3,4,5,6,7,8,9]);
      }
    } finally { await rm(root, {recursive:true,force:true}); }
  }, 30_000);
  it('times out rather than overriding an active lock', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-active-lock-'));
    const lock = path.join(root, 'install.lock');
    try {
      await writeFile(lock, 'active');
      await expect(withFileLock(lock, async () => 0, { staleMs: 10000, waitMs: 35, retryMs: 5 })).rejects.toThrow(/timed out/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
