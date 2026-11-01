import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, symlink, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preparePermissionProbe } from '../dist/permission-probe.js';
import { inspectScenarioPack, installScenarioPack } from '../dist/packs.js';
import { createBundleAttestation, verifyBundleAttestation } from '../dist/attestation.js';
import { buildResultCacheIdentity } from '../dist/result-cache.js';
import { createReproBundle } from '../dist/repro-core.js';
import { inspectMcpContract, McpContractSchema } from '../dist/mcp-contract.js';

async function temp(t) {
  const { rm } = await import('node:fs/promises');
  const dir = await mkdtemp(path.join(tmpdir(), 'canary-security-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}
async function gitRepo(t) {
  const cwd = await temp(t);
  git(cwd, 'init', '-q');
  await writeFile(path.join(cwd, 'tracked.txt'), 'baseline\n');
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.name=Canary Test', '-c', 'user.email=canary@example.invalid', 'commit', '-qm', 'initial');
  return cwd;
}

test('permission instrumentation never auto-approves a tool request', async (t) => {
  const probe = await preparePermissionProbe({ expect: { permissions: { max_prompts: 0 } } });
  t.after(() => probe.cleanup());
  const script = path.join(probe.runtimeDir, 'scripts', 'permission-server.cjs');
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ...probe.env }, stdio: ['pipe', 'pipe', 'pipe']
  });
  const output = [];
  child.stdout.on('data', (chunk) => output.push(chunk));
  child.stdin.end(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'permission_request', arguments: {
      tool_name: 'Bash', tool_input: { command: 'echo should-not-run' }
    } }
  }) + '\n');
  const exit = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  assert.equal(exit, 0);
  const response = JSON.parse(Buffer.concat(output).toString('utf8').trim().split('\n')[0]);
  const decision = JSON.parse(response.result.content[0].text);
  assert.equal(decision.behavior, 'deny');
  assert.equal('updatedInput' in decision, false);
});

test('scenario packs refuse directory symlink traversal even when forced', async (t) => {
  const dir = await temp(t);
  const source = path.join(dir, 'source');
  const target = path.join(dir, 'target');
  const outside = path.join(dir, 'outside');
  await Promise.all([mkdir(path.join(source, 'nested'), {recursive:true}), mkdir(target), mkdir(outside)]);
  const data = 'test fixture\n';
  await writeFile(path.join(source, 'nested', 'fixture.txt'), data);
  const sha256 = createHash('sha256').update(data).digest('hex');
  await writeFile(path.join(source, 'canary-pack.yml'),
    'schemaVersion: 1\nname: safe\nversion: 1.0.0\nfiles:\n  - path: nested/fixture.txt\n    sha256: ' + sha256 + '\n');
  await inspectScenarioPack(source);
  await symlink(outside, path.join(target, 'nested'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installScenarioPack(source, target, { force: true }), /symlink/i);
  await assert.rejects(access(path.join(outside, 'fixture.txt')));
});

test('attestation verification rejects unexpected files', async (t) => {
  const dir = await temp(t);
  await writeFile(path.join(dir, 'good.txt'), 'good');
  const attestation = await createBundleAttestation(dir);
  assert.equal((await verifyBundleAttestation(dir, attestation)).passed, true);
  await writeFile(path.join(dir, 'hidden.txt'), 'extra');
  const verified = await verifyBundleAttestation(dir, attestation);
  assert.equal(verified.passed, false);
  assert.ok(verified.failures.some((message) => message.includes('Unattested bundle file')));
});

test('runtime config changes invalidate a reused result identity', async (t) => {
  const cwd = await gitRepo(t);
  await mkdir(path.join(cwd, '.claude'));
  const options = { cwd, scenarioSource: 'version: 1', executable: process.execPath };
  await writeFile(path.join(cwd, '.claude', 'settings.json'), '{"foo":1}');
  const before = await buildResultCacheIdentity(options);
  await writeFile(path.join(cwd, '.claude', 'settings.json'), '{"foo":2}');
  const after = await buildResultCacheIdentity(options);
  assert.notEqual(before.runtimeConfigHash, after.runtimeConfigHash);
  assert.equal(before.schemaVersion, 2);
});

test('repro --force refuses deletion of unowned existing directories', async (t) => {
  const cwd = await gitRepo(t);
  const sha = git(cwd, 'rev-parse', 'HEAD');
  const scenarioDir = path.join(cwd, '.canary');
  await mkdir(path.join(scenarioDir, 'results'), {recursive: true});
  await writeFile(path.join(scenarioDir, 'regression.canary.yml'),
    'version: 1\nname: regression\nprompt: test\n');
  const result = path.join(scenarioDir, 'results', 'failure.json');
  await writeFile(result, JSON.stringify({
    schemaVersion:1, scenario:'regression', passed:false,
    failures:['failed'], changedFiles:[], gitCommit:sha,
    createdAt: new Date().toISOString()
  }));
  const output = path.join(cwd, 'precious');
  await mkdir(output);
  await writeFile(path.join(output, 'keep.txt'), 'keep me');
  await assert.rejects(createReproBundle(result, {
    cwd, output, force:true
  }), /ownership marker/i);
  assert.equal(await readFile(path.join(output, 'keep.txt'), 'utf8'), 'keep me');
});

test('MCP server oversized stdout is rejected before JSON parsing', async (t) => {
  const cwd = await temp(t);
  const contract = McpContractSchema.parse({
    version: 1, name:'flood', server: {
      transport:'stdio', command:process.execPath,
      args:['-e', "process.stdout.write('X'.repeat(9 * 1024 * 1024))"],
      timeout_seconds:10
    }
  });
  await assert.rejects(inspectMcpContract(contract, {cwd}), /8 MiB|stdout frame/i);
});
