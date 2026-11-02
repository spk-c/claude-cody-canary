import { appendFile } from 'node:fs/promises';
import { withFileLock } from '../../src/file-lock.js';

const [lock, trace] = process.argv.slice(2);
if (!lock || !trace) throw new Error('Lock worker requires lock and trace paths.');

for (let attempt = 0; attempt < 6; attempt++) {
  await withFileLock(lock, async () => {
    await appendFile(trace, `enter ${process.pid} ${attempt}\n`);
    await new Promise(resolve => setTimeout(resolve, 3));
    await appendFile(trace, `leave ${process.pid} ${attempt}\n`);
  }, { waitMs: 45_000, retryMs: 5 });
}
