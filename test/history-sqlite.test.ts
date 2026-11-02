import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {importHistorySqlite,queryHistorySqlite,queryHistoryTrends} from '../src/history-sqlite.js';
const nodeMajor=Number(process.versions.node.split('.')[0]);
describe('optional persistent history database',()=>{
  it.skipIf(nodeMajor<22)('imports idempotently, queries trends, retains only summaries',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'canary-history-sqlite-'));
    const index=path.join(dir,'history-index.json'),db=path.join(dir,'history.sqlite');
    try{
      await writeFile(index,JSON.stringify({schemaVersion:1,history:[
        {kind:'run',createdAt:'2026-11-02T09:00:00Z',passed:true},
        {kind:'run',createdAt:'2026-11-02T10:00:00Z',passed:false},
      ],secret:'do-not-import'}));
      const first=await importHistorySqlite(index,db);
      expect(first.imported).toBe(2);expect(first.total).toBe(2);
      expect((await importHistorySqlite(index,db)).imported).toBe(0);
      const history=await queryHistorySqlite(db);expect(history.history).toHaveLength(2);
      const trends=await queryHistoryTrends(db);expect(trends[0]).toMatchObject({total:2,failed:1});
      const bytes=await readFile(db);expect(bytes.toString()).not.toContain('do-not-import');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
