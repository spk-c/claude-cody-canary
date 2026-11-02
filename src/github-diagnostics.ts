import { analyzeCiLog, type CiInsight } from './ci-insights.js';

export interface GithubJobDiagnostic {
  id: number; name: string; attempt: number;
  status: string; conclusion: string | null;
  runnerAssigned: boolean; started: boolean; diagnosis: CiInsight;
}
export interface GithubRunDiagnostic {
  schemaVersion: 1;
  owner: string; repository: string; runId: number;
  headSha: string;
  attempts: number;
  jobs: GithubJobDiagnostic[];
  summary: { successful: number; failed: number; cancelledBeforeStart: number; incomplete: number };
  /** Earlier attempts are always included; green reruns do not erase original failures. */
  retainsOriginalAttempts: true;
}
interface GithubFetchOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}
function safeName(name: string): string {
  if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) throw new Error('Invalid GitHub owner/repo identifier.');
  return name;
}
function object(value:unknown): value is Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value);}
async function fetchApi(url: string, opts: GithubFetchOptions):Promise<unknown> {
  const fn=opts.fetchImpl??fetch;
  const response=await fn(url,{
    method:'GET',redirect:'error',
    signal:AbortSignal.timeout(opts.timeoutMs??15_000),
    headers:{
      accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28',
      ...(opts.token?{authorization:`Bearer ${opts.token}`}:{}),
    },
  });
  if(!response.ok)throw new Error(`GitHub API returned HTTP ${response.status} (response body hidden)`);
  if(Number(response.headers.get('content-length')??'0')>1_048_576)throw new Error('GitHub response exceeded 1 MiB.');
  if(!response.body)throw new Error('GitHub returned an empty body.');
  const reader=response.body.getReader();
  const bytes:Uint8Array[]=[];
  let size=0,done=false;
  try{
    for (;;) {
      const next=await reader.read();
      if(next.done){done=true;break;}
      size+=next.value.byteLength;
      if(size>1_048_576)throw new Error('GitHub response exceeded 1 MiB.');
      bytes.push(next.value);
    }
  }finally{
    if(!done)await reader.cancel().catch(()=>undefined);
    reader.releaseLock();
  }
  const combined=new Uint8Array(size);let offset=0;
  for(const b of bytes){combined.set(b,offset);offset+=b.byteLength;}
  return JSON.parse(new TextDecoder().decode(combined)) as unknown;
}
/** Read-only GitHub Action history; no log/body is copied into the result. */
export async function analyzeGithubRun(owner:string,repo:string,runId:number,opts:GithubFetchOptions={}):Promise<GithubRunDiagnostic>{
  safeName(owner);safeName(repo);
  if(!Number.isSafeInteger(runId)||runId<1)throw new Error('Invalid GitHub Actions run id.');
  const root=`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
  const run=await fetchApi(root,opts);
  if(!object(run)||typeof run.run_attempt!=='number'||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1||run.run_attempt>20||
    typeof run.head_sha!=='string'||!/^[0-9a-f]{40}$/i.test(run.head_sha))throw new Error('Invalid GitHub workflow run metadata.');
  const jobs:GithubJobDiagnostic[]=[];
  for(let attempt=1;attempt<=run.run_attempt;attempt++){
    let complete=false;
    for(let page=1;page<=10;page++){
      const response=await fetchApi(`${root}/attempts/${attempt}/jobs?per_page=100&page=${page}`,opts);
      if(!object(response)||!Array.isArray(response.jobs))throw new Error('Invalid GitHub jobs payload.');
      for(const job of response.jobs){
        if(!object(job)||!Number.isSafeInteger(job.id)||typeof job.name!=='string'||typeof job.status!=='string')throw new Error('Invalid GitHub job record.');
        const cancelled=job.conclusion==='cancelled'||job.conclusion==='canceled';
        const runnerAssigned=typeof job.runner_name==='string'&&job.runner_name.length>0;
        const started=typeof job.started_at==='string';
        const diagnosis=cancelled&&!started&&!runnerAssigned
          ? analyzeCiLog('runner not assigned; job cancelled before start',1)
          : job.conclusion==='success'?analyzeCiLog('',0)
          : analyzeCiLog('',1);
        jobs.push({id:Number(job.id),name:job.name.slice(0,150),attempt,status:job.status,
          conclusion:typeof job.conclusion==='string'?job.conclusion:null,runnerAssigned,started,diagnosis});
      }
      if(response.jobs.length<100){complete=true;break;}
    }
    if(!complete)throw new Error('More than 1000 jobs per attempt; refusing incomplete evidence.');
  }
  if(jobs.length>10_000)throw new Error('Too many jobs.');
  return {schemaVersion:1,owner,repository:repo,runId,headSha:run.head_sha,attempts:run.run_attempt,jobs,
    summary:{
      successful:jobs.filter(x=>x.conclusion==='success').length,
      failed:jobs.filter(x=>x.conclusion==='failure').length,
      cancelledBeforeStart:jobs.filter(x=>x.diagnosis.kind==='runner-infrastructure').length,
      incomplete:jobs.filter(x=>x.status!=='completed').length,
    },retainsOriginalAttempts:true};
}
