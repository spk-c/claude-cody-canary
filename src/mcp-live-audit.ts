import { inspectMcpContract, type McpContract } from './mcp-contract.js';
import { validateMcpEnvelopes } from './mcp-conformance.js';

export interface LiveMcpFinding { name:string; passed:boolean; reason:string; }
export interface LiveMcpAudit {
  schemaVersion:1; transport:'stdio'|'streamable-http'; valid:boolean;
  protocolVersion:string; toolsDiscovered:number; findings:LiveMcpFinding[];
  negativeProbes: number;
}
export interface LiveMcpOptions {
  trusted: true; negativeProbes?: boolean; maxRequests?: number; timeoutMs?: number;
  fetchImpl?: typeof fetch;
}
function loopback(url:URL):boolean {
  return url.hostname==='127.0.0.1'||url.hostname==='[::1]';
}
async function sendNegativeProbe(url:URL, payload:{id:number;method:string}, options:LiveMcpOptions):Promise<LiveMcpFinding> {
  const timeout=options.timeoutMs??4000;
  const response=await (options.fetchImpl??fetch)(url,{
    method:'POST',
    redirect:'error',
    signal:AbortSignal.timeout(timeout),
    headers:{'content-type':'application/json','accept':'application/json',
      'mcp-protocol-version':'2026-07-28','mcp-method':payload.method},
    body:JSON.stringify(payload),
  });
  if(!response.ok){
    await response.body?.cancel().catch(()=>undefined);
    return{name:'negative-envelope',passed:response.status===400||response.status===422,reason:'http-'+response.status};
  }
  const type=response.headers.get('content-type')?.toLowerCase()??'';
  if(!type.startsWith('application/json'))return{name:'negative-envelope',passed:false,reason:'unexpected-response-content-type'};
  if(Number(response.headers.get('content-length')??0)>65536)return{name:'negative-envelope',passed:false,reason:'oversized-response'};
  if(!response.body)return{name:'negative-envelope',passed:false,reason:'missing-response-body'};
  const reader=response.body.getReader();
  let size=0;
  const chunks:Uint8Array[]=[];
  let done=false;
  try {
    for (;;) {
      const result=await reader.read();
      if(result.done){done=true;break;}
      size+=result.value.byteLength;
      if(size>65536)return{name:'negative-envelope',passed:false,reason:'oversized-response'};
      chunks.push(result.value);
    }
  }finally{
    if(!done)await reader.cancel().catch(()=>undefined);
    reader.releaseLock();
  }
  const data=new Uint8Array(size);
  let offset=0;
  for(const c of chunks){data.set(c,offset);offset+=c.byteLength;}
  try {
    const envelope=JSON.parse(new TextDecoder().decode(data)) as unknown;
    const structural=validateMcpEnvelopes([envelope]);
    const error=typeof envelope==='object'&&envelope!==null&&!Array.isArray(envelope)
      &&Object.prototype.hasOwnProperty.call(envelope,'error');
    const idMatches=typeof envelope==='object'&&envelope!==null&&!Array.isArray(envelope)
      &&Object.prototype.hasOwnProperty.call(envelope,'id')&&(envelope as Record<string,unknown>).id===payload.id;
    const passed=structural.valid&&error&&idMatches;
    return{name:'negative-envelope',passed,
      reason:!idMatches?'mismatched-response-id':passed?'rejected-by-server':'invalid-probe-response'};
  }catch{return{name:'negative-envelope',passed:false,reason:'response-invalid-json'};}
}
/**
 * Acknowledged trusted-server audit. Positive checks use existing MCP inspector,
 * which does not call tools. Deliberately malformed messages are sent ONLY to
 * numeric loopback endpoints, with a separate explicit opt-in.
 */
export async function auditLiveMcp(contract:McpContract,options:LiveMcpOptions):Promise<LiveMcpAudit>{
  if(options?.trusted!==true)throw new Error('Explicit trusted-server acknowledgement required.');
  const max=options.maxRequests??3;
  if(!Number.isSafeInteger(max)||max<1||max>3)throw new Error('Maximum three negative MCP requests.');
  const timeout=options.timeoutMs??4000;
  if(!Number.isSafeInteger(timeout)||timeout<100||timeout>10_000)throw new Error('Invalid MCP probe timeout.');
  if(options.negativeProbes&&contract.server.transport!=='streamable-http')
    throw new Error('Negative probes require Streamable HTTP.');
  const url=contract.server.transport==='streamable-http' ? new URL(contract.server.url!) : null;
  if(url&&(url.username||url.password||url.hash||(!loopback(url)&&url.protocol!=='https:')))
    throw new Error('MCP endpoint must be loopback or HTTPS without URL credentials.');
  if(options.negativeProbes&&url&&!loopback(url))
    throw new Error('Negative MCP probes are restricted to numeric loopback endpoints.');
  // Cap discovery across all pagination pages and transports, not only negative probes.
  const snapshot=await inspectMcpContract(contract,{maxRequests:24,maxDurationMs:30_000});
  const findings:LiveMcpFinding[]=[{name:'read-only-discovery',passed:true,reason:'inspector-complete'}];
  if(snapshot.protocolVersion!==contract.server.protocol_version)
    findings.push({name:'version-negotiation',passed:false,reason:'protocol-version-mismatch'});
  if(options.negativeProbes&&url){
    const probes=[
      {jsonrpc:'1.0',id:91,method:'tools/list',params:{}},
      {jsonrpc:'2.0',id:92,method:'',params:{}},
      {jsonrpc:'2.0',id:93,method:'tools/list',result:{}},
    ];
    for(const payload of probes.slice(0,max)){
      try{findings.push(await sendNegativeProbe(url,payload,options));}
      catch{findings.push({name:'negative-envelope',passed:false,reason:'probe-failed-or-timed-out'});}
    }
  }
  return {schemaVersion:1,transport:contract.server.transport,valid:findings.every(x=>x.passed),
    protocolVersion:snapshot.protocolVersion,toolsDiscovered:snapshot.tools.length,
    findings,negativeProbes:options.negativeProbes?Math.min(3,max):0};
}
