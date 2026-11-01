import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (!pkg.private) throw new Error('Distribution-only fork must remain private until publishing is configured.');
for (const target of [pkg.main, pkg.types, ...Object.values(pkg.bin ?? {})]) {
  if (!(await stat(path.resolve(root, target)).catch(() => null))?.isFile()) {
    throw new Error('Missing packaged entrypoint: ' + target);
  }
}
const scripts = await readdir(path.join(root, 'dist'));
let checked = 0;
for (const name of scripts.filter((file) => file.endsWith('.js')).sort()) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, 'dist', name)], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(name + ': ' + (result.stderr || result.stdout || result.error));
  }
  checked++;
}
if (!checked) throw new Error('No JavaScript distribution files found.');
console.log('Verified ' + checked + ' JavaScript modules and package entrypoints.');
