import {describe,expect,it} from 'vitest';
import {agentReadOnlyArgs,runAgentTest} from '../src/agent-runner.js';
describe('approved read-only agent runners',()=>{
  it('keeps each supported adapter in a read-only execution mode',()=>{
    expect(agentReadOnlyArgs('claude','hello')).toContain('plan');
    expect(agentReadOnlyArgs('codex','hello')).toContain('read-only');
    expect(agentReadOnlyArgs('qwen','hello')).toContain('plan');
    expect(agentReadOnlyArgs('codex','hello')).not.toContain('danger-full-access');
    expect(()=>agentReadOnlyArgs('codex','')).toThrow();
  });
  it('runs provider-isolated bounded process and retains no model response or prompt',async()=>{
    let got:string[]=[];
    const execute=async (_cmd:string,args:string[])=>{
      got=args;
      return {code:0,signal:null,stdout:JSON.stringify({usage:{input_tokens:3,output_tokens:4},total_cost_usd:0.005}),stderr:'secret',
        durationMs:12,timedOut:false};
    };
    const result=await runAgentTest({agent:'claude',prompt:'secret prompt',cwd:process.cwd(),trusted:true,executableOverride:'fixture',
      execute:execute as never});
    expect(got[0]).toBe('-p');expect(result.passed).toBe(true);
    expect(result.totalTokens).toBe(7);expect(result.reportedCostUsd).toBe(.005);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('marks unknown output telemetry unavailable without fabricating tokens',async()=>{
    const execute=async()=>({code:1,signal:null,stdout:'invalid json',stderr:'',durationMs:3,timedOut:false});
    const v=await runAgentTest({agent:'qwen',prompt:'test',cwd:process.cwd(),trusted:true,executableOverride:'fixture',execute:execute as never});
    expect(v.passed).toBe(false);expect(v.telemetry).toBe('unavailable');expect(v.totalTokens).toBeUndefined();
  });
});
