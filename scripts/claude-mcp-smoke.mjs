#!/usr/bin/env node
// Real Claude Code executable + isolated stdio MCP server, no model API key needed.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSafeMcpFixture } from '../dist/mcp-fixtures.js';
import { spawnCapture } from '../dist/process.js';

const root = await mkdtemp(path.join(tmpdir(), 'claude-canary-real-cli-'));
const server = await createSafeMcpFixture('read');
const env = { ...process.env, CI: 'true', DISABLE_TELEMETRY: '1' };
async function call(args) {
  const result = await spawnCapture('claude', args, { cwd:root,env,timeoutMs:90_000,maxOutputChars:1024*1024 });
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    throw new Error('claude '+args.slice(0,2).join(' ')+' failed (exit='+result.code+') '+result.stderr.slice(0,1000));
  }
  return result.stdout + result.stderr;
}
try {
  const version = await call(['--version']);
  if (!/\d+\.\d+\.\d+/.test(version)) throw new Error('Claude Code version was not recognized.');
  await call(['mcp','add','--transport','stdio','--scope','project','canary-fixture','--',process.execPath,server.scriptPath]);
  const config = JSON.parse(await readFile(path.join(root,'.mcp.json'),'utf8'));
  if (!config.mcpServers?.['canary-fixture']) throw new Error('Claude did not register MCP fixture.');
  const list = await call(['mcp','list']);
  if (!list.includes('canary-fixture')) throw new Error('Claude MCP list omitted fixture.');
  if (!/connected/i.test(list) || /failed to connect/i.test(list)) {
    throw new Error('Claude did not successfully connect to MCP fixture: '+list.slice(0,1600));
  }
  console.log('Claude Code '+version.trim()+' connected to real stdio MCP fixture.');
} finally {
  await server.cleanup();
  await rm(root,{recursive:true,force:true});
}
