import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {hashE2eAnswer,parseE2eResponse,runAgentE2e} from '../src/agent-e2e.js';

const hash=(x:string)=>createHash('sha256').update(x).digest('hex');
const fixture=(agent:'claude'|'codex'|'qwen'='claude',cases=2)=>({
  schemaVersion:1 as const,agent,version:'1.2.3',
  experiment:{suiteHash:hash('suite'),configurationHash:hash('config'),hardwareHash:hash('hardware'),
    platform:'win32' as const},
  limits:{maxRuns:cases,maxDurationMs:20_000,perRunTimeoutMs:1000,maxReportedCostUsd:0.1,
    reserveUsdPerRun:0.03},
  cases:Array.from({length:cases},(_,i)=>({
    scenarioHash:hash('scenario'+i),replicate:0,prompt:'Private input '+i,
    expectedAnswerSha256:hashE2eAnswer('42'),
  })),
});
function completed(stdout:string,code=0){
  return {code,signal:null,stdout,stderr:'private error',durationMs:8,timedOut:false,outputTruncated:false};
}
describe('explicitly approved provider E2E budgets and answer verification',()=>{
  it('defaults to no execution and never returns prompts or expected answers',async()=>{
    let calls=0;
    const result=await runAgentE2e(fixture(),{cwd:process.cwd(),execute:async()=>{
      calls++;return completed('should not be called');
    }});
    expect(calls).toBe(0);
    expect(result.mode).toBe('preview');
    expect(result.attempted).toBe(0);
    expect(result.budgetGuarantee).toBe('not-a-provider-spend-cap');
    expect(JSON.stringify(result)).not.toContain('Private input');
  });
  it('refuses one-sided approvals, duplicate identities and invalid budgets',async()=>{
    await expect(runAgentE2e(fixture(),{cwd:process.cwd(),trusted:true})).rejects.toThrow('both');
    await expect(runAgentE2e(fixture(),{cwd:process.cwd(),allowProviderCosts:true})).rejects.toThrow('both');
    const repeated=fixture();
    repeated.cases[1]={...repeated.cases[0]};
    await expect(runAgentE2e(repeated,{cwd:process.cwd()})).rejects.toThrow('duplicate');
    const unsafe={...fixture(),prompt:'secret data'};
    await expect(runAgentE2e(unsafe,{cwd:process.cwd()})).rejects.toThrow('schema');
  });
  it('checks response text using SHA-256, never treating a clean exit as successful grading',async()=>{
    let count=0;
    const result=await runAgentE2e(fixture(),{cwd:process.cwd(),trusted:true,
      allowProviderCosts:true,executableOverride:'mock',
      execute:async()=>{count++;return completed(JSON.stringify({
        result:count===1?'42':'41',usage:{input_tokens:5,output_tokens:7},total_cost_usd:0.015,
      }));}});
    expect(result.mode).toBe('executed');
    expect(result.verifiedPassed).toBe(1);
    expect(result.verifiedFailed).toBe(1);
    expect(result.cohort?.runs).toHaveLength(2);
    expect(result.reportedCostUsd).toBeCloseTo(0.03);
    expect(JSON.stringify(result)).not.toContain('private error');
    expect(JSON.stringify(result)).not.toContain('Private input');
  });
  it('stops after a missing cost report so further provider calls are not launched',async()=>{
    let calls=0;
    const result=await runAgentE2e(fixture(),{cwd:process.cwd(),trusted:true,
      allowProviderCosts:true,executableOverride:'mock',execute:async()=>{
        calls++;return completed(JSON.stringify({result:'42'}));
      }});
    expect(calls).toBe(1);
    expect(result.stoppedReason).toBe('cost-unavailable');
    expect(result.costTracking).toBe('unavailable');
    expect(result.cohort).toBeUndefined();
  });
  it('stops for observed cost overrun without claiming a preauthorized provider cap',async()=>{
    let calls=0;
    const result=await runAgentE2e(fixture(),{cwd:process.cwd(),trusted:true,
      allowProviderCosts:true,executableOverride:'mock',execute:async()=>{
        calls++;return completed(JSON.stringify({result:'42',total_cost_usd:0.2}));
      }});
    expect(calls).toBe(1);
    expect(result.reportedCostUsd).toBe(0.2);
    expect(result.costTracking).toBe('exceeded');
    expect(result.stoppedReason).toBe('reported-cost-limit');
  });
});

describe('strict model answer extraction',()=>{
  it('requires a completed Codex turn and a final agent message',()=>{
    const output=[
      {type:'item.completed',item:{type:'agent_message',text:'42'}},
      {type:'turn.completed',usage:{input_tokens:10,output_tokens:3}},
    ].map(x=>JSON.stringify(x)).join('\n');
    const good=parseE2eResponse('codex',completed(output));
    expect(good.answer).toBe('42');
    expect(good.tokens).toBe(13);
    expect(good.cost).toBeUndefined();
    expect(parseE2eResponse('codex',completed(output+'\n'+JSON.stringify({type:'turn.failed'}))).answer).toBeUndefined();
  });
  it('fails closed when an answer field is missing or process marks an error',()=>{
    expect(parseE2eResponse('qwen',completed('{}')).answer).toBeUndefined();
    expect(parseE2eResponse('claude',completed(JSON.stringify({result:'42',is_error:true}))).answer).toBeUndefined();
    expect(parseE2eResponse('claude',completed('not JSON')).answer).toBeUndefined();
    expect(hashE2eAnswer('  42\r\n')).toBe(hashE2eAnswer('42'));
  });
});

describe('cohort export remains fail-closed',()=>{
  it('never exports a complete cohort after unknown spending, even if one case ran',async()=>{
    const result=await runAgentE2e(fixture('claude',1),{
      cwd:process.cwd(),trusted:true,allowProviderCosts:true,executableOverride:'fixture',
      execute:async()=>completed(JSON.stringify({result:'42'})),
    });
    expect(result.verifiedPassed).toBe(1);
    expect(result.costTracking).toBe('unavailable');
    expect(result.cohort).toBeUndefined();
  });
  it('never exports a cohort after a reported cost cap breach',async()=>{
    const result=await runAgentE2e(fixture('claude',1),{
      cwd:process.cwd(),trusted:true,allowProviderCosts:true,executableOverride:'fixture',
      execute:async()=>completed(JSON.stringify({result:'42',total_cost_usd:0.5})),
    });
    expect(result.verifiedPassed).toBe(1);
    expect(result.costTracking).toBe('exceeded');
    expect(result.cohort).toBeUndefined();
  });
});
