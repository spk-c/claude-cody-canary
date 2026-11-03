import { analyzeCiLog, groupCiInsights, type CiInsight, type CiFailureKind } from './ci-insights.js';

export interface GithubJobDiagnostic {
  id: number; name: string; attempt: number;
  status: string; conclusion: string | null;
  runnerAssigned: boolean; started: boolean; diagnosis: CiInsight;
  /** Inferred only from failed step name, not treated as root cause. */
  failedStage: 'setup'|'dependencies'|'tests'|'publishing'|'authorization'|'unknown'|null;
}
export interface GithubRunDiagnostic {
  schemaVersion: 1;
  owner: string; repository: string; runId: number;
  headSha: string;
  attempts: number;
  jobs: GithubJobDiagnostic[];
  summary: { successful: number; failed: number; cancelledBeforeStart: number; incomplete: number };
  /** Issue/PR triage suggestions contain only predefined safe categories, never log content. */
  triage: Array<{kind:CiFailureKind; fingerprint:string; occurrences:number; action:string}>;
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
/**
 * GitHub step titles are untrusted, user-authored metadata. Export only a
 * fixed category; never copy arbitrary step text into public diagnostics.
 */
function failedJobStage(job:Record<string,unknown>):GithubJobDiagnostic['failedStage']{
  const steps=Array.isArray(job.steps)?job.steps:[];
  const failed=steps.find((entry:unknown)=>object(entry)&&entry.conclusion==='failure');
  if(!object(failed)||typeof failed.name!=='string')return null;
  const name=failed.name.toLowerCase();
  if(/permission|auth|credential|secret|token/.test(name))return 'authorization';
  if(/install|dependenc|npm ci|package/.test(name))return 'dependencies';
  if(/build|test|lint|typecheck|check|verify/.test(name))return 'tests';
  if(/publish|release|deploy|upload/.test(name))return 'publishing';
  if(/checkout|setup|initialize/.test(name))return 'setup';
  return 'unknown';
}
function observedExecution(job:Record<string,unknown>,runnerAssigned:boolean):boolean{
  const steps=Array.isArray(job.steps)?job.steps:[];
  return runnerAssigned||steps.some((entry:unknown)=>object(entry)&&
    (entry.status==='in_progress'||entry.status==='completed')&&
    typeof entry.started_at==='string');
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
        const runnerAssigned=typeof job.runner_name==='string'&&job.runner_name.length>0||
          Number.isSafeInteger(job.runner_id)&&Number(job.runner_id)>0;
        // GitHub started_at may be set when a job is merely queued/scheduled.
        // Do not infer runner allocation or actual test execution from it.
        const started=observedExecution(job,runnerAssigned);
        const diagnosis=cancelled&&!started
          ?analyzeCiLog('CI_JOB_CANCELLED_UNASSIGNED_WITHOUT_EXECUTED_STEPS',1)
          :job.conclusion==='success'?analyzeCiLog('',0)
          :analyzeCiLog('',1);
        jobs.push({id:Number(job.id),name:job.name.slice(0,150),attempt,status:job.status,
          conclusion:typeof job.conclusion==='string'?job.conclusion:null,
          runnerAssigned,started,diagnosis,failedStage:failedJobStage(job)});
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
      cancelledBeforeStart:jobs.filter(x=>x.diagnosis.kind==='cancelled-before-execution').length,
      incomplete:jobs.filter(x=>x.status!=='completed').length,
    },
    triage:groupCiInsights(jobs.map(x=>x.diagnosis).filter(x=>x.kind!=='passed')).slice(0,12).map(group=>({
      kind:group.kind,fingerprint:group.fingerprint,occurrences:group.occurrences,
      action:jobs.find(x=>x.diagnosis.fingerprint===group.fingerprint)?.diagnosis.action
        ??'Inspect incomplete job evidence before changing code.',
    })),
    retainsOriginalAttempts:true};
}
