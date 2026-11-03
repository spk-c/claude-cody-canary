import {generateKeyPairSync} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {signAgentE2eManifest,verifyAgentE2eManifest} from '../src/agent-e2e-attestation.js';
import {hashE2eAnswer} from '../src/agent-e2e.js';

const sha=(letter:string)=>letter.repeat(64);
const keypair=()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 return {
  privatePem:privateKey.export({type:'pkcs8',format:'pem'}).toString(),
  publicPem:publicKey.export({type:'spki',format:'pem'}).toString(),
 };
};
const manifest=()=>({
 schemaVersion:1 as const,agent:'claude' as const,version:'2.3.0',
 experiment:{suiteHash:sha('a'),configurationHash:sha('b'),hardwareHash:sha('c'),platform:'linux' as const},
 limits:{maxRuns:1,maxDurationMs:12000,perRunTimeoutMs:1000,maxReportedCostUsd:1,reserveUsdPerRun:0.05},
 cases:[{scenarioHash:sha('d'),replicate:0,prompt:'private reviewed example',
   expectedAnswerSha256:hashE2eAnswer('42')}],
});
describe('reviewer-attested E2E fixtures',()=>{
 it('verifies a signed canonical fixture only with the pinned reviewer public key',()=>{
  const reviewer=keypair();
  const signed=signAgentE2eManifest(manifest(),reviewer.privatePem);
  const verdict=verifyAgentE2eManifest(signed,reviewer.publicPem);
  expect(verdict.verified).toBe(true);
  expect(verdict.reason).toBe('valid');
  expect(verdict.manifestHash).toBe(signed.manifestHash);
  expect(verdict.reviewerKeyFingerprint).toBe(signed.reviewerKeyFingerprint);
  expect(JSON.stringify(verdict)).not.toContain('private reviewed example');
 });
 it('rejects changed prompts, altered expected hashes, budgets and model version',()=>{
  const reviewer=keypair(),signed=signAgentE2eManifest(manifest(),reviewer.privatePem);
  const changed=[
   {...signed,manifest:{...signed.manifest,cases:[{...signed.manifest.cases[0],prompt:'changed'}]}},
   {...signed,manifest:{...signed.manifest,cases:[{...signed.manifest.cases[0],expectedAnswerSha256:sha('f')}]}},
   {...signed,manifest:{...signed.manifest,limits:{...signed.manifest.limits,maxReportedCostUsd:2}}},
   {...signed,manifest:{...signed.manifest,version:'9.9.9'}},
  ];
  for(const value of changed)expect(verifyAgentE2eManifest(value,reviewer.publicPem).verified).toBe(false);
 });
 it('rejects a different reviewer even with a valid signature',()=>{
  const a=keypair(),b=keypair();
  expect(verifyAgentE2eManifest(signAgentE2eManifest(manifest(),a.privatePem),b.publicPem))
   .toMatchObject({verified:false,reason:'wrong-reviewer-key'});
 });
 it('ignores JSON serialization order by canonicalizing known schema fields',()=>{
  const reviewer=keypair(),input=manifest();
  const signed=signAgentE2eManifest(input,reviewer.privatePem);
  const reordered={agent:input.agent,limits:input.limits,cases:input.cases,
    schemaVersion:1,experiment:input.experiment,version:input.version};
  const resigned=signAgentE2eManifest(reordered,reviewer.privatePem);
  expect(resigned.manifestHash).toBe(signed.manifestHash);
  expect(resigned.signature).toBe(signed.signature);
 });
 it('rejects malformed secret-containing fixture without echoing the secret',()=>{
  const keys=keypair();
  try{
   signAgentE2eManifest({...manifest(),secret:'SECRET-KEY-TO-REDACT'},keys.privatePem);
   throw new Error('Unexpected successful signing');
  }catch(error){
   expect(String(error)).toContain('sensitive schema details suppressed');
   expect(String(error)).not.toContain('SECRET-KEY-TO-REDACT');
  }
  expect(verifyAgentE2eManifest({manifest:manifest()},keys.publicPem).verified).toBe(false);
 });
});
