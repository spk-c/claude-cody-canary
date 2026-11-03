import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {replayMinimizeScenario,validateReplayScenario} from '../src/scenario-replay.js';
import {spawnCapture} from '../src/process.js';

async function git(cwd:string,args:string[]):Promise<string>{
 const p=await spawnCapture('git',args,{cwd,timeoutMs:15000,maxOutputChars:8192});
 if(p.code!==0)throw new Error('Git fixture command failed ('+p.code+').');
 return p.stdout.trim();
}
describe('trusted replay pinned Git history and sanitized provenance',()=>{
 it('refuses non-immutable commit pins',()=>{
  expect(()=>validateReplayScenario({version:1,steps:[{id:'a',command:'echo reviewed'}],
    verifyCommand:'node --version',expectedExitCode:1,expectedHeadSha:'HEAD'})).toThrow('expectedHeadSha');
 });
 it('proves the original failure on a clean worktree and only returns hashes',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'canary-replay-prov-'));
  try{
   await git(dir,['init']);
   await git(dir,['config','user.name','Local Fixture']);
   await git(dir,['config','user.email','fixture@example.invalid']);
   await writeFile(path.join(dir,'README.md'),'fixture\n');
   await writeFile(path.join(dir,'needed.cjs'),"require('node:fs').writeFileSync('marker.txt','SECRET_VALUE');\n");
   await writeFile(path.join(dir,'irrelevant.cjs'),"require('node:fs').writeFileSync('noise.txt','irrelevant');\n");
   await writeFile(path.join(dir,'verify.cjs'),"process.exit(require('node:fs').existsSync('marker.txt')?42:0);\n");
   await git(dir,['add','.']);
   await git(dir,['commit','-m','Fixture']);
   const head=await git(dir,['rev-parse','HEAD']);
   const scenario={version:1 as const,
    steps:[
     {id:'needed',command:'node needed.cjs'},
     {id:'irrelevant',command:'node irrelevant.cjs'},
    ],
    verifyCommand:'node verify.cjs',
    expectedExitCode:42,expectedHeadSha:head,
   };
   await expect(replayMinimizeScenario({...scenario,expectedHeadSha:'0'.repeat(40)},
    {trusted:true,cwd:dir,maxChecks:10,totalBudgetMs:45000})).rejects.toThrow('does not match');
   const report=await replayMinimizeScenario(scenario,
    {trusted:true,cwd:dir,maxChecks:10,totalBudgetMs:45000});
   expect(report.headSha).toBe(head);
   expect(report.originalFailureVerified).toBe(true);
   expect(report.scenarioFingerprint).toMatch(/^[0-9a-f]{64}$/);
   expect(report.remaining).toEqual(['needed']);
   expect(JSON.stringify(report)).not.toContain('SECRET_VALUE');
   await writeFile(path.join(dir,'README.md'),'mutated\n');
   await expect(replayMinimizeScenario(scenario,
    {trusted:true,cwd:dir,maxChecks:10,totalBudgetMs:45000})).rejects.toThrow('clean');
  }finally{await rm(dir,{recursive:true,force:true});}
 },90000);
});