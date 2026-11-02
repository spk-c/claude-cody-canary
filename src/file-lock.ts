import { lstat, open, rm, stat } from 'node:fs/promises';

export interface FileLockOptions {
  waitMs?: number;
  staleMs?: number;
  retryMs?: number;
}

/** Exclusive lock across Node processes; only expired abandoned locks may be reclaimed. */
export async function withFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  { waitMs = 180_000, staleMs = 15 * 60_000, retryMs = 100 }: FileLockOptions = {},
): Promise<T> {
  if (waitMs < 1 || staleMs < 1 || retryMs < 1) throw new Error('Invalid file lock timing.');
  const deadline = Date.now() + waitMs;
  for (;;) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        // Windows may surface a sharing violation as EPERM/EACCES during
        // exclusive-file creation. Treat it as contention ONLY when an
        // existing regular lock was independently observed. Other permission
        // failures must propagate.
        if (process.platform !== 'win32' || (code !== 'EPERM' && code !== 'EACCES')) throw error;
        try {
          const existing = await lstat(lockPath);
          if (!existing.isFile() || existing.isSymbolicLink()) throw error;
        } catch (inspectionError) {
          if (inspectionError === error) throw error;
          if ((inspectionError as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          // The contender released the lock between open() and lstat().
          // Do not pretend that arbitrary permission failures are safe.
          throw error;
        }
      }
    }
    if (handle) {
      try {
        await handle.writeFile(`${process.pid}\n`);
        return await operation();
      } finally {
        await handle.close();
        await rm(lockPath, { force: true });
      }
    }
    try {
      const info = await stat(lockPath);
      if (Date.now() - info.mtimeMs > staleMs) {
        // An interrupted install may leave a lock. Reclaim only after its
        // maximum download deadline plus a safety margin has elapsed.
        await rm(lockPath, { force: true });
        continue;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for install lock ${lockPath}`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryMs, deadline - Date.now())));
  }
}
