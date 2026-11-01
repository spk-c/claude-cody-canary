#!/usr/bin/env node
// Copy this file into a fresh npm consumer project before running.
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as canary from 'claude-code-canary';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'node_modules', 'claude-code-canary', 'dist', 'v2-cli.js');
await access(cli);
assert.ok(Object.keys(canary).length > 0, 'package root must expose API symbols');
for (const flag of ['--version','--help']) {
  const result = spawnSync(process.execPath, [cli, flag], {
    cwd: here, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.ok(result.stdout.trim().length > 0, `empty ${flag} output`);
  if (flag === '--version') assert.match(result.stdout, /\d+\.\d+\.\d+/);
}
console.log('Clean package consumer successfully imported API and ran CLI.');
