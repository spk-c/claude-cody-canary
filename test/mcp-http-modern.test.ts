import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { McpContractSchema, inspectMcpContract } from '../src/mcp-contract.js';

describe('MCP 2026 read-only Streamable HTTP',()=>{
  it('inspects a local stateless JSON server with per-request metadata and headers', async()=>{
    const methods: string[] = [];
    const server=createServer(async(req,res)=>{
      let payload='';
      for await(const chunk of req)payload+=chunk.toString();
      const call=JSON.parse(payload);
      methods.push(call.method);
      expect(req.headers['mcp-protocol-version']).toBe('2026-07-28');
      expect(req.headers['mcp-method']).toBe(call.method);
      expect(call.params._meta['io.modelcontextprotocol/protocolVersion']).toBe('2026-07-28');
      expect(call.params._meta['io.modelcontextprotocol/clientCapabilities']).toEqual({});
      const result=call.method==='server/discover'
        ? {supportedVersions:['2026-07-28'],capabilities:{tools:{}},_meta:{'io.modelcontextprotocol/serverInfo':{name:'http-test',version:'1.0.0'}}}
        : {tools:[{name:'ping',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]};
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:call.id,result:{resultType:'complete',...result}}));
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const address=server.address();
      if(!address||typeof address==='string')throw new Error('No fixture port');
      const contract=McpContractSchema.parse({version:1,name:'http-test',server:{
        transport:'streamable-http',url:`http://127.0.0.1:${address.port}/mcp`,
        protocol_version:'2026-07-28',timeout_seconds:5,
      }});
      const snapshot=await inspectMcpContract(contract);
      expect(snapshot.tools.map(x=>x.name)).toEqual(['ping']);
      expect(snapshot.serverInfo?.name).toBe('http-test');
      expect(methods).toEqual(['server/discover','tools/list']);
    } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  },15000);
  it('rejects unsupported or unsafe endpoint schemes',()=>{
    expect(()=>McpContractSchema.parse({version:1,name:'invalid',server:{
      transport:'streamable-http',url:'https://test.invalid/mcp',protocol_version:'2025-11-25'
    }})).toThrow();
  });
});
