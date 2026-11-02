#!/usr/bin/env node
// Copy this file into a fresh npm consumer project before running.
import assert from 'node:assert/strict';
import { access, mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// The npm tarball must contain both standalone utilities, not just the CLI.
const packageRoot = path.join(here, 'node_modules', 'claude-code-canary');
const dagPath = path.join(packageRoot, 'scripts', 'dag-orchestrator.mjs');
const historyPath = path.join(packageRoot, 'scripts', 'build-history-index.mjs');
await access(dagPath);
await access(historyPath);
const { validateDag, runDag } = await import(pathToFileURL(dagPath).href);
const nodes = validateDag({ version: 1, nodes: [{ id: 'check', kind: 'mcp-check', file: 'test.mcp.yml' }] });
const dagResult = await runDag(nodes, async () => ({ passed: true }), { concurrency: 1 });
assert.equal(dagResult.passed, true, 'packaged DAG scheduler should execute');
const historyDir = path.join(here, '.canary', 'results');
await mkdir(historyDir, { recursive: true });
await writeFile(path.join(historyDir, 'smoke.json'), JSON.stringify({ schemaVersion: 1, scenario: 'smoke', createdAt: '2026-01-01T00:00:00.000Z', passed: true, prompt: 'DO_NOT_PUBLISH' }));
const historyRun = spawnSync(process.execPath, [historyPath, historyDir], { cwd: here, encoding: 'utf8', timeout: 30_000 });
assert.equal(historyRun.status, 0, historyRun.stderr || historyRun.error?.message);
const indexed = JSON.parse(await readFile(path.join(historyDir, 'history-index.json'), 'utf8'));
assert.equal(indexed.entries, 1);
assert.doesNotMatch(JSON.stringify(indexed), /DO_NOT_PUBLISH|smoke/);
console.log('Packaged DAG/History binaries and privacy-safe history index verified.');
