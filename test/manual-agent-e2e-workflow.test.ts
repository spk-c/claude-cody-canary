import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {parse} from 'yaml';
import path from 'node:path';

async function workflow():Promise<Record<string,any>> {
 const source=await readFile(path.join(process.cwd(),'.github','workflows','manual-agent-e2e.yml'),'utf8');
 return parse(source) as Record<string,any>;
}
describe('opt-in provider E2E workflow defaults',()=>{
 it('is only manually dispatched, non-privileged, and defaults to preview',async()=>{
  const wf=await workflow();
  expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
  expect(wf.permissions).toEqual({contents:'read'});
  expect(wf.on.workflow_dispatch.inputs.mode.default).toBe('preview');
  expect(wf.on.workflow_dispatch.inputs.billing_review.default).toBe('NO');
  expect(wf.jobs.reviewed.concurrency).toBeUndefined();
  expect(wf.jobs.reviewed.environment).toBe('canary-paid-e2e');
 });
 it('protects live execution with branch, billing acknowledgement and signed reviewer fixture',async()=>{
  const wf=await workflow();
  const steps=wf.jobs.reviewed.steps as Array<Record<string,any>>;
  const first=steps.find(x=>String(x.name).includes('Refuse anything'));
  const decode=steps.find(x=>String(x.name).includes('Decode reviewer fixture'));
  const preview=steps.find(x=>String(x.name).includes('Offline preview'));
  const approved=steps.find(x=>String(x.name).includes('protected environment approval'));
  expect(approved.if).toContain("inputs.mode == 'live'");
  expect(approved.run).toContain('CANARY_E2E');
  expect(first.run).toContain('refs/heads/main');
  expect(first.run).toContain('PROVIDER_LIMITS_REVIEWED');
  expect(decode.run).toContain('agent e2e-verify');
  expect(decode.run).toContain('REVIEWER_PUBKEY_B64');
  expect(preview.run).toContain('agent e2e');
  expect(preview.run).not.toContain('--trusted');
 });
 it('never enables a paid agent install or run in preview and separates provider credentials',async()=>{
  const wf=await workflow();
  const steps=wf.jobs.reviewed.steps as Array<Record<string,any>>;
  const paid=steps.filter(x=>String(x.name).includes('live call'));
  expect(paid).toHaveLength(3);
  for(const step of paid){
   expect(step.if).toContain("inputs.mode == 'live'");
   expect(step.run).toContain('--billing-controls-reviewed');
   expect(step.run).toContain('--allow-provider-costs');
   expect(Object.keys(step.env).filter(x=>x.endsWith('API_KEY'))).toHaveLength(1);
  }
  const installs=steps.filter(x=>String(x.name).startsWith('Install '));
  expect(installs).toHaveLength(3);
  for(const step of installs)expect(step.if).toContain("inputs.mode == 'live'");
 });
});
