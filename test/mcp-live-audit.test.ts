import {createServer} from 'node:http';
import {describe,expect,it} from 'vitest';
import {auditLiveMcp} from '../src/mcp-live-audit.js';
import {McpContractSchema,inspectMcpContract} from '../src/mcp-contract.js';
describe('bounded trusted MCP conformance',()=>{
  it('performs normal discovery and strictly local negative probes without tool calls',async()=>{
    let calls=0,invalid=0;
    const server=createServer(async(req,res)=>{
      let body='';for await(const chunk of req)body+=chunk.toString();
      const j=JSON.parse(body) as {id:number;jsonrpc:string;method:string};
      calls++;
      const valid=j.jsonrpc==='2.0'&&['server/discover','tools/list'].includes(j.method)&&!Object.prototype.hasOwnProperty.call(j,'result');
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

describe('MCP audit request budgets and response correlation',()=>{
  it('rejects negative responses whose JSON-RPC ids do not match the probe',async()=>{
    let count=0;
    const server=createServer(async(req,res)=>{
      let raw='';for await(const chunk of req)raw+=chunk.toString();
      const message=JSON.parse(raw) as {id:number;method:string;jsonrpc:string;result?:unknown};
      count++;
      const result=message.method==='server/discover'
        ?{resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}}}
        :{resultType:'complete',tools:[]};
      const isDiscovery=message.jsonrpc==='2.0'&&['server/discover','tools/list'].includes(message.method)
        &&!Object.prototype.hasOwnProperty.call(message,'result');
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify(isDiscovery
        ?{jsonrpc:'2.0',id:message.id,result}
        :{jsonrpc:'2.0',id:999,error:{code:-32600,message:'Unknown request'}}));
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing server port');
      const contract=McpContractSchema.parse({version:1,name:'id-test',server:{
        transport:'streamable-http',url:`http://127.0.0.1:${addr.port}/mcp`,protocol_version:'2026-07-28',
        timeout_seconds:5,
      }});
      const result=await auditLiveMcp(contract,{trusted:true,negativeProbes:true});
      expect(result.valid).toBe(false);
      expect(result.negativeProbes).toBe(3);
      expect(result.findings.filter(x=>x.reason==='mismatched-response-id')).toHaveLength(3);
      expect(count).toBe(5);
      expect(JSON.stringify(result)).not.toContain('Unknown request');
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },15_000);

  it('caps endless read-only pagination by request count rather than allowing 100 pages',async()=>{
    let calls=0;
    const server=createServer(async(req,res)=>{
      let raw='';for await(const chunk of req)raw+=chunk.toString();
      const message=JSON.parse(raw) as {id:number;method:string};
      calls++;
      const result=message.method==='server/discover'
        ?{resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}}}
        :{resultType:'complete',tools:[],nextCursor:'again'};
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing server port');
      const contract=McpContractSchema.parse({version:1,name:'paged',server:{
        transport:'streamable-http',url:`http://127.0.0.1:${addr.port}/mcp`,protocol_version:'2026-07-28',
        timeout_seconds:5,
      }});
      await expect(auditLiveMcp(contract,{trusted:true})).rejects.toThrow('request budget');
      expect(calls).toBe(24);
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },15_000);

  it('rejects unsafe URLs and invalid timeout options before attempting discovery',async()=>{
    const withUrl=(url:string)=>McpContractSchema.parse({version:1,name:'unsafe-url',server:{
      transport:'streamable-http',url,protocol_version:'2026-07-28',
    }});
    await expect(auditLiveMcp(withUrl('http://127.0.0.1:65534/mcp#fragment'),{trusted:true}))
      .rejects.toThrow('endpoint');
    await expect(auditLiveMcp(withUrl('http://127.0.0.1:65534/mcp'),{trusted:true,timeoutMs:10001}))
      .rejects.toThrow('timeout');
  });
});

describe('MCP discovery wall-clock budgets',()=>{
  it('aborts a stalled response body within a finite total duration',async()=>{
    const server=createServer(async(req,res)=>{
      let raw='';for await(const chunk of req)raw+=chunk.toString();
      const message=JSON.parse(raw) as {id:number;method:string};
      if(message.method==='server/discover'){
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result:{
          resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}},
        }}));
        return;
      }
      res.writeHead(200,{'content-type':'application/json'});
      res.write('{"jsonrpc":"2.0",');
      await new Promise(resolve=>setTimeout(resolve,400));
      res.end(' "id":1,"result":{"resultType":"complete","tools":[]}}');
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing server port');
      const contract=McpContractSchema.parse({version:1,name:'slow-page',server:{
        transport:'streamable-http',url:`http://127.0.0.1:${addr.port}/mcp`,
        protocol_version:'2026-07-28',timeout_seconds:10,
      }});
      const started=performance.now();
      await expect(inspectMcpContract(contract,{maxDurationMs:150,maxRequests:4})).rejects.toThrow();
      expect(performance.now()-started).toBeLessThan(1500);
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },15_000);
});

describe('MCP negative HTTP classification',()=>{
  it('does not confuse authentication and rate limits with protocol validation',async()=>{
    for(const status of [401,403,429,400,422]){
      const server=createServer(async(req,res)=>{
        let raw='';for await(const chunk of req)raw+=chunk.toString();
        const message=JSON.parse(raw) as {id:number;method:string;jsonrpc:string;result?:unknown};
        const valid=message.jsonrpc==='2.0'&&['server/discover','tools/list'].includes(message.method)
          &&!Object.prototype.hasOwnProperty.call(message,'result');
        if(!valid){res.writeHead(status);res.end('credentials hidden');return;}
        const result=message.method==='server/discover'
          ?{resultType:'complete',supportedVersions:['2026-07-28'],capabilities:{tools:{}}}
          :{resultType:'complete',tools:[]};
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
      });
      await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
      try{
        const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing server port');
        const contract=McpContractSchema.parse({version:1,name:'http-status',server:{
          transport:'streamable-http',url:`http://127.0.0.1:${addr.port}/mcp`,
          protocol_version:'2026-07-28',timeout_seconds:5,
        }});
        const result=await auditLiveMcp(contract,{trusted:true,negativeProbes:true,maxRequests:1});
        expect(result.findings.find(x=>x.reason===`http-${status}`)?.passed)
          .toBe(false);
        expect(JSON.stringify(result)).not.toContain('credentials hidden');
      }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
    }
  },15_000);
});
