import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDag, runDag, taskArgs } from '../scripts/dag-orchestrator.mjs';
import { summarizeHistoryArtifact, buildHistoryIndex, indexHistoryDirectory } from '../scripts/build-history-index.mjs';

const nodes=()=>validateDag({version:1,nodes:[
  {id:'one',kind:'mcp-check',file:'.github/fixtures/consumer-mcp.mcp.yml'},
  {id:'two',kind:'suite',file:'.canary/release.suite.yml',dependsOn:['one']},
  {id:'three',kind:'mcp-check',file:'.github/fixtures/consumer-mcp.mcp.yml',dependsOn:['one']},
]});
test('rejects cycles, unknown dependencies and directory traversal',()=>{
  assert.throws(()=>validateDag({version:1,nodes:[{id:'a',kind:'suite',file:'a',dependsOn:['b']},{id:'b',kind:'suite',file:'b',dependsOn:['a']}]}),/cycle/);
  assert.throws(()=>validateDag({version:1,nodes:[{id:'a',kind:'suite',file:'../../private'}]}),/safe relative/);
  assert.throws(()=>validateDag({version:1,nodes:[{id:'a',kind:'suite',file:'a',dependsOn:['missing']}]}),/Invalid dependency/);
});
test('runs dependency DAG with bounded concurrency and deterministic ordering',async()=>{
  const seen=[];
  const result=await runDag(nodes(),async node=>{seen.push(node.id);return {passed:true,exitCode:0,durationMs:1}},{concurrency:2});
  assert.deepEqual(seen.slice(0,1),['one']);
  assert.equal(result.passed,true);
  assert.deepEqual(result.results.map(x=>x.id),['one','two','three']);
  assert.deepEqual(taskArgs(nodes()[0]),['mcp-check','.github/fixtures/consumer-mcp.mcp.yml','--json']);
});
test('skips dependent tasks on failure and does not execute them',async()=>{
  const seen=[];
  const result=await runDag(nodes(),async node=>{seen.push(node.id);return {passed:false,exitCode:2}},{concurrency:2});
  assert.deepEqual(seen,['one']);
  assert.equal(result.failedCount,1);
  assert.equal(result.skippedCount,2);
});
test('history extracts only safe, compact metadata and drops prompts/credentials',()=>{
  const row=summarizeHistoryArtifact({schemaVersion:1,scenario:'secret scenario',createdAt:'2026-01-01T10:00:00Z',
    passed:false,gitCommit:'a'.repeat(40),prompt:'API_KEY=SHOULD_NOT_LEAK',env:{SECRET:'SHOULD_NOT_LEAK'}});
  const idx=buildHistoryIndex([row]);
  assert.equal(idx.counts.runFailures,1);
  assert.doesNotMatch(JSON.stringify(idx),/SHOULD_NOT_LEAK|secret scenario/);
  assert.match(idx.contentSha256,/^[0-9a-f]{64}$/);
});
test('history indexes existing files without reading arbitrary media',async t=>{
  const dir=await mkdtemp(path.join(await realpath(tmpdir()),'canary-history-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(path.join(dir,'run.json'),JSON.stringify({schemaVersion:1,scenario:'basic',createdAt:'2026-01-01T12:00:00Z',passed:true}));
  await writeFile(path.join(dir,'other.json'),JSON.stringify({schemaVersion:2,private:'secret'}));
  const out=path.join(dir,'history-index.json');
  const first=await indexHistoryDirectory(dir,out);
  const second=await indexHistoryDirectory(dir,out);
  assert.deepEqual(first,second);
  assert.equal(first.entries,1);
  assert.equal((JSON.parse(await readFile(out,'utf8'))).counts.runs,1);
});
