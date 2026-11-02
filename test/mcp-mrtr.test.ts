import {describe,expect,it} from 'vitest';
import {prepareMcpMrtrRetry} from '../src/mcp-mrtr.js';
describe('explicit, offline MCP MRTR preparation',()=>{
  const original={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read-only-tool',
    arguments:{query:'public'},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}};
  const interim={resultType:'input_required',inputRequests:{approval:{
    method:'elicitation/create',params:{message:'Confirm?'},
  }},requestState:'opaque-server-provided-state'};
  it('prepares a new request with exact answers and opaque state without running any tool',()=>{
    const request=prepareMcpMrtrRetry(original,interim,{approval:{action:'decline'}},2,{approved:true});
    expect(request).toMatchObject({jsonrpc:'2.0',id:2,method:'tools/call',
      params:{name:'read-only-tool',inputResponses:{approval:{action:'decline'}},
        requestState:'opaque-server-provided-state'}});
    expect(original.params).not.toHaveProperty('inputResponses');
  });
  it('rejects missing approval, missing or extra answers, wrong result shape, unsafe methods and reused ids',()=>{
    expect(()=>prepareMcpMrtrRetry(original,interim,{approval:{}},1,{approved:true})).toThrow('original');
    expect(()=>prepareMcpMrtrRetry({...original,method:'tools/list'},interim,{approval:{}},2,{approved:true})).toThrow('original');
    expect(()=>prepareMcpMrtrRetry(original,interim,{approval:{},unexpected:{}},2,{approved:true})).toThrow('IDs');
    expect(()=>prepareMcpMrtrRetry(original,interim,{},2,{approved:true})).toThrow('IDs');
    expect(()=>prepareMcpMrtrRetry(original,{resultType:'complete'}, {approval:{}},2,{approved:true})).toThrow('input required');
    expect(()=>prepareMcpMrtrRetry(original,interim,{approval:{}},2,{approved:false} as never)).toThrow('approval');
  });
});
