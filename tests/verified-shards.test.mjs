import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { combineVerifiedShards } from '../scripts/verified-shard-combine.mjs';

function fixtures(count=12, parts=3, { fail=false, filtered=false }={}) {
  const paths = Array.from({length:count},(_,i)=>`case-${String(i).padStart(4,'0')}.canary.yml`);
  return Array.from({length:parts},(_,i)=>{
    const scenarios = paths.filter((p,n)=>!filtered || n!==1)
      .filter((p)=> paths.indexOf(p)%parts===i)
      .map(p=>({path:p,passed:!(fail && p===paths[0]),cacheHit:false}));
    const skipped = paths.filter((p,n)=>filtered && n===1 || n%parts!==i)
      .map(p=>({path:p,reason:filtered && p===paths[1]?'tag':'shard'}));
    return {
      schemaVersion:1,suite:'large-suite',suitePath:'.canary/suite.yml',
      createdAt:'2026-01-01T00:00:00Z',shard:`${i+1}/${parts}`,
      tag:filtered?'smoke':undefined,passed:scenarios.every(s=>s.passed),
      total:scenarios.length,discoveredTotal:count,
      passedCount:scenarios.filter(s=>s.passed).length,
      failedCount:scenarios.filter(s=>!s.passed).length,
      infrastructureFailedCount:0,cacheHitCount:0,
      skippedBySelection:skipped.length,skipped,scenarios,failureClusters:[],
    };
  });
}
test('combines all shard outputs deterministically',()=>{
  const result=combineVerifiedShards(fixtures());
  assert.equal(result.total,12);
  assert.equal(result.discoveredTotal,12);
  assert.equal(result.passed,true);
  assert.deepEqual(result.scenarios.map(s=>s.path),Array.from({length:12},(_,i)=>`case-${String(i).padStart(4,'0')}.canary.yml`));
});
test('preserves global tag exclusions exactly once',()=>{
  const result=combineVerifiedShards(fixtures(12,3,{filtered:true}));
  assert.equal(result.total,11);
  assert.equal(result.skippedBySelection,1);
  assert.equal(result.skipped[0].reason,'tag');
  assert.equal(result.passed,true);
});
test('preserves true failing scenarios without claiming an all-pass result',()=>{
  const result=combineVerifiedShards(fixtures(12,3,{fail:true}));
  assert.equal(result.passed,false);
  assert.equal(result.failedCount,1);
});
test('rejects missing, duplicate, and incompatible shards',()=>{
  const a=fixtures();
  assert.throws(()=>combineVerifiedShards(a.slice(1)),/Expected 3 shards/);
  assert.throws(()=>combineVerifiedShards([a[0],a[0],a[2]]),/Duplicate/);
  assert.throws(()=>combineVerifiedShards([{...a[0],tag:'bad'},a[1],a[2]]),/metadata/);
  assert.throws(()=>combineVerifiedShards([{...a[0],discoveredTotal:11},a[1],a[2]]),/metadata|coverage/);
});
test('rejects fail-fast incomplete selections and duplicated scenarios',()=>{
  const a=fixtures();
  a[0].scenarios.pop();
  a[0].total--;
  a[0].passedCount--;
  assert.throws(()=>combineVerifiedShards(a),/coverage/);
  const b=fixtures();
  b[1].scenarios.push({...b[0].scenarios[0]});
  b[1].total++;
  b[1].passedCount++;
  assert.throws(()=>combineVerifiedShards(b),/Duplicate/);
});
test('CLI validates inputs and writes machine-readable/Markdown output',async t=>{
  const dir=await mkdtemp(path.join(await realpath(tmpdir()),'canary-shards-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const entries=fixtures();
  const inputs=[];
  for(let i=0;i<entries.length;i++){
    const file=path.join(dir,`s${i+1}.json`);
    await writeFile(file,JSON.stringify(entries[i]));
    inputs.push(file);
  }
  const output=path.join(dir,'merged.json');
  const script=fileURLToPath(new URL('../scripts/verified-shard-combine.mjs',import.meta.url));
  const res=spawnSync(process.execPath,[script,'--output',output,...inputs],{encoding:'utf8'});
  assert.equal(res.status,0,res.stderr);
  assert.equal(JSON.parse(await readFile(output,'utf8')).total,12);
  assert.match(await readFile(path.join(dir,'merged.md'),'utf8'),/12\/12 passed/);
  const duplicate=spawnSync(process.execPath,[script,'--output',output,...inputs],{encoding:'utf8'});
  assert.notEqual(duplicate.status,0,'must not overwrite existing output');
});
test('large synthetic shard aggregation remains complete',()=>{
  const shards=fixtures(2048,8);
  const result=combineVerifiedShards(shards);
  assert.equal(result.total,2048);
});
