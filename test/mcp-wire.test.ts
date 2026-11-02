import {createServer} from 'node:http';
import {describe,expect,it} from 'vitest';
import {parseMcpSseResponse,classifyMcpResult} from '../src/mcp-wire.js';
import {auditLiveMcp} from '../src/mcp-live-audit.js';
import {McpContractSchema} from '../src/mcp-contract.js';

describe('MCP 2026 stateless bounded SSE parser',()=>{
  const final=(id=1)=>JSON.stringify({jsonrpc:'2.0',id,result:{resultType:'complete',tools:[]}});
  it('parses request-scoped SSE notifications and matches the final response',()=>{
    const s=': keepalive\r\n\r\n'+
      'event: message\r\ndata: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}\r\n\r\n'+
      'data: '+final()+'\r\n\r\n';
    const v=parseMcpSseResponse(s,1);
    expect(v.notifications.toolsListChanged).toBe(1);
    expect(v.response.result).toEqual({resultType:'complete',tools:[]});
    expect(v.events).toBe(2);
  });
  it('rejects streaming request injection, missing finals, mismatched IDs, resumption and overlong streams',()=>{
    for(const s of [
      'data: {"jsonrpc":"2.0","method":"roots/list","id":7}\n\ndata: '+final()+'\n',
      'data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n',
      'data: '+final(9)+'\n\n',
      'id: cursor\n\ndata: '+final()+'\n\n',
      'data: '+final()+'\n\ndata: '+final()+'\n\n',
    ]) expect(()=>parseMcpSseResponse(s,1)).toThrow();
    expect(()=>parseMcpSseResponse('data: '+final()+'\n\n',1,0)).toThrow();
    expect(()=>parseMcpSseResponse('data: '+final()+'\n\n',1,513)).toThrow();
  });
  it('classifies MRTR without executing input requests and rejects unknown result types',()=>{
    expect(classifyMcpResult({resultType:'complete'},'tools/list')).toBe('complete');
    expect(classifyMcpResult({resultType:'input_required',
      inputRequests:{prompt:{method:'elicitation/create',params:{message:'secret'}}},
      requestState:'opaque'},'tools/call')).toBe('input_required');
    expect(()=>classifyMcpResult({resultType:'input_required'},'tools/list')).toThrow();
    expect(()=>classifyMcpResult({resultType:'unknown'},'tools/call')).toThrow();
    expect(()=>classifyMcpResult({resultType:'input_required',inputRequests:[]},'tools/call')).toThrow();
  });
  it('audits a trusted loopback HTTP server with SSE discovery and no tool calls',async()=>{
    let count=0,calledTools=0;
    const server=createServer(async(req,res)=>{
      let body='';for await(const chunk of req)body+=chunk.toString();
      const message=JSON.parse(body) as {id:number;method:string;params:Record<string,unknown>};
      count++;
      if(message.method==='tools/call')calledTools++;
      expect(req.headers.accept).toContain('text/event-stream');
      expect(req.headers['mcp-method']).toBe(message.method);
      expect(req.headers['mcp-protocol-version']).toBe('2026-07-28');
      const result=message.method==='server/discover'
        ?{resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}}}
        :{resultType:'complete',tools:[{name:'safe',inputSchema:{type:'object'}}]};
      res.writeHead(200,{'content-type':'text/event-stream'});
      res.write(': keep-alive\n\n');
      res.write('data: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/tools/list_changed'})+'\n\n');
      res.end('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\n\n');
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('not listening');
      const contract=McpContractSchema.parse({version:1,name:'sse',server:{
        transport:'streamable-http',url:'http://127.0.0.1:'+addr.port+'/mcp',
        protocol_version:'2026-07-28',timeout_seconds:5,
      }});
      const outcome=await auditLiveMcp(contract,{trusted:true});
      expect(outcome.valid).toBe(true);
      expect(outcome.toolsDiscovered).toBe(1);
      expect(count).toBe(2);
      expect(calledTools).toBe(0);
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },15_000);
});
