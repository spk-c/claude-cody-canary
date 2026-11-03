import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {parse} from 'yaml';

async function load(name:string):Promise<Record<string,any>>{
  return parse(await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8'));
}
describe('one-time, exact-tag v2.4.0 release safety',()=>{
  it('retains explicit manual approval and only accepts one exact automatic release tag',async()=>{
    const release=await load('release.yml');
    expect(release.on.push.tags).toEqual(['v2.4.0']);
    expect(release.on.workflow_dispatch.inputs.version.required).toBe(true);
    const validate=release.jobs.publish.steps.find((x:Record<string,unknown>)=>x.id==='release_version');
    expect(validate.run).toContain("refs/tags/v2.4.0");
    expect(validate.run).toContain("test \"$INPUT_CONFIRMATION\" = PUBLISH");
    expect(validate.run).toContain('refs/remotes/origin/main');
    expect(validate.run).toContain('\"$GITHUB_SHA\"');
    expect(validate.run).toContain('normalize-release-version.mjs');
  });
  it('checks source, dist, audit, consumer, provenance and immutable release before requesting npm',async()=>{
    const release=await load('release.yml');
    const steps=release.jobs.publish.steps;
    const merged=steps.map((x:Record<string,any>)=>x.run||x.uses||'').join('\n');
    expect(merged).toContain('npm run check');
    expect(merged).toContain('npm run check:dist');
    expect(merged).toContain('npm audit --audit-level=high');
    expect(merged).toContain('npm pack --ignore-scripts');
    expect(merged).toContain('attest-build-provenance@');
    expect(merged).toContain('gh release create');
    const dispatch=steps.find((x:Record<string,unknown>)=>String(x.name).includes('Request npm Trusted'));
    expect(dispatch.if).toContain("github.ref == 'refs/tags/v2.4.0'");
    expect(dispatch.run).toContain('--field confirmation=PUBLISH_NPM');
    expect(dispatch.run).toContain('npm-publish.yml');
    const npm=await load('npm-publish.yml');
    expect(npm.on.workflow_dispatch.inputs.confirmation.required).toBe(true);
    const npmScript=npm.jobs.publish.steps.map((x:Record<string,any>)=>x.run||'').join('\n');
    expect(npmScript).toContain("test \"$INPUT_CONFIRMATION\" = 'PUBLISH_NPM'");
    expect(npmScript).toContain('npm publish --provenance');
    expect(npmScript).toContain('gh release view');
  });
});