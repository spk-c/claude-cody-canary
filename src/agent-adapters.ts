import { findExecutable } from './doctor.js';
export type KnownAgent = 'claude'|'codex'|'qwen';
export interface AgentAdapterStatus { agent:KnownAgent; executable:string; available:boolean; }
export const KNOWN_AGENT_ADAPTERS = Object.freeze([
  {agent:'claude' as const, executable:'claude'},
  {agent:'codex' as const, executable:'codex'},
  {agent:'qwen' as const, executable:'qwen'},
]);
/** Discovery-only adapter catalog. This does not execute an agent or assume CLI flag compatibility. */
export async function discoverAgentAdapters(cwd:string, env:NodeJS.ProcessEnv=process.env):Promise<AgentAdapterStatus[]> {
  const states:AgentAdapterStatus[]=[];
  for(const adapter of KNOWN_AGENT_ADAPTERS){
    const executable=await findExecutable(adapter.executable,cwd,env);
    states.push({agent:adapter.agent,executable:adapter.executable,available:executable!==null});
  }
  return states;
}
