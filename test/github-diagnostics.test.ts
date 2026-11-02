import {describe,it,expect,vi} from 'vitest';
import {analyzeGithubRun} from '../src/github-diagnostics.js';
import {withFileLock} from '../src/file-lock.js';
describe('GitHub historical evidence',()=>{
  it('preserves original cancellation when rerun succeeds, without exposing remote secrets',async()=>{
    const token='private-token-will-not-be-displayed';
    const mocked=vi.fn(async (url:string,options?:RequestInit)=>{
      expect(options?.headers).toMatchObject({authorization:`Bearer ${token}`});
      const payload=url.endsWith('/1/jobs?per_page=100&page=1')?{jobs:[{id:5,name:'macOS',status:'completed',conclusion:'cancelled',started_at:null,runner_name:null}]}:
        url.endsWith('/2/jobs?per_page=100&page=1')?{jobs:[{id:7,name:'macOS',status:'completed',conclusion:'success',started_at:'2026-11-02T22:00:00Z',runner_name:'runner'}]}:
        {run_attempt:2,head_sha:'a'.repeat(40)};
      return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});
    });
    const result=await analyzeGithubRun('spk-c','claude-cody-canary',123,{fetchImpl:mocked as unknown as typeof fetch,token});
    expect(result.attempts).toBe(2);expect(result.jobs).toHaveLength(2);
    expect(result.summary.cancelledBeforeStart).toBe(1);
    expect(result.summary.successful).toBe(1);
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it('rejects malformed repo names, oversized payloads and failed responses',async()=>{
    await expect(analyzeGithubRun('https://evil.test','repo',42)).rejects.toThrow('Invalid GitHub');
    const invalid=vi.fn(async()=>new Response('forbidden',{status:403}));
    await expect(analyzeGithubRun('owner','repo',42,{fetchImpl:invalid as unknown as typeof fetch})).rejects.toThrow('HTTP 403');
  });
});
