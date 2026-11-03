import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {parse} from 'yaml';

async function load(name:string):Promise<Record<string,any>>{
  return parse(await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8'));
}
describe('post-v2.4.0 release controls: least privilege, explicit dispatch',()=>{
  it('does not retain one-time tag-push automatic release or elevated Actions rights',async()=>{
    const release=await load('release.yml');
    expect(release.on.push).toBeUndefined();
    expect(release.on.workflow_dispatch.inputs.version.required).toBe(true);
    expect(release.on.workflow_dispatch.inputs.confirmation.required).toBe(true);
    expect(release.permissions.actions).toBe('read');
    const validate=release.jobs.publish.steps.find((x:Record<string,unknown>)=>x.id==='release_version');
    expect(validate.run).toContain("refs/heads/main");
    expect(validate.run).toContain("test \"$INPUT_CONFIRMATION\" = PUBLISH");
    expect(validate.run).toContain('normalize-release-version.mjs');
    expect(validate.run).toContain('\"$GITHUB_SHA\"');
    expect(validate.run).not.toContain("refs/tags/v2.4.0");
  });
  it('checks source, dist, audit, consumer, provenance and release without chained publishing',async()=>{
    const release=await load('release.yml');
    const steps=release.jobs.publish.steps;
    const merged=steps.map((x:Record<string,any>)=>x.run||x.uses||'').join('\n');
    expect(merged).toContain('npm run check');
    expect(merged).toContain('npm run check:dist');
    expect(merged).toContain('npm audit --audit-level=high');
    expect(merged).toContain('npm pack --ignore-scripts');
    expect(merged).toContain('attest-build-provenance@');
    expect(merged).toContain('gh release create');
    expect(merged).not.toContain('gh workflow run npm-publish.yml');
    const npm=await load('npm-publish.yml');
    expect(npm.on.workflow_dispatch.inputs.confirmation.required).toBe(true);
    const npmScript=npm.jobs.publish.steps.map((x:Record<string,any>)=>x.run||'').join('\n');
    expect(npmScript).toContain("test \"$INPUT_CONFIRMATION\" = 'PUBLISH_NPM'");
    expect(npmScript).toContain('npm publish --provenance');
    expect(npmScript).toContain('gh release view');
  });
});