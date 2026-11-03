import {createServer} from 'node:http';
import {describe,expect,it} from 'vitest';
import {probeMcpSubscriptionCycles} from '../src/mcp-subscription-resilience.js';

describe('explicit bounded MCP subscriptions/listen reconnection cycles',()=>{
 it('opens independent streams with distinct request IDs and closes each',async()=>{
  const ids:number[]=[];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk.toString();
    const request=JSON.parse(raw) as {id:number;method:string};
    ids.push(request.id);
    res.writeHead(200,{'content-type':'text/event-stream'});
    const emit=(method:string)=>JSON.stringify({jsonrpc:'2.0',method,params:{
      _meta:{'io.modelcontextprotocol/subscriptionId':request.id},notifications:{toolsListChanged:true},
    }});
    res.write('data: '+emit('notifications/subscriptions/acknowledged')+'\n\n');
    res.write('data: '+emit('notifications/tools/list_changed')+'\n\n');
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  try{
    const addr=server.address();if(!addr||typeof addr==='string')throw new Error('No fixture port');
    const report=await probeMcpSubscriptionCycles('http://127.0.0.1:'+addr.port+'/mcp',{
      trusted:true,cycles:3,timeoutMs:1200,totalBudgetMs:6000,
    });
    expect(ids).toEqual([100,101,102]);
    expect(report).toMatchObject({valid:true,completedCycles:3,acknowledgedCycles:3,
      notificationsReceived:3,reason:'ok'});
    expect(JSON.stringify(report)).not.toContain(String(addr.port));
  }finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
 },12000);
 it('stops at first mismatched correlation and does not retry invalid streams',async()=>{
  let called=0;
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk.toString();called++;
    const data=JSON.stringify({jsonrpc:'2.0',method:'notifications/subscriptions/acknowledged',
      params:{_meta:{'io.modelcontextprotocol/subscriptionId':999},notifications:{toolsListChanged:true}}});
    res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+data+'\n\n');
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  try{
    const addr=server.address();if(!addr||typeof addr==='string')throw Error('No fixture port');
    const report=await probeMcpSubscriptionCycles('http://127.0.0.1:'+addr.port+'/mcp',{trusted:true});
    expect(report.valid).toBe(false);
    expect(report.completedCycles).toBe(1);
    expect(report.reason).toBe('cycle-failed');
    expect(called).toBe(1);
  }finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
 },12000);
 it('rejects non-local targets, missing approvals and excessive budgets',async()=>{
  await expect(probeMcpSubscriptionCycles('https://example.com/mcp',{trusted:true})).rejects.toThrow('loopback');
  await expect(probeMcpSubscriptionCycles('http://127.0.0.1/mcp',{trusted:true,cycles:100}))
    .rejects.toThrow('budget');
  await expect(probeMcpSubscriptionCycles('http://127.0.0.1/mcp',{trusted:false as never}))
    .rejects.toThrow('trusted');
 });
});