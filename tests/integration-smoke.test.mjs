import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSafeMcpFixture } from '../dist/mcp-fixtures.js';
import { McpContractSchema, inspectMcpContract } from '../dist/mcp-contract.js';
import { spawnCapture } from '../dist/process.js';

test('real stdio MCP fixture performs initialize and tools/list', async (t) => {
  const fixture = await createSafeMcpFixture('annotations');
  t.after(() => fixture.cleanup());
  const contract = McpContractSchema.parse({
    version:1, name:'ci-mcp-stdio',
    server:{ transport:'stdio',command:fixture.command,args:fixture.args,timeout_seconds:15 },
    expect:{tools:{require:['read_state','safe_write','declared_mutation']}}
  });
  const result = await inspectMcpContract(contract);
  assert.ok(result.tools.some((tool) => tool.name === 'read_state'));
  assert.ok(result.tools.some((tool) => tool.name === 'safe_write'));
});

test('CLI --help and --version execute from rebuilt distribution', async () => {
  const entry = path.resolve('dist/v2-cli.js');
  for (const args of [['--help'],['--version']]) {
    const result = await spawnCapture(process.execPath,[entry,...args],{cwd:process.cwd(),timeoutMs:20000});
    assert.equal(result.code,0,result.stderr);
    assert.ok(result.stdout.trim().length>0);
  }
});
