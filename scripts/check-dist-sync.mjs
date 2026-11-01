#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
const commands = [
  ['diff', '--name-only', '--', 'dist'],
  ['ls-files', '--others', '--exclude-standard', '--', 'dist'],
];
const changed = [];
for (const args of commands) {
  const result = execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (result) changed.push(...result.split(/\r?\n/));
}
if (changed.length) {
  console.error('Built dist/ differs from committed distribution:');
  for (const name of [...new Set(changed)].sort()) console.error(' - ' + name);
  console.error('Run npm run build, review changes and commit the generated dist files.');
  process.exitCode = 1;
} else {
  console.log('Built dist/ matches the tracked distribution.');
}
