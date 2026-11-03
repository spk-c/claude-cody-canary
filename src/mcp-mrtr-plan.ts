import {prepareMcpMrtrRetry} from './mcp-mrtr.js';

type ApprovedRound={
  result:unknown;
  inputResponses:unknown;
  nextId:number;
  approval:{approved:true};
};
export interface MrtrRoundSummary{
  round:number;requestId:number;inputCount:number;opaqueRequestState:boolean;
}
export interface MrtrOfflinePlan{
  schemaVersion:1;
  protocolVersion:'2026-07-28';
  transport:'offline-only';
  approvedRounds:number;
  roundSummaries:MrtrRoundSummary[];
  final:'pending'|'success'|'jsonrpc-error';
  /** No network requests, tools or model calls are performed. */
  executedRequests:0;
}
function object(x:unknown):x is Record<string,unknown>{
  return x!==null&&typeof x==='object'&&!Array.isArray(x);
}
/** Pure, bounded offline MRTR state transition audit. Each new round requires explicit approval. */
export function planApprovedMcpMrtrRounds(
  initialRequest:unknown,
  rounds:readonly ApprovedRound[],
  finalResponse?:unknown,
):MrtrOfflinePlan{
  if(!object(initialRequest)||initialRequest.jsonrpc!=='2.0'||
    !Number.isSafeInteger(initialRequest.id)||Number(initialRequest.id)<0)
    throw new Error('Initial MRTR request must have a valid unique numeric ID.');
  if(!Array.isArray(rounds)||rounds.length<1||rounds.length>8)
    throw new Error('MRTR has a maximum of eight independently reviewed rounds.');
  let current:unknown=initialRequest;
  const usedIds=new Set<number>([Number(initialRequest.id)]);
  const summaries:MrtrRoundSummary[]=[];
  for(let i=0;i<rounds.length;i++){
    const step=rounds[i];
    if(!step||step.approval?.approved!==true)
      throw new Error('Each MRTR round requires explicit independent approval.');
    if(!Number.isSafeInteger(step.nextId)||step.nextId<0||usedIds.has(step.nextId))
      throw new Error('MRTR request ID reused across rounds.');
    const next=prepareMcpMrtrRetry(current,step.result,step.inputResponses,step.nextId,step.approval);
    usedIds.add(step.nextId);
    const result=step.result as Record<string,unknown>;
    const requests=object(result.inputRequests)?result.inputRequests:{};
    summaries.push({round:i+1,requestId:step.nextId,inputCount:Object.keys(requests).length,
      opaqueRequestState:result.requestState!==undefined});
    current=next;
  }
  let final:MrtrOfflinePlan['final']='pending';
  if(finalResponse!==undefined){
    if(!object(finalResponse)||finalResponse.jsonrpc!=='2.0'||
       finalResponse.id!==(current as Record<string,unknown>).id||
       Object.hasOwn(finalResponse,'error')===Object.hasOwn(finalResponse,'result'))
      throw new Error('Final MRTR JSON-RPC response is missing, mismatched or ambiguous.');
    final=Object.hasOwn(finalResponse,'error')?'jsonrpc-error':'success';
  }
  return {schemaVersion:1,protocolVersion:'2026-07-28',transport:'offline-only',
    approvedRounds:summaries.length,roundSummaries:summaries,final,executedRequests:0};
}
