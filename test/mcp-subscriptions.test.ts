import {createServer} from 'node:http';
import {describe,expect,it} from 'vitest';
import {probeMcpSubscriptions} from '../src/mcp-subscriptions.js';
describe('MCP 2026 bounded notifications and cancellation',()=>{
  it('opens a trusted local subscription, observes an ack and change, then cancels',async()=>{
    let accepted=false;
    const server=createServer(async(req,res)=>{
      let body='';for await(const chunk of req)body+=chunk.toString();
      const msg=JSON.parse(body) as {id:number;method:string;params:{notifications:{toolsListChanged:boolean}}};
      accepted=msg.method==='subscriptions/listen'&&msg.params.notifications.toolsListChanged===true;
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});
      const event=(method:string)=>JSON.stringify({jsonrpc:'2.0',method,params:{
        _meta:{'io.modelcontextprotocol/subscriptionId':msg.id},notifications:{toolsListChanged:true},
      }});
      res.write('data: '+event('notifications/subscriptions/acknowledged')+'\n\n');
      res.write(': ping\n\n');
      res.write('data: '+event('notifications/tools/list_changed')+'\n\n');
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const addr=server.address();if(!addr||typeof addr==='string')throw Error('missing port');
      const report=await probeMcpSubscriptions('http://127.0.0.1:'+addr.port+'/mcp',{
        trusted:true,maxNotifications:1,timeoutMs:1500,
      });
      expect(accepted).toBe(true);
      expect(report.valid).toBe(true);
      expect(report.acknowledged).toBe(true);
      expect(report.notificationsReceived).toBe(1);
      expect(report.cancelledByClient).toBe(true);
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },10000);
  it('blocks external endpoints and excessive duration before performing any request',async()=>{
    await expect(probeMcpSubscriptions('https://example.com/mcp',{trusted:true})).rejects.toThrow('loopback');
    await expect(probeMcpSubscriptions('http://127.0.0.1/mcp',{trusted:true,timeoutMs:99999})).rejects.toThrow('budget');
  });
});
