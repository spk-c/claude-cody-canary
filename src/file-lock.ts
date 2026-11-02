import { lstat, open, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * Windows can deny an exclusive create while another handle is in the
 * delete-pending state. lstat can simultaneously report ENOENT or EPERM.
 * Retry only if a separate exclusive probe proves the parent is writable.
 * A permanently ACL-denied lock path is still rejected after a short cap.
 */
async function windowsTransientContention(file: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EPERM' && code !== 'EACCES') return false;
    const probe = path.join(path.dirname(file), `.canary-probe-${process.pid}-${randomUUID()}`);
    let handle;
    try {
      handle = await open(probe, 'wx', 0o600);
      return true;
    } catch {
      return false;
    } finally {
      await handle?.close();
      if (handle) await rm(probe, {force:true,maxRetries:5,retryDelay:25});
    }
  }
}

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
  let consecutiveTransientErrors = 0;
  for (;;) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        if ((code !== 'EPERM' && code !== 'EACCES') || !await windowsTransientContention(lockPath)) throw error;
        // Do not indefinitely reinterpret a persistent ACL issue as contention.
        if (++consecutiveTransientErrors > 30) throw error;
      } else {
        consecutiveTransientErrors = 0;
      }
    }
    if (handle) {
      try {
        await handle.writeFile(`${process.pid}\n`);
        return await operation();
      } finally {
        await handle.close();
        await rm(lockPath, { force: true, maxRetries: 5, retryDelay: 25 });
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
      const code = (error as NodeJS.ErrnoException).code;
      // On Windows a concurrent close/delete can temporarily deny stat()
      // even when the exclusive create correctly identified contention.
      // Only retry after confirming the directory remains writable, and
      // preserve genuine permission failures instead of masking them.
      if (code !== 'ENOENT') {
        if ((code !== 'EPERM' && code !== 'EACCES') ||
            !await windowsTransientContention(lockPath) ||
            ++consecutiveTransientErrors > 30) throw error;
      }
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for install lock ${lockPath}`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryMs, deadline - Date.now())));
  }
}
