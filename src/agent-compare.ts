import {z} from 'zod';
import {comparePassRates,type StatisticalDecision} from './statistical-regressions.js';

const sampleSchema=z.object({
  scenarioHash:z.string().regex(/^[a-f0-9]{64}$/),
  passed:z.boolean(),
  durationMs:z.number().finite().nonnegative().max(3_600_000),
  totalTokens:z.number().int().nonnegative().safe().optional(),
  reportedCostUsd:z.number().finite().nonnegative().max(10000).optional(),
}).strict();
const cohortSchema=z.object({
  schemaVersion:z.literal(1),
  agent:z.enum(['claude','codex','qwen']),
  version:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
  runs:z.array(sampleSchema).min(1).max(10000),
}).strict();
export type AgentCohort=z.infer<typeof cohortSchema>;
export interface AgentComparison {
  schemaVersion:1;
  comparability:'comparable'|'not-comparable';
  reason:'same-scenarios'|'different-scenarios';
  baseline:{agent:AgentCohort['agent'];version:string;runs:number;passed:number;meanDurationMs:number};
  candidate:{agent:AgentCohort['agent'];version:string;runs:number;passed:number;meanDurationMs:number};
  statisticalDecision?:StatisticalDecision;
  passRateDelta?:number;
  tokenComparison:'available'|'unavailable'|'different-provider';
  baselineMeanTokens?:number;
  candidateMeanTokens?:number;
  costComparison:'available'|'unavailable'|'different-provider';
  baselineMeanCostUsd?:number;
  candidateMeanCostUsd?:number;
}
function distribution(value:AgentCohort):Map<string,number>{
  const output=new Map<string,number>();
  for(const run of value.runs)output.set(run.scenarioHash,(output.get(run.scenarioHash)??0)+1);
  return output;
}
function mean(values:number[]):number{return values.reduce((a,b)=>a+b,0)/values.length;}
/**
 * Compare ONLY the same test population; cross-provider token/cost accounting
 * is explicitly unavailable, even when both providers report metrics.
 * Raw prompts/outputs and environment values are not accepted by the schema.
 */
export function compareAgentCohorts(baselineInput:unknown,candidateInput:unknown):AgentComparison{
  const baseline=cohortSchema.parse(baselineInput),candidate=cohortSchema.parse(candidateInput);
  const left=distribution(baseline),right=distribution(candidate);
  const comparable=left.size===right.size && [...left].every(([key,n])=>right.get(key)===n);
  const baselinePass=baseline.runs.filter(x=>x.passed).length;
  const candidatePass=candidate.runs.filter(x=>x.passed).length;
  const output:AgentComparison={
    schemaVersion:1,comparability:comparable?'comparable':'not-comparable',
    reason:comparable?'same-scenarios':'different-scenarios',
    baseline:{agent:baseline.agent,version:baseline.version,runs:baseline.runs.length,
      passed:baselinePass,meanDurationMs:mean(baseline.runs.map(x=>x.durationMs))},
    candidate:{agent:candidate.agent,version:candidate.version,runs:candidate.runs.length,
      passed:candidatePass,meanDurationMs:mean(candidate.runs.map(x=>x.durationMs))},
    tokenComparison:'unavailable',costComparison:'unavailable',
  };
  if(!comparable)return output;
  output.statisticalDecision=comparePassRates(baselinePass,baseline.runs.length,
    candidatePass,candidate.runs.length);
  output.passRateDelta=candidatePass/candidate.runs.length-baselinePass/baseline.runs.length;
  if(baseline.agent!==candidate.agent){
    output.tokenComparison='different-provider';output.costComparison='different-provider';
    return output;
  }
  if([...baseline.runs,...candidate.runs].every(x=>x.totalTokens!==undefined)){
    output.tokenComparison='available';
    output.baselineMeanTokens=mean(baseline.runs.map(x=>x.totalTokens!));
    output.candidateMeanTokens=mean(candidate.runs.map(x=>x.totalTokens!));
  }
  if([...baseline.runs,...candidate.runs].every(x=>x.reportedCostUsd!==undefined)){
    output.costComparison='available';
    output.baselineMeanCostUsd=mean(baseline.runs.map(x=>x.reportedCostUsd!));
    output.candidateMeanCostUsd=mean(candidate.runs.map(x=>x.reportedCostUsd!));
  }
  return output;
}
