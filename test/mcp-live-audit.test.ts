import {createServer} from 'node:http';
import {describe,expect,it} from 'vitest';
import {auditLiveMcp} from '../src/mcp-live-audit.js';
import {McpContractSchema} from '../src/mcp-contract.js';
describe('bounded trusted MCP conformance',()=>{
  it('performs normal discovery and strictly local negative probes without tool calls',async()=>{
    let calls=0,invalid=0;
    const server=createServer(async(req,res)=>{
      let body='';for await(const chunk of req)body+=chunk.toString();
      const j=JSON.parse(body) as {id:number;jsonrpc:string;method:string};
      calls++;
      const valid=j.jsonrpc==='2.0'&&['server/discover','tools/list'].includes(j.method);
      if(!valid)invalid++;
      const result=j.method==='server/discover'?{resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}}}:
        {resultType:'complete',tools:[{name:'safe',inputSchema:{type:'object'}}]};
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify(valid?{jsonrpc:'2.0',id:j.id,result}:{jsonrpc:'2.0',id:j.id,error:{code:-32600,message:'Invalid Request'}}));
    });
    await new Promise<void>(res=>server.listen(0,'127.0.0.1',res));
    try{
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('fixture not listening');
      const contract=McpContractSchema.parse({version:1,name:'test',server:{
        transport:'streamable-http',url:`http://127.0.0.1:${addr.port}/mcp`,protocol_version:'2026-07-28',timeout_seconds:5,
      }});
      const outcome=await auditLiveMcp(contract,{trusted:true,negativeProbes:true});
      expect(outcome.valid).toBe(true);expect(outcome.toolsDiscovered).toBe(1);
      expect(outcome.negativeProbes).toBe(3);expect(invalid).toBe(3);expect(calls).toBe(5);
    }finally{await new Promise<void>(res=>server.close(()=>res()));}
  },15_000);
  it('requires an explicit trust acknowledgement and limits remote negative tests',async()=>{
    const contract=McpContractSchema.parse({version:1,name:'unsafe',server:{
      transport:'streamable-http',url:'https://example.com/mcp',protocol_version:'2026-07-28',
    }});
    await expect(auditLiveMcp(contract,{trusted:true,negativeProbes:true})).rejects.toThrow('loopback');
    await expect(auditLiveMcp(contract,{trusted:true,maxRequests:10})).rejects.toThrow('three');
  });
});
