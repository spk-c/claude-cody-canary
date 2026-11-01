#!/usr/bin/env node
// Offline stdio fixture for public release / GitHub Action consumer testing.
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (input.length > 1024 * 1024) process.exit(3);
  while (input.includes('\n')) {
    const end = input.indexOf('\n');
    const line = input.slice(0, end).trim();
    input = input.slice(end + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { process.exit(4); }
    if (msg.method === 'notifications/initialized') continue;
    let result;
    switch (msg.method) {
      case 'initialize':
        result = { protocolVersion:'2025-11-25', capabilities:{ tools:{} },
          serverInfo:{ name:'canary-consumer-fixture', version:'1.0.0' } };
        break;
      case 'tools/list':
        result = { tools:[{name:'ping',description:'Read-only fixture',
          inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true,destructiveHint:false}}] };
        break;
      case 'prompts/list': result = { prompts:[] }; break;
      case 'resources/list': result = { resources:[] }; break;
      case 'resources/templates/list': result = { resourceTemplates:[] }; break;
      default:
        process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'unsupported'}})+'\n');
        continue;
    }
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n');
  }
});
