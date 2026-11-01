#!/usr/bin/env node
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILES=5000, MAX_FILE_BYTES=4*1024*1024;
function safeTime(value){return typeof value==='string'&&!Number.isNaN(Date.parse(value))?new Date(value).toISOString():null;}
function safeHash(value){return typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)?value:undefined;}
export function summarizeHistoryArtifact(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1)return null;
  const createdAt=safeTime(value.createdAt);
  if(!createdAt)return null;
  if(typeof value.suite==='string'&&Array.isArray(value.scenarios)){
    const total=value.scenarios.length,failed=value.scenarios.filter(x=>!x.passed).length;
    return {kind:'suite',createdAt,total,failed,passed:total-failed};
  }
  if(typeof value.status==='string'&&typeof value.latest==='string'&&Array.isArray(value.unseen)){
    return {kind:'release-watch',createdAt,status:['initialized','no-change','new-release','compatible','regression','infrastructure-error'].includes(value.status)?value.status:'unknown'};
  }
  if(typeof value.scenario==='string'&&typeof value.passed==='boolean'){
    return {kind:'run',createdAt,passed:value.passed,gitCommit:safeHash(value.gitCommit)};
  }
  return null;
}
export function buildHistoryIndex(records){
  const sorted=[...records].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.kind.localeCompare(b.kind));
  const counts={runs:sorted.filter(x=>x.kind==='run').length,suites:sorted.filter(x=>x.kind==='suite').length,
    watches:sorted.filter(x=>x.kind==='release-watch').length,
    runFailures:sorted.filter(x=>x.kind==='run'&&!x.passed).length,
    suiteFailures:sorted.filter(x=>x.kind==='suite'&&x.failed>0).length};
  const digest=createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  return {schemaVersion:1,entries:sorted.length,counts,contentSha256:digest,history:sorted};
}
export async function indexHistoryDirectory(root,output){
  const abs=resolve(root),dest=resolve(output),rel=relative(abs,dest);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('History index output must be inside results directory.');
  const items=(await readdir(abs,{withFileTypes:true})).filter(d=>d.isFile()&&d.name.endsWith('.json')&&join(abs,d.name)!==dest).sort((a,b)=>a.name.localeCompare(b.name));
  if(items.length>MAX_FILES)throw new Error('More than 5000 JSON results; archive old results before indexing.');
  const records=[];
  for(const item of items){
    const file=join(abs,item.name);
    if((await stat(file)).size>MAX_FILE_BYTES)throw new Error('History artifact exceeds 4 MiB.');
    const raw=JSON.parse(await readFile(file,'utf8'));
    const summary=summarizeHistoryArtifact(raw);
    if(summary)records.push(summary);
  }
  const data=buildHistoryIndex(records);
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,JSON.stringify(data,null,2)+'\n','utf8');
  return data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const dir=resolve(process.argv[2]??'.canary/results');
  const out=resolve(process.argv[3]??join(dir,'history-index.json'));
  indexHistoryDirectory(dir,out).then(data=>console.log(JSON.stringify({entries:data.entries,counts:data.counts,contentSha256:data.contentSha256})))
    .catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=4;});
}
