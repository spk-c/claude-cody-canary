import {describe,expect,it} from 'vitest';
import {sendNegativeProbe} from '../src/mcp-live-audit.js';

const url=new URL('http://127.0.0.1:65530/mcp');
const probe={id:91,method:'tools/list'};
function fake(status:number,data:unknown,contentType='application/json'):typeof fetch{
 return (async()=>new Response(typeof data==='string'?data:JSON.stringify(data),{
   status,headers:{'content-type':contentType},
 })) as typeof fetch;
}
describe('negative HTTP MCP response conformance',()=>{
 it('accepts HTTP 400 only with correlated valid JSON-RPC error envelope',async()=>{
  const response={jsonrpc:'2.0',id:91,error:{code:-32600,message:'Invalid Request'}};
  const ok=await sendNegativeProbe(url,probe,{trusted:true,fetchImpl:fake(400,response)});
  expect(ok).toMatchObject({passed:true,reason:'rejected-by-server'});
  const missing=await sendNegativeProbe(url,probe,{trusted:true,fetchImpl:fake(400,'no payload','text/html')});
  expect(missing.passed).toBe(false);
  expect(missing.reason).toBe('http-400');
 });
 it('rejects mismatched IDs, unrelated HTTP errors, and malformed envelope',async()=>{
  for(const [status,body] of [
    [422,{jsonrpc:'2.0',id:999,error:{code:-32600,message:'wrong request'}}],
    [400,{message:'random error'}],
    [200,{jsonrpc:'2.0',id:91,result:{}}],
  ] as const){
    const got=await sendNegativeProbe(url,probe,{trusted:true,fetchImpl:fake(status,body)});
    expect(got.passed).toBe(false);
  }
  for(const status of [401,403,429]){
    const got=await sendNegativeProbe(url,probe,{trusted:true,fetchImpl:fake(status,{
      jsonrpc:'2.0',id:91,error:{code:-32600,message:'Not Authorized'}})});
    expect(got).toMatchObject({passed:false,reason:'http-'+status});
  }
 });
});