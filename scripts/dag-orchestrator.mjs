#!/usr/bin/env node
/**
 * Optional, repo-local bounded DAG runner for trusted Canary YAML manifests.
 * Nodes use a fixed allow-list of Canary subcommands; no shells, arbitrary
 * executable or interpolated command fragments.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnCapture } from '../dist/process.js';
import YAML from 'yaml';

const ID=/^[a-z][a-z0-9_-]{0,63}$/;
const TYPES=new Set(['suite','mcp-check']);
const MAX_NODES=64;

function localFile(value) {
  if(typeof value!=='string'||!value||isAbsolute(value)||value.split(/[\\/]/).includes('..')||
      !/^[-.a-zA-Z0-9_\\/]+$/.test(value))throw new Error('DAG node file must be a safe relative path.');
  return value;
}
export function validateDag(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||
    !Array.isArray(value.nodes)||value.nodes.length===0||value.nodes.length>MAX_NODES)
    throw new Error('DAG must have version=1 and 1..64 nodes.');
  const ids=new Set();
  const nodes=value.nodes.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item)||!ID.test(item.id)||
      !TYPES.has(item.kind))throw new Error('Invalid DAG node id/kind.');
    if(ids.has(item.id))throw new Error(`Duplicate DAG node id: ${item.id}`);
    ids.add(item.id);
    const dependsOn=item.dependsOn??[];
    if(!Array.isArray(dependsOn)||dependsOn.some(dep=>typeof dep!=='string'||!ID.test(dep))||
       new Set(dependsOn).size!==dependsOn.length)throw new Error('Invalid DAG node dependencies.');
    if(Object.keys(item).some(k=>!['id','kind','file','dependsOn'].includes(k)))throw new Error('Unknown DAG node fields.');
    return {id:item.id,kind:item.kind,file:localFile(item.file),dependsOn};
  });
  for(const node of nodes)for(const dep of node.dependsOn){
    if(dep===node.id||!ids.has(dep))throw new Error(`Invalid dependency ${dep} for ${node.id}`);
  }
  const temp=new Set(),done=new Set();
  const indexed=new Map(nodes.map(n=>[n.id,n]));
  function visit(id){
    if(done.has(id))return;
    if(temp.has(id))throw new Error(`DAG cycle detected at ${id}`);
    temp.add(id);for(const dep of indexed.get(id).dependsOn)visit(dep);
    temp.delete(id);done.add(id);
  }
  for(const node of nodes)visit(node.id);
  return nodes;
}
export function taskArgs(node){
  const file=localFile(node.file);
  if(node.kind==='suite')return ['suite',file,'--json'];
  if(node.kind==='mcp-check')return ['mcp-check',file,'--json'];
  throw new Error(`Unsupported DAG task kind: ${node.kind}`);
}
export async function runDag(nodes,execute,{concurrency=2}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('DAG concurrency must be 1..8.');
  const pending=new Map(nodes.map(n=>[n.id,n]));
  const done=new Map();
  const running=new Map();
  const complete=(node,result)=>{done.set(node.id,{id:node.id,kind:node.kind,...result});pending.delete(node.id);};
  while(pending.size||running.size){
    for(const node of [...pending.values()]){
      if(running.has(node.id))continue;
      if(node.dependsOn.some(dep=>done.has(dep)&&done.get(dep).status!=='passed')){
        complete(node,{status:'skipped',reason:'dependency failed'});continue;
      }
      if(!node.dependsOn.every(dep=>done.has(dep)))continue;
      if(running.size>=concurrency)continue;
      pending.delete(node.id);
      const promise=Promise.resolve().then(()=>execute(node))
        .then(result=>({id:node.id,kind:node.kind,status:result.passed?'passed':'failed',
          exitCode:result.exitCode??(result.passed?0:1),durationMs:result.durationMs??0}))
        .catch(()=>({id:node.id,kind:node.kind,status:'failed',exitCode:3,durationMs:0}))
        .then(result=>{done.set(node.id,result);running.delete(node.id);});
      running.set(node.id,promise);
    }
    if(!running.size){
      if(pending.size)throw new Error('DAG scheduler could not make progress.');
      break;
    }
    await Promise.race(running.values());
  }
  const results=nodes.map(n=>done.get(n.id));
  return {schemaVersion:1,passed:results.every(r=>r.status==='passed'),total:results.length,
    passedCount:results.filter(r=>r.status==='passed').length,
    failedCount:results.filter(r=>r.status==='failed').length,
    skippedCount:results.filter(r=>r.status==='skipped').length,results};
}
export async function runDagCli(args){
  if(args.length<1||args.length>3)throw new Error('Usage: dag-orchestrator <manifest.yml> [concurrency] [output.json]');
  const cwd=process.cwd(),file=resolve(cwd,args[0]),rel=relative(cwd,file);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('DAG manifest must be inside current working directory.');
  const nodes=validateDag(YAML.parse(await readFile(file,'utf8')));
  const concurrency=args[1]===undefined?2:Number(args[1]);
  const output=args[2]?resolve(cwd,args[2]):resolve(cwd,'.canary/results/dag-summary.json');
  const outRel=relative(cwd,output);
  if(outRel.startsWith('..')||isAbsolute(outRel))throw new Error('DAG output must be inside current working directory.');
  const result=await runDag(nodes,async node=>{
    const run=await spawnCapture(process.execPath,[resolve(cwd,'dist/v2-cli.js'),...taskArgs(node)],{
      cwd,timeoutMs:10*60*1000,maxOutputChars:1024*1024,
    });
    return {passed:run.code===0&&!run.timedOut&&!run.outputTruncated,exitCode:run.code,
      durationMs:run.durationMs};
  },{concurrency});
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(JSON.stringify(result,null,2));
  if(!result.passed)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  runDagCli(process.argv.slice(2)).catch(err=>{console.error(err instanceof Error?err.message:String(err));process.exitCode=4;});
}
