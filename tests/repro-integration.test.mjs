import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function exec(command,args,cwd) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout:30000,windowsHide:true});
  if(result.error)throw result.error;
  return result;
}
test('a deterministically failed run generates a real repro bundle without provider credentials',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'canary-repro-smoke-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const scenarioDir=path.join(root,'.canary');
  await mkdir(scenarioDir);
  const scenarioPath=path.join(scenarioDir,'negative.canary.yml');
  await writeFile(scenarioPath,`version: 1
name: negative-repro-smoke
prompt: "This scenario intentionally uses an invalid Claude executable"
claude:
  executable: claude
  timeout_seconds: 10
expect:
  files_exist: [result.txt]
`);
  await writeFile(path.join(root,'README.md'),'# Offline repro smoke\n');
  for(const args of [['init'],['add','.'],['-c','user.name=Canary E2E','-c','user.email=ci@example.invalid','commit','-m','Fixture']]){
    const out=exec('git',args,root);
    assert.equal(out.status,0,out.stderr);
  }
  const cli=path.resolve('dist/v2-cli.js');
  const run=exec(process.execPath,[cli,'run','.canary/negative.canary.yml','--executable',process.execPath],root);
  assert.equal(run.status,1,run.stderr+'\n'+run.stdout);
  const files=(await readdir(path.join(scenarioDir,'results'))).filter(v=>v.endsWith('.json'));
  assert.equal(files.length,1,'failed run must persist its actual result');
  const result=JSON.parse(await readFile(path.join(scenarioDir,'results',files[0]),'utf8'));
  assert.equal(result.passed,false);
  assert.equal(result.executable,process.execPath);
  const repro=exec(process.execPath,[cli,'repro',path.join('.canary','results',files[0]),'--scenario','.canary/negative.canary.yml','--output','.canary/repro-smoke'],root);
  assert.equal(repro.status,0,repro.stderr+'\n'+repro.stdout);
  const contents=await readFile(path.join(scenarioDir,'repro-smoke','result.json'),'utf8');
  assert.equal(JSON.parse(contents).passed,false);
});
