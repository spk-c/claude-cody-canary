import {describe,expect,it} from 'vitest';
import {analyzeAgentLongitudinal} from '../src/agent-longitudinal.js';
const hash=(n:number)=>n.toString(16).padStart(64,'0');
const experiment={suiteHash:hash(101),configurationHash:hash(202),hardwareHash:hash(303),platform:'win32' as const};
function cohort(agent:'claude'|'codex'|'qwen',scenarios=12,repeats=3,passed=false){
  return {schemaVersion:1 as const,agent,version:'1.2.3',experiment,
    runs:Array.from({length:scenarios},(_,i)=>Array.from({length:repeats},(_,replicate)=>({
      scenarioHash:hash(i+1),replicate,recordedAt:'2026-11-03T12:00:00Z',
      outcome:passed?'passed':'failed',durationMs:1000,totalTokens:150,reportedCostUsd:0.01,
    }))).flat(),
  };
}
describe('independent paired longitudinal tests',()=>{
  it('uses unique scenarios rather than repeated calls as the statistical sample',()=>{
    const result=analyzeAgentLongitudinal(cohort('claude',12,3,false),cohort('claude',12,3,true));
    expect(result.comparability).toBe('matched');
    expect(result.matching).toMatchObject({uniqueScenarios:12,pairedRuns:36,positive:12,negative:0,tied:0});
    expect(result.verdict).toBe('improvement');
    expect(result.pValue).toBeCloseTo(2/4096,8);
    expect(result.deltaPassRate).toBe(1);
  });
  it('blocks false precision for a single repeatedly tested scenario',()=>{
    const result=analyzeAgentLongitudinal(cohort('claude',1,30,false),cohort('claude',1,30,true));
    expect(result.verdict).toBe('insufficient-data');
    expect(result.pValue).toBeUndefined();
    expect(result.matching.pairedRuns).toBe(30);
  });
  it('adjusts the significance threshold for a family of comparisons',()=>{
    const a=cohort('claude',10,2,false),b=cohort('claude',10,2,true);
    expect(analyzeAgentLongitudinal(a,b).verdict).toBe('improvement');
    expect(analyzeAgentLongitudinal(a,b,{familySize:100}).verdict).toBe('inconclusive');
  });
});

describe('incomplete or mismatched experiments',()=>{
  it('refuses different hardware, mismatched repeats and incomplete infrastructure',()=>{
    const a=cohort('qwen',12,2,false),b=cohort('qwen',12,2,true);
    const hardware={...b,experiment:{...b.experiment,hardwareHash:hash(904)}};
    expect(analyzeAgentLongitudinal(a,hardware).reason).toBe('experiment-identity-mismatch');
    expect(analyzeAgentLongitudinal(a,{...b,runs:b.runs.slice(1)}).reason).toBe('different-sample-pairs');
    const broken={...b,runs:b.runs.map((x,i)=>i===0?{...x,outcome:'infrastructure'}:x)};
    const result=analyzeAgentLongitudinal(a,broken);
    expect(result.reason).toBe('infrastructure-incomplete');
    expect(result.verdict).toBe('not-comparable');
    expect(result.pValue).toBeUndefined();
  });
  it('does not equate usage across agent providers',()=>{
    const result=analyzeAgentLongitudinal(cohort('claude',12,1,false),cohort('codex',12,1,true));
    expect(result.verdict).toBe('improvement');
    expect(result.usageComparison).toBe('different-provider');
    expect(result.candidateMeanTokens).toBeUndefined();
  });
  it('requires enough discordant scenarios and rejects duplicate samples',()=>{
    const a=cohort('claude',12,1,true),b=cohort('claude',12,1,true);
    expect(analyzeAgentLongitudinal(a,b).verdict).toBe('insufficient-data');
    expect(()=>analyzeAgentLongitudinal({...a,runs:[...a.runs,a.runs[0]]},b)).toThrow('Duplicate');
    expect(()=>analyzeAgentLongitudinal(a,b,{familySize:0})).toThrow('budget');
    expect(()=>analyzeAgentLongitudinal({...a,unexpected:'not part of schema'},b)).toThrow();
  });
});

describe('temporal coverage of matched measurements',()=>{
  it('normalizes offset timestamps and distinguishes single-day from multi-day evidence',()=>{
    const baseline=cohort('qwen',12,1,false);
    const candidate=cohort('qwen',12,1,true);
    const same=analyzeAgentLongitudinal(baseline,candidate);
    expect(same.temporalCoverage).toBe('single-day');
    const moved={...candidate,runs:candidate.runs.map(x=>({...x,recordedAt:'2026-11-04T03:00:00+02:00'}))};
    const later=analyzeAgentLongitudinal(baseline,moved);
    expect(later.temporalCoverage).toBe('multi-day');
    expect(later.dateRange?.earliest).toBe('2026-11-03T12:00:00.000Z');
    expect(later.dateRange?.latest).toBe('2026-11-04T01:00:00.000Z');
  });
});
