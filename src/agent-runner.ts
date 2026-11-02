import { findExecutable } from './doctor.js';
import { spawnCapture } from './process.js';
import type { KnownAgent } from './agent-adapters.js';
import type { ProcessResult } from './types.js';

export interface AgentTestResult {
  schemaVersion:1;agent:KnownAgent;passed:boolean;exitCode:number;timedOut:boolean;
  durationMs:number;outputTruncated:boolean;telemetry:'recognized'|'unavailable';
  reportedCostUsd?:number;totalTokens?:number;
}
export interface AgentTestOptions {
  agent:KnownAgent;prompt:string;cwd:string;trusted:true;
  executableOverride?:string;timeoutMs?:number;
  execute?:typeof spawnCapture;env?:NodeJS.ProcessEnv;
}
/** Explicit per-provider read-only, one-shot arguments. Never enable YOLO/auto-edit. */
export function agentReadOnlyArgs(agent:KnownAgent,prompt:string):string[]{
  if(!prompt.trim()||prompt.length>8000)throw new Error('Agent prompt must have 1–8000 characters.');
  switch(agent){
    case 'claude':return ['-p',prompt,'--output-format','json','--permission-mode','plan','--no-session-persistence'];
    case 'codex':return ['exec','--json','--ephemeral','--sandbox','read-only','--skip-git-repo-check',prompt];
    case 'qwen':return ['-p',prompt,'--output-format','json','--approval-mode','plan'];
    default:throw new Error('Unsupported agent; refusing unknown commands.');
  }
}
function isObj(v:unknown):v is Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function safeUsage(v:unknown):{cost?:number;tokens?:number}|undefined {
  if(!isObj(v))return;
  const usage=isObj(v.usage)?v.usage:v;
  const tokenFields=['input_tokens','output_tokens','inputTokens','outputTokens'];
  const nums=tokenFields.map(k=>usage[k]).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
  const cost=typeof v.total_cost_usd==='number'&&Number.isFinite(v.total_cost_usd)&&v.total_cost_usd>=0?v.total_cost_usd:undefined;
  return {cost,tokens:nums.length?nums.reduce((a,b)=>a+b,0):undefined};
}
/** Executes a reviewed, read-only one-shot agent and drops raw prompts/output. */
export async function runAgentTest(opts:AgentTestOptions):Promise<AgentTestResult>{
  if(opts.trusted!==true)throw new Error('Explicit trusted-run approval required.');
  const timeoutMs=opts.timeoutMs??120_000;
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>300_000)throw new Error('Agent timeout out of bounds.');
  const args=agentReadOnlyArgs(opts.agent,opts.prompt);
  const command=opts.executableOverride??opts.agent;
  if(!opts.executableOverride&&!(await findExecutable(command,opts.cwd,opts.env??process.env)))
    throw new Error('Agent executable not found on PATH.');
  const result:ProcessResult=await (opts.execute??spawnCapture)(command,args,{
    cwd:opts.cwd,env:opts.env??process.env,timeoutMs,maxOutputChars:512*1024,
  });
  let telemetry:'recognized'|'unavailable'='unavailable';
  let reportedCostUsd:number|undefined,totalTokens:number|undefined;
  if(!result.outputTruncated){
    try {
      const parsed=opts.agent==='codex'
        ?result.stdout.trim().split(/\r?\n/).map(s=>{try{return JSON.parse(s) as unknown;}catch{return null;}}).filter(isObj).slice(-1)[0]
        :JSON.parse(result.stdout) as unknown;
      if(isObj(parsed)){
        telemetry='recognized';
        const data=safeUsage(parsed);
        reportedCostUsd=data?.cost;totalTokens=data?.tokens;
      }
    }catch{ /* Unknown provider output is explicitly marked unavailable. */ }
  }
  return {schemaVersion:1,agent:opts.agent,passed:result.code===0&&!result.timedOut&&!result.outputTruncated,
    exitCode:result.code,timedOut:result.timedOut,durationMs:result.durationMs,
    outputTruncated:result.outputTruncated===true,telemetry,reportedCostUsd,totalTokens};
}
