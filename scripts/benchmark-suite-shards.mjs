#!/usr/bin/env node
// Offline synthetic scale benchmark. Never runs Claude or accesses a network.
import { performance } from 'node:perf_hooks';
import { combineVerifiedShards } from './verified-shard-combine.mjs';
function positive(value, fallback, limit) {
  if(value===undefined)return fallback;
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<2||n>limit)throw new Error(`Expected integer 2..${limit}.`);
  return n;
}
const count=positive(process.argv[2],10000,100000);
const pieces=positive(process.argv[3],16,128);
const paths=Array.from({length:count},(_,i)=>`scenarios/${String(i).padStart(6,'0')}.yml`);
const shards=Array.from({length:pieces},(_,index)=>{
 const selected=paths.filter((_,i)=>i%pieces===index).map(path=>({path,passed:true,cacheHit:false}));
 const skipped=paths.filter((_,i)=>i%pieces!==index).map(path=>({path,reason:'shard'}));
 return {schemaVersion:1,suite:'benchmark',suitePath:'.canary/suite.yml',shard:`${index+1}/${pieces}`,
   createdAt:'2026-01-01T00:00:00.000Z',passed:true,discoveredTotal:count,
   total:selected.length,passedCount:selected.length,failedCount:0,
   infrastructureFailedCount:0,cacheHitCount:0,skippedBySelection:skipped.length,
   skipped,scenarios:selected,failureClusters:[]};
});
const before=performance.now();
const result=combineVerifiedShards(shards);
const durationMs=performance.now()-before;
if(!result.passed||result.total!==count)throw new Error('Incomplete benchmark result');
console.log(JSON.stringify({schemaVersion:1,benchmark:'verified-suite-shard-combine',
  scenarios:count,shards:pieces,durationMs:Math.round(durationMs*100)/100,
  heapUsedMiB:Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100},null,2));
