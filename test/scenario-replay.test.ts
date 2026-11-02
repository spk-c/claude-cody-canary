import {describe,expect,it} from 'vitest';
import {minimizeDependentSteps,validateReplayScenario} from '../src/scenario-replay.js';
describe('dependency-preserving repro minimizer',()=>{
  it('preserves required prerequisite, drops irrelevant steps and verifies failure',async()=>{
    const scenario={version:1 as const,steps:[
      {id:'setup',command:'fixture prepare'},{id:'irrelevant',command:'fixture noop'},
      {id:'trigger',command:'fixture trigger',dependsOn:['setup']},
      {id:'unneeded',command:'fixture irrelevant'},
    ],verifyCommand:'fixture check',expectedExitCode:42};
    const min=await minimizeDependentSteps(scenario,async steps=>steps.some(x=>x.id==='trigger')&&steps.some(x=>x.id==='setup'));
    expect(min.remaining.map(x=>x.id)).toEqual(['setup','trigger']);
  });
  it('rejects unsafe forward or missing dependency',()=>{
    expect(()=>validateReplayScenario({version:1,steps:[{id:'a',command:'echo a',dependsOn:['later']}],
      verifyCommand:'exit 3',expectedExitCode:3})).toThrow('dependency');
  });
});
