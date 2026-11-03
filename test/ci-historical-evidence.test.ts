import {describe,expect,it,vi} from 'vitest';
import {analyzeCiLog} from '../src/ci-insights.js';
import {analyzeGithubRun} from '../src/github-diagnostics.js';

describe('real historical GitHub Actions cancellation fields',()=>{
 it('classifies scheduled-but-unassigned cancellation without calling it a failed test',async()=>{
  const fake=vi.fn(async(url:string)=>{
    const data=url.endsWith('/2/jobs?per_page=100&page=1')
      ?{jobs:[{id:125511624678,name:'verify (macos-latest, 24)',status:'completed',
          conclusion:'cancelled',started_at:'2026-11-02T19:50:35Z',runner_name:'',runner_id:0,steps:[]}]}
      :url.endsWith('/1/jobs?per_page=100&page=1')
      ?{jobs:[{id:125497278205,name:'verify (macos-latest, 24)',status:'completed',
          conclusion:'cancelled',started_at:'2026-11-02T19:21:00Z',runner_name:'',runner_id:0,steps:[]}]}
      :{run_attempt:2,head_sha:'7f7c4bf2292aa49991acf8c4eea047fd371a3018'};
    return new Response(JSON.stringify(data));
  });
  const report=await analyzeGithubRun('spk-c','claude-cody-canary',41509477687,{fetchImpl:fake as typeof fetch});
  expect(report.summary.cancelledBeforeStart).toBe(2);
  expect(report.jobs.map(x=>x.started)).toEqual([false,false]);
  expect(report.jobs.every(x=>x.diagnosis.kind==='cancelled-before-execution')).toBe(true);
  expect(report.jobs.every(x=>!x.diagnosis.retriesRecommended)).toBe(true);
  expect(report.attempts).toBe(2);
  expect(report.triage).toMatchObject([{kind:'cancelled-before-execution',occurrences:2}]);
  expect(report.triage[0].action).toContain('queue');
 });
 it('returns only safe failure-stage categories, not arbitrary step text',async()=>{
  const fake=vi.fn(async(url:string)=>{
    const data=url.includes('/jobs?')?{jobs:[{id:33,name:'CI',status:'completed',
      conclusion:'failure',started_at:'2026-11-03T12:00:00Z',runner_name:'runner-4',
      steps:[{name:'private credential in step name: SECRET_VALUE',conclusion:'failure',
        status:'completed',started_at:'2026-11-03T12:00:01Z'}]}]}
      :{run_attempt:1,head_sha:'a'.repeat(40)};
    return new Response(JSON.stringify(data));
  });
  const report=await analyzeGithubRun('owner','repo',55,{fetchImpl:fake as typeof fetch});
  expect(report.jobs[0].failedStage).toBe('authorization');
  expect(report.jobs[0].diagnosis.kind).toBe('unknown');
  expect(JSON.stringify(report)).not.toContain('SECRET_VALUE');
 });
 it('recognizes permission failures without retaining log contents',()=>{
  const secret='SECRET_VALUE_NEVER_OUTPUT';
  const diagnostic=analyzeCiLog('Error: Resource not accessible by integration '+secret,1);
  expect(diagnostic.kind).toBe('permission');
  expect(diagnostic.retriesRecommended).toBe(false);
  expect(diagnostic.action).toContain('GITHUB_TOKEN');
  expect(JSON.stringify(diagnostic)).not.toContain(secret);
 });
});