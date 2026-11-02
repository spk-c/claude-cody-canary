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

describe('Codex JSONL telemetry and safe prompt argument handling',()=>{
  async function runCodex(stdout:string,code=0){
    const execute=async()=>({code,signal:null,stdout,stderr:'secret stderr',durationMs:9,timedOut:false});
    return runAgentTest({agent:'codex',prompt:'secret task',cwd:process.cwd(),trusted:true,
      executableOverride:'fixture',execute:execute as never});
  }
  it('separates user-supplied prompts from CLI flags',()=>{
    expect(agentReadOnlyArgs('codex','--sandbox danger-full-access').slice(-2))
      .toEqual(['--','--sandbox danger-full-access']);
  });
  it('sums authoritative completed-turn token usage without double-counting cached or reasoning tokens',async()=>{
    const output=[
      {type:'thread.started',thread_id:'private-thread'},
      {type:'turn.started'},
      {type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:80,output_tokens:20,reasoning_output_tokens:5}},
      {type:'turn.completed',usage:{input_tokens:2,output_tokens:3}},
      {type:'item.completed',item:{type:'agent_message',text:'secret model answer'}},
    ].map(x=>JSON.stringify(x)).join('\n');
    const result=await runCodex(output);
    expect(result.passed).toBe(true);
    expect(result.telemetry).toBe('recognized');
    expect(result.totalTokens).toBe(125);
    expect(result.reportedCostUsd).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('private-thread');
  });
  it('fails closed on missing terminal completion, explicit errors or malformed JSONL',async()=>{
    for(const output of [
      '{"type":"thread.started","thread_id":"x"}\n{"type":"item.completed","item":{"text":"hello"}}',
      '{"type":"turn.failed","error":{"message":"secret"}}',
      '{"type":"error","message":"secret"}',
      '{"type":"turn.completed","usage":{"input_tokens":3}}',
      '{"type":"turn.completed","usage":{"input_tokens":3,"output_tokens":4}}\nnot-json',
    ]){
      const result=await runCodex(output);
      expect(result.passed).toBe(false);
      expect(result.telemetry).toBe('unavailable');
      expect(result.totalTokens).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('secret');
    }
  });
  it('does not invent provider metrics for arbitrary valid JSON objects',async()=>{
    const execute=async()=>({code:0,signal:null,stdout:'{}',stderr:'',durationMs:3,timedOut:false});
    const result=await runAgentTest({agent:'qwen',prompt:'test',cwd:process.cwd(),trusted:true,
      executableOverride:'fixture',execute:execute as never});
    expect(result.passed).toBe(true);
    expect(result.telemetry).toBe('unavailable');
  });
});
