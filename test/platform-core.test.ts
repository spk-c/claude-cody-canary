import {describe,expect,it} from 'vitest';
import {analyzeCiLog,groupCiInsights} from '../src/ci-insights.js';
import {mcpMalformedCorpus,validateMcpEnvelopes} from '../src/mcp-conformance.js';
import {minimizeFailure} from '../src/minimize.js';
import {comparePassRates,wilsonPassRate} from '../src/statistical-regressions.js';
describe('new platform offline core',()=>{
  it('classifies runner cancellation without treating it as a code assertion',()=>{
    const x=analyzeCiLog('job cancelled before runner assigned',1);
    expect(x.kind).toBe('runner-infrastructure');
    expect(x.retriesRecommended).toBe(true);
    expect(groupCiInsights([x,x])[0]?.occurrences).toBe(2);
    expect(JSON.stringify(x)).not.toContain('job cancelled');
  });
  it('distinguishes lock errors, timeouts and assertions',()=>{
    expect(analyzeCiLog("EPERM: open C:/temp/install.lock",1).kind).toBe('lock-contention');
    expect(analyzeCiLog('Test timed out in 5000ms',1).kind).toBe('timeout');
    expect(analyzeCiLog('FAIL test/runner.test.ts',1).kind).toBe('assertion');
  });
  it('validates MCP JSON-RPC envelope shape and rejects negative corpus',()=>{
    expect(validateMcpEnvelopes([{jsonrpc:'2.0',id:1,result:{tools:[]}}]).valid).toBe(true);
    const result=validateMcpEnvelopes(mcpMalformedCorpus());
    expect(result.valid).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(8);
  });
  it('minimizes a stable failure without changing original input',async()=>{
    const input=['a','b','trigger','c','d'];
    const v=await minimizeFailure(input,async xs=>xs.includes('trigger'));
    expect(v.remaining).toEqual(['trigger']);
    expect(input).toHaveLength(5);
    expect(v.budgetExhausted).toBe(false);
  });
  it('fails closed when the starting failure is not reproducible',async()=>{
    await expect(minimizeFailure([1,2],async()=>false)).rejects.toThrow('does not reproduce');
  });
  it('computes confidence intervals and avoids premature claims',()=>{
    const zero=wilsonPassRate(0,10);expect(zero.low).toBe(0);expect(zero.high).toBeGreaterThan(0);
    expect(comparePassRates(5,5,0,5).verdict).toBe('insufficient-data');
    expect(comparePassRates(99,100,15,100).verdict).toBe('regression');
    expect(comparePassRates(50,100,52,100).verdict).toBe('inconclusive');
  });
});
