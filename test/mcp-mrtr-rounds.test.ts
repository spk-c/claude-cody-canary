import {describe,expect,it} from 'vitest';
import {prepareMcpMrtrRetry} from '../src/mcp-mrtr.js';
import {planApprovedMcpMrtrRounds} from '../src/mcp-mrtr-plan.js';

const initial={jsonrpc:'2.0',id:1,method:'tools/call',
 params:{name:'read-only-fixture',arguments:{source:'public'},
 _meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}};
const ask={resultType:'input_required',inputRequests:{question:{
 method:'elicitation/create',params:{mode:'form',message:'Review?'}}},requestState:'opaque-round-1'};
const approval={approved:true as const};

describe('MCP 2026-07-28 approved MRTR state transitions',()=>{
 it('supports spec-compliant requestState-only input_required without old answers',()=>{
  const second=prepareMcpMrtrRetry(initial,ask,{question:{action:'decline'}},2,approval);
  const third=prepareMcpMrtrRetry(second,{resultType:'input_required',requestState:'opaque-round-2'},
    {},3,approval);
  expect(third).toMatchObject({id:3,method:'tools/call',
    params:{name:'read-only-fixture',requestState:'opaque-round-2'}});
  expect(third.params).not.toHaveProperty('inputResponses');
  const fourth=prepareMcpMrtrRetry(third,{resultType:'input_required',
    inputRequests:{check:{method:'roots/list',params:{}}}},{check:{roots:[]}},4,approval);
  expect(fourth.params).not.toHaveProperty('requestState');
  expect(fourth.params).toHaveProperty('inputResponses');
 });
 it('refuses unrecognized input methods, unsupported empty results and unsolicited input',()=>{
  expect(()=>prepareMcpMrtrRetry(initial,{resultType:'input_required',
    inputRequests:{x:{method:'tools/call',params:{}}}},{x:{}},2,approval)).toThrow('Unsupported');
  expect(()=>prepareMcpMrtrRetry(initial,{resultType:'input_required'}, {},2,approval)).toThrow('must contain');
  expect(()=>prepareMcpMrtrRetry(initial,{resultType:'input_required',requestState:'opaque'},
    {extra:'SECRET'},2,approval)).toThrow('IDs');
 });
 it('prepares independently approved rounds without network calls or exposing responses',()=>{
  const trace=planApprovedMcpMrtrRounds(initial,[
    {result:ask,inputResponses:{question:{action:'decline',text:'SECRET_VALUE'}},nextId:2,approval},
    {result:{resultType:'input_required',requestState:'opaque-round-2'},
      inputResponses:{},nextId:3,approval},
  ],{jsonrpc:'2.0',id:3,result:{isError:false}});
  expect(trace).toMatchObject({approvedRounds:2,executedRequests:0,final:'success',
    roundSummaries:[{round:1,requestId:2,inputCount:1,opaqueRequestState:true},
      {round:2,requestId:3,inputCount:0,opaqueRequestState:true}]});
  expect(JSON.stringify(trace)).not.toContain('SECRET_VALUE');
  expect(JSON.stringify(trace)).not.toContain('opaque-round');
 });
 it('rejects missing approvals, reused ids, incorrect final responses and excessive rounds',()=>{
  expect(()=>planApprovedMcpMrtrRounds(initial,[
    {result:ask,inputResponses:{question:{}},nextId:2,approval},
    {result:ask,inputResponses:{question:{}},nextId:2,approval},
  ])).toThrow('reused');
  expect(()=>planApprovedMcpMrtrRounds(initial,[
    {result:ask,inputResponses:{question:{}},nextId:2,approval},
  ],{jsonrpc:'2.0',id:50,result:{}})).toThrow('Final');
  expect(()=>planApprovedMcpMrtrRounds(initial,Array.from({length:9},(_,i)=>({
    result:ask,inputResponses:{question:{}},nextId:i+2,approval,
  })))).toThrow('maximum');
  expect(()=>planApprovedMcpMrtrRounds(initial,[
    {result:ask,inputResponses:{question:{}},nextId:2,approval:{approved:false as never}},
  ])).toThrow('approval');
 });
});