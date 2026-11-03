import { createHash } from 'node:crypto';
import { createDetachedWorktree, getRepoRoot, getTrackedChanges, resolveCommit } from './git.js';
import { runShellCommand } from './process.js';
import { minimizeFailure, type MinimizationResult } from './minimize.js';

export interface ReplayStep {id:string;command:string;dependsOn?:string[];}
export interface ReplayScenario {
  version:1;steps:ReplayStep[];
  verifyCommand:string;expectedExitCode:number;failureMarker?:string;
  /** Optional immutable commit pin, validated before any reviewed shell command executes. */
  expectedHeadSha?:string;
}
export interface ReplayProvenanceResult extends MinimizationResult<string> {
  schemaVersion:1; headSha:string; scenarioFingerprint:string; originalFailureVerified:true;
}
export interface ReplayOptions {trusted:true;cwd:string;maxChecks?:number;totalBudgetMs?:number;}
const safeId=(s:string)=>/^[a-z0-9_-]{1,60}$/i.test(s);
export function validateReplayScenario(input:ReplayScenario):ReplayScenario{
  if(input.version!==1||!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>32)
    throw new Error('Replay requires 1–32 trusted steps.');
  if(typeof input.verifyCommand!=='string'||!input.verifyCommand.trim()||input.verifyCommand.length>2048||
    !Number.isSafeInteger(input.expectedExitCode)||input.expectedExitCode===0)
    throw new Error('Replay must specify a nonzero expected verification exit code.');
  if(input.failureMarker!==undefined&&(!input.failureMarker||input.failureMarker.length>200))
    throw new Error('Invalid failure marker.');
  if(input.expectedHeadSha!==undefined&&!/^[a-f0-9]{40}$/.test(input.expectedHeadSha))
    throw new Error('Replay expectedHeadSha must be a full immutable 40-character commit hash.');
  const seen=new Set<string>();
  for(const step of input.steps){
    if(!step||typeof step.id!=='string'||!safeId(step.id)||seen.has(step.id)||
      typeof step.command!=='string'||!step.command.trim()||step.command.length>2048||
      !Array.isArray(step.dependsOn??[])||(step.dependsOn??[]).some(x=>typeof x!=='string'||!seen.has(x)))
      throw new Error('Invalid replay step, duplicate ID, or forward dependency.');
    seen.add(step.id);
  }
  return input;
}
function dependencyValid(steps:readonly ReplayStep[]):boolean{
  const ids=new Set(steps.map(x=>x.id));
  return steps.every(x=>(x.dependsOn??[]).every(d=>ids.has(d)));
}
export async function minimizeDependentSteps(
  scenario:ReplayScenario,
  reproduces:(steps:readonly ReplayStep[])=>Promise<boolean>,
  maxChecks=24,
):Promise<MinimizationResult<ReplayStep>>{
  validateReplayScenario(scenario);
  return minimizeFailure(scenario.steps,async candidate=>dependencyValid(candidate)&&reproduces(candidate),maxChecks);
}
/** Trusted shell commands run in a fresh detached Git worktree per attempt.
 * Git worktrees are NOT an OS sandbox; only use reviewed, harmless fixture commands.
 */
export async function replayMinimizeScenario(input:ReplayScenario,options:ReplayOptions):Promise<ReplayProvenanceResult>{
  if(options.trusted!==true)throw new Error('Explicit replay command approval required.');
  const scenario=validateReplayScenario(input);
  const budget=options.totalBudgetMs??180_000;
  if(!Number.isSafeInteger(budget)||budget<1_000||budget>300_000)throw new Error('Invalid replay wall-time budget.');
  const deadline=Date.now()+budget;
  const repo=await getRepoRoot(options.cwd);
  if((await getTrackedChanges(repo)).length)throw new Error('Replay requires a clean tracked Git working tree.');
  const ref=await resolveCommit(repo,'HEAD');
  if(scenario.expectedHeadSha!==undefined&&scenario.expectedHeadSha!==ref)
    throw new Error('Replay expectedHeadSha does not match the checked-out repository HEAD.');
  const scenarioFingerprint=createHash('sha256').update(JSON.stringify({
    version:scenario.version,
    steps:scenario.steps.map(step=>[step.id,step.command,step.dependsOn??[]]),
    verifyCommand:scenario.verifyCommand,
    expectedExitCode:scenario.expectedExitCode,
    failureMarker:scenario.failureMarker??null,
    expectedHeadSha:scenario.expectedHeadSha??null,
  })).digest('hex');
  const result=await minimizeDependentSteps(scenario,async steps=>{
    if(Date.now()>=deadline)throw new Error('Replay wall-time budget exhausted.');
    const worktree=await createDetachedWorktree(repo,ref);
    try {
      for(const step of steps){
        const wait=Math.min(10_000,deadline-Date.now());
        if(wait<=0)throw new Error('Replay wall-time budget exhausted.');
        const proc=await runShellCommand(step.command,worktree.path,wait);
        if(proc.code!==0||proc.timedOut||proc.outputTruncated)return false;
      }
      const wait=Math.min(10_000,deadline-Date.now());
      if(wait<=0)throw new Error('Replay wall-time budget exhausted.');
      const probe=await runShellCommand(scenario.verifyCommand,worktree.path,wait);
      return !probe.timedOut&&!probe.outputTruncated&&probe.code===scenario.expectedExitCode
        &&(!scenario.failureMarker||(probe.stdout+probe.stderr).includes(scenario.failureMarker));
    }finally{await worktree.cleanup();}
  },Math.min(options.maxChecks??24,64));
  return {schemaVersion:1,headSha:ref,scenarioFingerprint,originalFailureVerified:true,
    originalCount:result.originalCount,remaining:result.remaining.map(x=>x.id),
    checks:result.checks,budgetExhausted:result.budgetExhausted};
}
