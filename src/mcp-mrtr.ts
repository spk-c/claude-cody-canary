/**
 * Offline MRTR retry envelope builder. Caller must explicitly approve and
 * deliver the response; this module never invokes tools or performs I/O.
 */
export function prepareMcpMrtrRetry(
  original:unknown,result:unknown,inputResponses:unknown,nextId:number,approval:{approved:true},
):Record<string,unknown>{
  if(approval?.approved!==true)throw new Error('MRTR retry requires explicit approval.');
  if(!Number.isSafeInteger(nextId)||nextId<0)throw new Error('Invalid new MCP request ID.');
  const record=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  if(!record(original)||original.jsonrpc!=='2.0'||typeof original.method!=='string'||
    !['tools/call','resources/read','prompts/get'].includes(original.method)||
    !record(original.params)||original.id===nextId)throw new Error('Invalid original MCP MRTR request.');
  if(!record(result)||result.resultType!=='input_required'||
    (result.inputRequests!==undefined&&!record(result.inputRequests)))
    throw new Error('MRTR input required result expected.');
  if(!record(inputResponses))throw new Error('MRTR input responses must be an object.');
  // MCP 2026-07-28 permits requestState-only input_required for load shedding.
  const requests=record(result.inputRequests)?result.inputRequests:{};
  const wanted=Object.keys(requests).sort();
  const supplied=Object.keys(inputResponses).sort();
  if(wanted.length>16||JSON.stringify(wanted)!==JSON.stringify(supplied)||
    wanted.some(x=>! /^[a-zA-Z0-9_.-]{1,64}$/.test(x)))
    throw new Error('MRTR response IDs do not match the requested inputs.');
  if(result.requestState!==undefined&&
    (typeof result.requestState!=='string'||result.requestState.length>16384))
    throw new Error('Invalid MRTR opaque requestState.');
  if(wanted.length===0&&result.requestState===undefined)
    throw new Error('MRTR must contain inputRequests or requestState.');
  for(const entry of Object.values(requests)){
    if(!record(entry)||typeof entry.method!=='string'||
       !['elicitation/create','sampling/createMessage','roots/list'].includes(entry.method)||
       !record(entry.params))
      throw new Error('Unsupported MRTR input request method or params.');
  }
  // Responses and opaque state belong ONLY to the preceding round.
  // Remove old values before applying the current result (MCP 2026-07-28).
  const params:Record<string,unknown>={...original.params};
  delete params.inputResponses;
  delete params.requestState;
  if(wanted.length)params.inputResponses=inputResponses;
  if(result.requestState!==undefined)params.requestState=result.requestState;
  if(Buffer.byteLength(JSON.stringify(params),'utf8')>65536)throw new Error('MRTR retry exceeds 64 KiB.');
  return {jsonrpc:'2.0',id:nextId,method:original.method,params};
}
