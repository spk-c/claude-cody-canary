import {describe,expect,it} from 'vitest';
import {sortSuiteByPriority} from '../src/suite.js';
describe('history-aware suite scheduling',()=>{
 it('keeps all cases selected and prioritizes failing/affected work',()=>{
  const cases=[
    {path:'b.yml',tags:[],affects:[],always:false},
    {path:'a.yml',tags:[],affects:['src/**'],always:false},
    {path:'c.yml',tags:[],affects:[],always:true},
  ];
  const x=sortSuiteByPriority(cases,{'a.yml':{failureCount:6}},['src/index.ts']);
  expect(x.map(y=>y.path)).toEqual(['c.yml','a.yml','b.yml']);
  expect(cases[0].path).toBe('b.yml');
 });
});
