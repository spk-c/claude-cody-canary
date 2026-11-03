import {createHash,generateKeyPairSync} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it,vi} from 'vitest';
import {runPlatformCommand} from '../src/platform-cli.js';
import {hashE2eAnswer} from '../src/agent-e2e.js';
import {signAgentE2eManifest} from '../src/agent-e2e-attestation.js';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const fixture=()=>({
 schemaVersion:1 as const,agent:'claude' as const,version:'1.2.3',
 experiment:{suiteHash:digest('suite'),configurationHash:digest('configuration'),
  hardwareHash:digest('hardware'),platform:'linux' as const},
 limits:{maxRuns:1,maxDurationMs:10000,perRunTimeoutMs:1000,
  maxReportedCostUsd:0.10,reserveUsdPerRun:0.02},
 cases:[{scenarioHash:digest('scenario'),replicate:0,prompt:'SECRET_TEST_PROMPT_NEVER_LOG',
  expectedAnswerSha256:hashE2eAnswer('42')}],
});
describe('CLI gating reviewer signature and manual billing check',()=>{
 it('blocks unsigned or unreviewed execution before touching any agent binary',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'canary-e2e-gates-'));
  try{
   const raw=path.join(root,'raw.json');
   const signed=path.join(root,'signed.json');
   const pub=path.join(root,'pub.pem');
   const wrongPub=path.join(root,'wrong.pem');
   const {privateKey,publicKey}=generateKeyPairSync('ed25519');
   const other=generateKeyPairSync('ed25519');
   const privatePem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
   await writeFile(raw,JSON.stringify(fixture()));
   await writeFile(signed,JSON.stringify(signAgentE2eManifest(fixture(),privatePem)));
   await writeFile(pub,publicKey.export({type:'spki',format:'pem'}).toString());
   await writeFile(wrongPub,other.publicKey.export({type:'spki',format:'pem'}).toString());
   await expect(runPlatformCommand(['agent','e2e',raw,'--trusted','--allow-provider-costs',
    '--billing-controls-reviewed'])).rejects.toThrow('reviewer-signed');
   await expect(runPlatformCommand(['agent','e2e',signed,'--public-key',pub,
    '--trusted','--allow-provider-costs'])).rejects.toThrow('billing-controls');
   await expect(runPlatformCommand(['agent','e2e',signed,'--public-key',wrongPub,
    '--trusted','--allow-provider-costs','--billing-controls-reviewed']))
    .rejects.toThrow('signature');
   const log=vi.spyOn(console,'log').mockImplementation(()=>{});
   try{
    await runPlatformCommand(['agent','e2e',signed,'--public-key',pub]);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('"mode": "preview"');
    expect(log.mock.calls[0][0]).not.toContain('SECRET_TEST_PROMPT_NEVER_LOG');
   }finally{log.mockRestore();}
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('can sign and verify a fixture without writing private keys or prompts to console',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'canary-e2e-sign-'));
  try{
   const {privateKey,publicKey}=generateKeyPairSync('ed25519');
   const manifest=path.join(root,'manifest.json'),signed=path.join(root,'fixture.signed.json');
   const privatePath=path.join(root,'reviewer-private.pem'),publicPath=path.join(root,'reviewer-public.pem');
   await writeFile(manifest,JSON.stringify(fixture()));
   await writeFile(privatePath,privateKey.export({type:'pkcs8',format:'pem'}).toString());
   await writeFile(publicPath,publicKey.export({type:'spki',format:'pem'}).toString());
   const log=vi.spyOn(console,'log').mockImplementation(()=>{});
   try{
    await runPlatformCommand(['agent','e2e-sign',manifest,'--private-key',privatePath,'--output',signed]);
    await runPlatformCommand(['agent','e2e-verify',signed,'--public-key',publicPath]);
    expect(log).toHaveBeenCalledTimes(2);
    for(const call of log.mock.calls){
      const printed=String(call[0]);
      expect(printed).not.toContain('SECRET_TEST_PROMPT_NEVER_LOG');
      expect(printed).not.toContain('PRIVATE KEY');
    }
   }finally{log.mockRestore();}
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
