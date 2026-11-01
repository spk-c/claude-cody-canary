import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256FileMemoized, type CacheDigestMemo } from '../src/result-cache.js';

describe('bounded in-suite digest reuse', () => {
  it('reuses stable digests and invalidates them after a changed file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'canary-digest-'));
    try {
      const file=path.join(root,'test.txt');
      const memo:CacheDigestMemo=new Map();
      await writeFile(file,'before');
      const first=await sha256FileMemoized(file,memo);
      expect(await sha256FileMemoized(file,memo)).toBe(first);
      expect(memo.size).toBe(1);
      await writeFile(file,'after-updated-length');
      const changed=await sha256FileMemoized(file,memo);
      expect(changed).not.toBe(first);
      expect(changed).toBe(await sha256FileMemoized(file));
      expect((await readFile(file,'utf8'))).toBe('after-updated-length');
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it('does not use a memo for a removed file', async () => {
    const root=await mkdtemp(path.join(tmpdir(),'canary-digest-'));
    try {
      const file=path.join(root,'file.txt');
      const memo:CacheDigestMemo=new Map();
      await writeFile(file,'test');
      await sha256FileMemoized(file,memo);
      await rm(file);
      await expect(sha256FileMemoized(file,memo)).rejects.toThrow();
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
