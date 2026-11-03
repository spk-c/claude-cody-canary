import { z } from 'zod';

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const sample = z.object({
  scenarioHash: sha,
  replicate: z.number().int().min(0).max(99),
  outcome: z.enum(['passed', 'failed', 'infrastructure']),
  durationMs: z.number().finite().min(0).max(3_600_000),
  recordedAt: z.string().datetime({ offset: true }),
  totalTokens: z.number().int().nonnegative().safe().optional(),
  reportedCostUsd: z.number().finite().nonnegative().max(10000).optional(),
}).strict();
const experiment = z.object({
  suiteHash: sha,
  configurationHash: sha,
  hardwareHash: sha,
  platform: z.enum(['linux', 'darwin', 'win32']),
}).strict();
export const AgentLongitudinalSchema = z.object({
  schemaVersion: z.literal(1),
  agent: z.enum(['claude','codex','qwen']),
  version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  experiment,
  runs: z.array(sample).min(1).max(10000),
}).strict();

export type AgentLongitudinalCohort = z.infer<typeof AgentLongitudinalSchema>;
export type LongitudinalVerdict =
  'improvement' | 'regression' | 'inconclusive' | 'insufficient-data' | 'not-comparable';
export interface LongitudinalAnalysis {
  schemaVersion: 1;
  comparability: 'matched' | 'not-comparable';
  reason: 'matched-experiment' | 'experiment-identity-mismatch' | 'different-sample-pairs' | 'infrastructure-incomplete';
  baseline: { agent: string; version: string; runs: number; infrastructure: number };
  candidate: { agent: string; version: string; runs: number; infrastructure: number };
  matching: { uniqueScenarios: number; pairedRuns: number; positive: number; negative: number; tied: number };
  verdict: LongitudinalVerdict;
  /** Two-sided exact sign test using independent scenario-level mean pass rates, not pseudo-independent repetitions. */
  pValue?: number;
  familyWiseAlpha: number;
  familySize: number;
  deltaPassRate?: number;
  scenarioWeightedDurationDeltaMs?: number;
  usageComparison: 'same-provider-reported' | 'different-provider' | 'incomplete';
  baselineMeanTokens?: number;
  candidateMeanTokens?: number;
  baselineMeanCostUsd?: number;
  candidateMeanCostUsd?: number;
  dateRange?: { earliest: string; latest: string };
  temporalCoverage?: 'single-day' | 'multi-day';
}
const key = (r: z.infer<typeof sample>) => r.scenarioHash + ':' + r.replicate;

function indexRuns(runs: AgentLongitudinalCohort['runs']): Map<string,AgentLongitudinalCohort['runs'][number]> {
  const indexed = new Map<string,AgentLongitudinalCohort['runs'][number]>();
  const perScenario = new Map<string,number>();
  for (const row of runs) {
    const id=key(row);
    if(indexed.has(id)) throw new Error('Duplicate scenario/replicate pair.');
    indexed.set(id,row);
    const count=(perScenario.get(row.scenarioHash)??0)+1;
    if(count>30)throw new Error('More than 30 repetitions per scenario.');
    perScenario.set(row.scenarioHash,count);
  }
  if(perScenario.size>500)throw new Error('Too many independent scenarios for an exact paired test.');
  return indexed;
}
/** Numerically stable for at most 500 independent scenarios; use no normal approximation. */
function twoSidedSignPValue(positive:number,negative:number):number {
  const n=positive+negative;
  if(n===0)return 1;
  const upto=Math.min(positive,negative);
  let term=Math.pow(0.5,n);
  let sum=term;
  for(let k=1;k<=upto;k++){term*= (n-k+1)/k;sum+=term;}
  return Math.min(1,2*sum);
}
function mean(values:number[]):number{return values.reduce((a,b)=>a+b,0)/values.length;}
const metadataEqual=(a:AgentLongitudinalCohort['experiment'],b:AgentLongitudinalCohort['experiment'])=>
  a.suiteHash===b.suiteHash && a.configurationHash===b.configurationHash &&
  a.hardwareHash===b.hardwareHash && a.platform===b.platform;

/**
 * Conservative observational summary of matched repeated runs.
 *
 * Repetitions are correlated within a scenario. The exact sign test uses each
 * unique scenario ONE time (mean pass fraction), preventing pseudoreplication.
 * Differences in hardware, test config, sample pairs or infrastructure runs
 * block claims. No prompts, outputs, host identifiers or credentials accepted.
 */
export function analyzeAgentLongitudinal(
  baselineInput:unknown,candidateInput:unknown,
  options:{familySize?:number;familyWiseAlpha?:number;minimumScenarios?:number}={},
):LongitudinalAnalysis {
  const baseline=AgentLongitudinalSchema.parse(baselineInput);
  const candidate=AgentLongitudinalSchema.parse(candidateInput);
  const familySize=options.familySize??1,alpha=options.familyWiseAlpha??0.05,minimum=options.minimumScenarios??10;
  if(!Number.isSafeInteger(familySize)||familySize<1||familySize>100||
     !Number.isFinite(alpha)||alpha<0.001||alpha>0.2||
     !Number.isSafeInteger(minimum)||minimum<5||minimum>500)
    throw new Error('Invalid family-wise or sample-size budget.');

  const a=indexRuns(baseline.runs),b=indexRuns(candidate.runs);
  const baselineInfrastructure=baseline.runs.filter(x=>x.outcome==='infrastructure').length;
  const candidateInfrastructure=candidate.runs.filter(x=>x.outcome==='infrastructure').length;
  const base:LongitudinalAnalysis={
    schemaVersion:1,comparability:'not-comparable',reason:'different-sample-pairs',
    baseline:{agent:baseline.agent,version:baseline.version,runs:baseline.runs.length,infrastructure:baselineInfrastructure},
    candidate:{agent:candidate.agent,version:candidate.version,runs:candidate.runs.length,infrastructure:candidateInfrastructure},
    matching:{uniqueScenarios:0,pairedRuns:0,positive:0,negative:0,tied:0},
    verdict:'not-comparable',familyWiseAlpha:alpha,familySize,
    usageComparison:baseline.agent===candidate.agent?'incomplete':'different-provider',
  };
  if(!metadataEqual(baseline.experiment,candidate.experiment)){
    base.reason='experiment-identity-mismatch';return base;
  }
  if(a.size!==b.size || [...a.keys()].some(id=>!b.has(id)))return base;
  if(baselineInfrastructure||candidateInfrastructure){
    base.reason='infrastructure-incomplete';return base;
  }
  const grouped=new Map<string,{a:number[];b:number[];durationsA:number[];durationsB:number[]}>();
  for(const [id,x] of a){
    const y=b.get(id)!;
    let group=grouped.get(x.scenarioHash);
    if(!group){group={a:[],b:[],durationsA:[],durationsB:[]};grouped.set(x.scenarioHash,group);}
    group.a.push(x.outcome==='passed'?1:0);
    group.b.push(y.outcome==='passed'?1:0);
    group.durationsA.push(x.durationMs);
    group.durationsB.push(y.durationMs);
  }
  let positive=0,negative=0,tied=0;
  const differences:number[]=[],durations:number[]=[];
  for(const group of grouped.values()){
    const delta=mean(group.b)-mean(group.a);
    differences.push(delta);
    durations.push(mean(group.durationsB)-mean(group.durationsA));
    if(delta>0)positive++;
    else if(delta<0)negative++;
    else tied++;
  }
  const independent=grouped.size;
  const dates=[...baseline.runs,...candidate.runs].map(x=>new Date(x.recordedAt).toISOString()).sort();
  base.comparability='matched';
  base.reason='matched-experiment';
  base.matching={uniqueScenarios:independent,pairedRuns:a.size,positive,negative,tied};
  base.dateRange={earliest:dates[0],latest:dates[dates.length-1]};
  base.temporalCoverage=dates[0].slice(0,10)===dates[dates.length-1].slice(0,10)?'single-day':'multi-day';
  base.deltaPassRate=mean(differences);
  base.scenarioWeightedDurationDeltaMs=mean(durations);
  const discordant=positive+negative;
  if(independent<minimum||discordant<minimum){
    base.verdict='insufficient-data';
  }else{
    base.pValue=twoSidedSignPValue(positive,negative);
    base.verdict=base.pValue<=alpha/familySize
      ?positive>negative?'improvement':'regression':'inconclusive';
  }
  if(baseline.agent===candidate.agent){
    const all=[...baseline.runs,...candidate.runs];
    if(all.every(x=>x.totalTokens!==undefined)){
      base.baselineMeanTokens=mean(baseline.runs.map(x=>x.totalTokens!));
      base.candidateMeanTokens=mean(candidate.runs.map(x=>x.totalTokens!));
      base.usageComparison='same-provider-reported';
    }
    if(all.every(x=>x.reportedCostUsd!==undefined)){
      base.baselineMeanCostUsd=mean(baseline.runs.map(x=>x.reportedCostUsd!));
      base.candidateMeanCostUsd=mean(candidate.runs.map(x=>x.reportedCostUsd!));
      base.usageComparison='same-provider-reported';
    }
  }
  return base;
}
