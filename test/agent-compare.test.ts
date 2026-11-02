import {describe,expect,it} from 'vitest';
import {compareAgentCohorts} from '../src/agent-compare.js';

const id=(v:string)=>v.repeat(64);
const cohort=(agent:'claude'|'codex'|'qwen',n=20,pass=19,version='1.2.3')=>({
  schemaVersion:1 as const,agent,version,
  runs:Array.from({length:n},(_,i)=>({
    scenarioHash:id(i%2===0?'a':'b'),passed:i<pass,durationMs:100,
    totalTokens:10,reportedCostUsd:0.01,
  })),
});
describe('agent comparisons require reproducible scenario samples',()=>{
  it('gives evidence-based cross-provider pass rates without claiming comparable token pricing',()=>{
    const report=compareAgentCohorts(cohort('claude',20,20),cohort('codex',20,0));
    expect(report.comparability).toBe('comparable');
    expect(report.statisticalDecision?.verdict).toBe('regression');
    expect(report.tokenComparison).toBe('different-provider');
    expect(report.costComparison).toBe('different-provider');
    expect(report.passRateDelta).toBe(-1);
  });
  it('refuses unsupported scenario population and masks metrics',()=>{
    const a=cohort('claude',10,8);
    const b={...cohort('claude',10,7),runs:cohort('claude',10,7).runs.slice(0,9)};
    const result=compareAgentCohorts(a,b);
    expect(result.comparability).toBe('not-comparable');
    expect(result.statisticalDecision).toBeUndefined();
    expect(result.costComparison).toBe('unavailable');
  });
  it('compares same-provider usage only when every sample has exact finite evidence',()=>{
    const report=compareAgentCohorts(cohort('qwen'),cohort('qwen',20,18,'1.3.0'));
    expect(report.tokenComparison).toBe('available');
    expect(report.baselineMeanTokens).toBe(10);
    expect(report.costComparison).toBe('available');
    expect(report.candidateMeanCostUsd).toBeCloseTo(.01);
    const malformed=cohort('qwen');
    delete (malformed.runs[0] as {reportedCostUsd?:number}).reportedCostUsd;
    expect(compareAgentCohorts(malformed,cohort('qwen')).costComparison).toBe('unavailable');
  });
  it('rejects arbitrary stored prompts, secret output and invalid costs',()=>{
    expect(()=>compareAgentCohorts({...cohort('claude'),prompt:'secret'},cohort('claude'))).toThrow();
    expect(()=>compareAgentCohorts({...cohort('claude'),runs:[{scenarioHash:id('a'),passed:true,durationMs:0,
      reportedCostUsd:-1}]},cohort('claude'))).toThrow();
  });
  it('refuses premature statistical regression claims for small cohorts',()=>{
    const x=compareAgentCohorts(cohort('claude',4,4),cohort('claude',4,0));
    expect(x.statisticalDecision?.verdict).toBe('insufficient-data');
  });
});
