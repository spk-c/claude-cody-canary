import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {auditStdioNegativeFixture} from '../src/mcp-stdio-negative.js';
const fixture=String.raw`
process.stdin.setEncoding('utf8');
let buf='';
process.stdin.on('data',data=>{
 buf+=data;
 while(buf.includes('\n')){
  const at=buf.indexOf('\n');
  const line=buf.slice(0,at).trim();buf=buf.slice(at+1);
  if(!line)continue;
  const m=JSON.parse(line);
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32600,message:'Invalid Request'}})+'\n');
 }
});
`;
describe('strictly opt-in local stdio negative fixtures',()=>{
  it('tests malformed envelopes without running tool calls or inheriting secrets',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'canary-negative-'));
    try{
      const file=path.join(dir,'fixture.cjs');await writeFile(file,fixture);
      const result=await auditStdioNegativeFixture(file,{trusted:true});
      expect(result.valid).toBe(true);
      expect(result.probes).toBe(3);
      expect(result.findings).toHaveLength(3);
    }finally{await rm(dir,{recursive:true,force:true});}
  },10000);
  it('fails for wrong ids and invalid server behavior',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'canary-negative-'));
    try{
      const file=path.join(dir,'fixture.cjs');await writeFile(file,fixture.replace('id:m.id','id:999'));
      const result=await auditStdioNegativeFixture(file,{trusted:true});
      expect(result.valid).toBe(false);
      expect(result.findings.every(x=>x.reason==='mismatched-response')).toBe(true);
      await expect(auditStdioNegativeFixture('relative.cjs',{trusted:true})).rejects.toThrow('absolute');
      await expect(auditStdioNegativeFixture(file,{trusted:true,timeoutMs:50000})).rejects.toThrow('timeout');
    }finally{await rm(dir,{recursive:true,force:true});}
  },10000);
});
