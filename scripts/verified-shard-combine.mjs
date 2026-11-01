#!/usr/bin/env node
/**
 * Strict, complete shard aggregation for independent Canary suite artifacts.
 * Unlike the low-level combineSuiteResults API, this refuses missing/duplicate
 * shards, incomplete fail-fast output, inconsistent filters and path overlaps.
 *
 * Usage: node scripts/verified-shard-combine.mjs --output merged.json shard-1.json ...
 */
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { combineSuiteResults, formatSuiteMarkdown } from '../dist/suite.js';

const MAX_SHARDS = 128;
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}
function requirePaths(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label} must be an array.`);
  const names = new Set();
  for (const item of items) {
    requireRecord(item, label + ' entry');
    if (typeof item.path !== 'string' || !item.path || names.has(item.path)) {
      throw new Error(`${label} contains missing/duplicate paths.`);
    }
    names.add(item.path);
  }
  return names;
}
function shardNumber(shard) {
  if (typeof shard !== 'string') throw new Error('Every input must identify its shard as N/M.');
  const found = /^(\d+)\/(\d+)$/.exec(shard);
  if (!found) throw new Error(`Invalid shard identifier: ${shard}`);
  const index = Number(found[1]), total = Number(found[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) ||
      index < 1 || total < 2 || total > MAX_SHARDS || index > total) {
    throw new Error(`Invalid shard identifier: ${shard}`);
  }
  return { index, total };
}
function equalSets(a,b) {
  return a.size === b.size && [...a].every(value=>b.has(value));
}

export function combineVerifiedShards(shards) {
  if (!Array.isArray(shards) || shards.length < 2 || shards.length > MAX_SHARDS) {
    throw new Error(`Expected between 2 and ${MAX_SHARDS} suite shards.`);
  }
  const first = shards[0];
  requireRecord(first, 'First shard');
  const expected = shardNumber(first.shard).total;
  if (shards.length !== expected) throw new Error(`Expected ${expected} shards, received ${shards.length}.`);
  const seenShards = new Set();
  let universe;
  let nonShardSkips;
  const selected = new Set();
  const inventories = [];

  for (const part of shards) {
    requireRecord(part, 'Shard');
    if (part.schemaVersion !== 1 || !Array.isArray(part.failureClusters)) throw new Error('Unsupported suite result schema.');
    if (part.suite !== first.suite || part.suitePath !== first.suitePath ||
        part.tag !== first.tag || part.executable !== first.executable ||
        part.discoveredTotal !== first.discoveredTotal) {
      throw new Error('Suite shard metadata differs (suite/path/tag/executable/discoveredTotal).');
    }
    if (!Number.isSafeInteger(part.discoveredTotal) || part.discoveredTotal < 1) {
      throw new Error('Invalid discoveredTotal.');
    }
    const { index, total } = shardNumber(part.shard);
    if (total !== expected || seenShards.has(index)) throw new Error('Duplicate or mismatched shard N/M.');
    seenShards.add(index);
    const selectedPaths = requirePaths(part.scenarios, 'scenarios');
    const skippedPaths = requirePaths(part.skipped, 'skipped');
    const skipByPath = new Map(part.skipped.map(entry => [entry.path, entry.reason]));
    inventories.push({ selectedPaths, skipByPath });
    for (const p of selectedPaths) {
      if (selected.has(p) || skippedPaths.has(p)) throw new Error(`Duplicate or conflicting scenario: ${p}`);
      selected.add(p);
    }
    if (part.total !== part.scenarios.length) throw new Error('Shard total does not match its scenarios.');
    for (const item of part.scenarios) {
      if (typeof item.passed !== 'boolean') throw new Error('Invalid scenario passed flag.');
    }
    if (part.passedCount !== part.scenarios.filter(s=>s.passed).length ||
        part.failedCount !== part.scenarios.filter(s=>!s.passed).length ||
        part.infrastructureFailedCount !== part.scenarios.filter(s=>!!s.infrastructureError).length ||
        part.cacheHitCount !== part.scenarios.filter(s=>!!s.cacheHit).length) {
      throw new Error('Shard scenario counters disagree with contents.');
    }
    const all = new Set([...selectedPaths, ...skippedPaths]);
    if (all.size !== part.discoveredTotal) throw new Error('Shard scenario coverage is incomplete (including fail-fast cases).');
    if (universe && !equalSets(universe, all)) throw new Error('Shards disagree on discovered scenario paths.');
    universe = all;
    const filtered = new Set();
    for (const entry of part.skipped) {
      if (!['tag','unaffected','shard'].includes(entry.reason)) throw new Error('Invalid skip reason.');
      if (entry.reason !== 'shard') filtered.add(`${entry.path}:${entry.reason}`);
    }
    if (nonShardSkips && !equalSets(nonShardSkips, filtered)) throw new Error('Shard selection filters disagree.');
    nonShardSkips = filtered;
  }
  if (seenShards.size !== expected) throw new Error('Missing shards.');
  const globallySkipped = new Map();
  for (const entry of first.skipped.filter(s=>s.reason !== 'shard')) {
    globallySkipped.set(entry.path, entry);
  }
  for (const path of universe) {
    let owners = 0;
    for (const { selectedPaths, skipByPath } of inventories) {
      if (selectedPaths.has(path)) owners++;
      else if (globallySkipped.has(path)) {
        if (skipByPath.get(path) !== globallySkipped.get(path).reason) throw new Error(`Filtered scenario disagrees: ${path}`);
      } else if (skipByPath.get(path) !== 'shard') throw new Error(`Missing shard/skip coverage for ${path}`);
    }
    if (globallySkipped.has(path) ? owners!==0 : owners!==1) throw new Error(`Scenario ownership invalid: ${path}`);
  }

  const combined = combineSuiteResults(shards);
  combined.skipped = [...globallySkipped.values()].sort((a,b)=>a.path.localeCompare(b.path));
  combined.skippedBySelection = combined.skipped.length;
  combined.tag = first.tag;
  combined.executable = first.executable;
  combined.discoveredTotal = first.discoveredTotal;
  combined.passed = combined.passed && shards.every(s=>s.passed);
  if (combined.total + combined.skippedBySelection !== combined.discoveredTotal) {
    throw new Error('Merged scenario count does not cover discovered suite.');
  }
  return combined;
}

async function readBounded(file) {
  const size=(await stat(file)).size;
  if (size > MAX_ARTIFACT_BYTES) throw new Error(`Shard artifact exceeds 32 MiB: ${file}`);
  return JSON.parse(await readFile(file,'utf8'));
}
export async function runVerifiedShardCli(args) {
  if(args[0] !== '--output' || !args[1] || args.length < 4 ||
      args.slice(2).some(x=>x.startsWith('--'))) {
    throw new Error('Usage: verified-shard-combine --output merged.json shard-1.json shard-2.json [...]');
  }
  const output = resolve(args[1]);
  const paths=args.slice(2).map(p=>resolve(p));
  if(new Set(paths).size !== paths.length || paths.includes(output)) throw new Error('Inputs/output must be distinct paths.');
  const shards=await Promise.all(paths.map(readBounded));
  const combined=combineVerifiedShards(shards);
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(combined,null,2)+'\n',{flag:'wx',encoding:'utf8'});
  await writeFile(output.replace(/\.json$/i,'')+'.md',formatSuiteMarkdown(combined),{flag:'wx',encoding:'utf8'});
  console.log(`Verified ${shards.length} shards, ${combined.total} scenarios; ${combined.passedCount} passed. ${output}`);
  if(!combined.passed) process.exitCode=1;
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runVerifiedShardCli(process.argv.slice(2)).catch(e=>{
    console.error(e instanceof Error?e.message:String(e));
    process.exitCode=2;
  });
}
