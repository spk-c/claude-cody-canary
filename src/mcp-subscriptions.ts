import {CANARY_VERSION} from './version.js';

export interface McpSubscriptionProbe {
  schemaVersion:1;
  valid:boolean;
  acknowledged:boolean;
  notificationsReceived:number;
  cancelledByClient:boolean;
  reason:'ok'|'missing-acknowledgement'|'invalid-stream'|'timeout'|'unexpected-notification';
}
/** An explicitly approved, loopback-only, bounded 2026-07-28 notification probe. */
export async function probeMcpSubscriptions(
  endpoint:string,options:{trusted:true;maxNotifications?:number;timeoutMs?:number;fetchImpl?:typeof fetch},
):Promise<McpSubscriptionProbe>{
  if(options?.trusted!==true)throw new Error('Explicit trusted-server acknowledgement required.');
  const url=new URL(endpoint);
  if(!['127.0.0.1','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol)||
    url.username||url.password||url.hash)throw new Error('Subscriptions require explicit numeric loopback HTTP endpoint.');
  const max=options.maxNotifications??2,timeout=options.timeoutMs??2000;
  if(!Number.isSafeInteger(max)||max<1||max>16||!Number.isSafeInteger(timeout)||timeout<100||timeout>10000)
    throw new Error('Invalid MCP subscriptions probe budget.');
  const abort=new AbortController();
  let deadlineExpired=false;
  const timer=setTimeout(()=>{deadlineExpired=true;abort.abort();},timeout);
  let acknowledged=false,notifications=0,bytes=0,events=0,reason:McpSubscriptionProbe['reason']='ok';
  const body={
    jsonrpc:'2.0',id:1,method:'subscriptions/listen',
    params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28',
      'io.modelcontextprotocol/clientCapabilities':{},
      'io.modelcontextprotocol/clientInfo':{name:'claude-code-canary',version:CANARY_VERSION}},
      notifications:{toolsListChanged:true}},
  };
  try{
    const response=await(options.fetchImpl??fetch)(url,{
      method:'POST',redirect:'error',signal:abort.signal,
      headers:{'content-type':'application/json','accept':'application/json, text/event-stream',
        'mcp-protocol-version':'2026-07-28','mcp-method':'subscriptions/listen'},
      body:JSON.stringify(body),
    });
    if(!response.ok||!response.body||!/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type')??''))
      return {schemaVersion:1,valid:false,acknowledged:false,notificationsReceived:0,cancelledByClient:false,reason:'invalid-stream'};
    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let text='',eventLines:string[]=[],eventType='';
    try{
      while(notifications<max){
        const next=await reader.read();
        if(next.done)break;
        bytes+=next.value.byteLength;
        if(bytes>65536)throw new Error('stream-limit');
        text+=decoder.decode(next.value,{stream:true});
        if(text.length>65536)throw new Error('stream-limit');
        for(;;){
          const index=text.indexOf('\n');
          if(index<0)break;
          const line=text.slice(0,index).replace(/\r$/,'');
          text=text.slice(index+1);
          if(line.startsWith(':'))continue;
          if(line!==''){
            if(line.startsWith('data:'))eventLines.push(line.slice(5).replace(/^ /,''));
            else if(line.startsWith('event:'))eventType=line.slice(6).trim();
            else if(line.startsWith('id:')||line.startsWith('retry:'))throw new Error('no-resumption');
            continue;
          }
          if(!eventLines.length)continue;
          if(++events>32||!!eventType&&eventType!=='message')throw new Error('event-limit');
          eventType='';
          let parsed:unknown;
          try{parsed=JSON.parse(eventLines.join('\n')) as unknown;}catch{throw new Error('invalid-json');}
          eventLines=[];
          if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid-event');
          const event=parsed as Record<string,unknown>;
          const meta=event.params&&typeof event.params==='object'&&!Array.isArray(event.params)
            ?(event.params as Record<string,unknown>)._meta:undefined;
          if(!meta||typeof meta!=='object'||Array.isArray(meta)||
            (meta as Record<string,unknown>)['io.modelcontextprotocol/subscriptionId']!==1)
            throw new Error('missing-subscription-id');
          if(event.method==='notifications/subscriptions/acknowledged'&&!acknowledged){
            const params=event.params as Record<string,unknown>;
            const honored=params.notifications;
            if(!honored||typeof honored!=='object'||Array.isArray(honored)||
              (honored as Record<string,unknown>).toolsListChanged!==true)throw new Error('filter-not-honored');
            acknowledged=true;
          }
          else if(event.method==='notifications/tools/list_changed'&&acknowledged)notifications++;
          else throw new Error('unexpected-notification');
          if(notifications>=max)break;
        }
      }
    }finally{
      abort.abort();
      await reader.cancel().catch(()=>undefined);
      reader.releaseLock();
    }
  }catch(error){
    reason=deadlineExpired?'timeout':'invalid-stream';
  }finally{clearTimeout(timer);}
  return {schemaVersion:1,valid:acknowledged&&notifications>=max&&reason==='ok',acknowledged,
    notificationsReceived:notifications,cancelledByClient:true,
    reason:reason==='ok'&&!acknowledged?'missing-acknowledgement':reason};
}
