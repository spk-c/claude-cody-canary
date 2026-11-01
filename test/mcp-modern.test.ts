import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { McpContractSchema, inspectMcpContract } from '../src/mcp-contract.js';

const MODERN_SERVER = String.raw`
let input = '';
const send = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: { resultType: 'complete', ...result } })+'\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
 input += chunk;
 while(input.includes('\n')) {
   const at = input.indexOf('\n'); const line = input.slice(0,at).trim(); input=input.slice(at+1);
   if(!line)continue;
   const msg = JSON.parse(line);
   if(msg.method === 'initialize' || msg.method === 'notifications/initialized') {
     process.stderr.write('legacy handshake not permitted'); process.exit(3);
   }
   const meta=msg.params?._meta;
   if(!meta || meta['io.modelcontextprotocol/protocolVersion']!=='2026-07-28' ||
     !meta['io.modelcontextprotocol/clientCapabilities'] || !meta['io.modelcontextprotocol/clientInfo']) {
     process.stderr.write('invalid metadata');process.exit(4);
   }
   if(msg.method==='server/discover') {
     send(msg.id,{supportedVersions:['2026-07-28'],capabilities:{tools:{}},_meta:{'io.modelcontextprotocol/serverInfo':{name:'modern-stdio',version:'1.0.0'}}});
   } else if (msg.method==='tools/list') {
     send(msg.id,{tools:[{name:'safe',inputSchema:{type:'object'},annotations:{readOnlyHint:true,destructiveHint:false}}]});
   } else {
     process.stderr.write('unexpected method '+msg.method);process.exit(5);
   }
 }
});
`;

describe('MCP 2026-07-28 stateless stdio inspector', () => {
  it('uses discover instead of initialize and sends an envelope on each list request', async () => {
    const dir=await mkdtemp(path.join(tmpdir(),'canary-mcp-2026-'));
    try {
      const server=path.join(dir,'modern.cjs');
      await writeFile(server,MODERN_SERVER,'utf8');
      const contract=McpContractSchema.parse({
        version:1,name:'modern-server',
        server:{command:process.execPath,args:[server],protocol_version:'2026-07-28',timeout_seconds:10},
        expect:{tools:{require:['safe'],deny_destructive:true,require_read_only:['safe']}},
      });
      const snapshot=await inspectMcpContract(contract,{cwd:dir});
      expect(snapshot.protocolVersion).toBe('2026-07-28');
      expect(snapshot.serverInfo?.name).toBe('modern-stdio');
      expect(snapshot.tools.map(t=>t.name)).toEqual(['safe']);
      expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    } finally { await rm(dir,{recursive:true,force:true}); }
  }, 15000);
});
