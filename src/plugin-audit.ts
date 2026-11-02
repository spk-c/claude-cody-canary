import { discoverPlugin, type PluginDiscovery } from './plugin-init.js';
export type PluginAuditFinding = { code:string; severity:'info'|'warning'; component:string };
export interface PluginAuditReport {
  schemaVersion:1; pluginName:string; counts:Record<string,number>; findings:PluginAuditFinding[]; needsModelTests:boolean;
}
/** Read-only structural compatibility audit: never loads or executes plugin commands. */
export function auditPluginDiscovery(d:PluginDiscovery):PluginAuditReport {
  const counts={commands:d.commands.length,agents:d.agents.length,skills:d.skills.length,hooks:d.hooks.length,
    mcpServers:d.mcpServers.length,lspServers:d.lspServers.length,monitors:d.monitors.length,dependencies:d.dependencies.length};
  const findings:PluginAuditFinding[]=[];
  for(const warning of d.warnings){
    findings.push({code:'DISCOVERY_WARNING',severity:'warning',component:warning.slice(0,180)});
  }
  if(counts.hooks)findings.push({code:'HOOKS_REQUIRE_RUNTIME_TESTS',severity:'info',component:'hooks'});
  if(counts.mcpServers)findings.push({code:'MCP_CONTRACT_SNAPSHOT_RECOMMENDED',severity:'info',component:'mcp'});
  if(counts.lspServers)findings.push({code:'LSP_EXECUTABLE_CHECK_RECOMMENDED',severity:'info',component:'lsp'});
  if(counts.dependencies)findings.push({code:'PLUGIN_DEPENDENCY_VERSION_CHECK',severity:'info',component:'dependencies'});
  return {schemaVersion:1,pluginName:d.pluginName,counts,findings,needsModelTests:counts.commands+counts.agents+counts.skills+counts.hooks>0};
}
export async function auditPluginDirectory(dir:string):Promise<PluginAuditReport> {
  return auditPluginDiscovery(await discoverPlugin(dir));
}
