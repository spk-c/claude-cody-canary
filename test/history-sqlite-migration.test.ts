import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {importHistorySqlite,queryHistoryMatrixSqlite,queryHistorySqlite} from '../src/history-sqlite.js';

const version=Number(process.versions.node.split('.')[0]);
describe('SQLite v1 to v2 history migration',()=>{
  it.skipIf(version<22)('preserves legacy rows and IDs, adds dimensions, and retains idempotency',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'canary-history-migrate-'));
    const dbFile=path.join(dir,'history.sqlite'),indexFile=path.join(dir,'index.json');
    try{
      const sqlite=await import('node:sqlite');
      const db=new sqlite.DatabaseSync(dbFile);
      db.exec(`CREATE TABLE history (
        id TEXT PRIMARY KEY,kind TEXT NOT NULL,created_at TEXT NOT NULL,
        status TEXT NOT NULL,passed INTEGER,failed INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX idx_history_day ON history(created_at);
        PRAGMA user_version=1;`);
      const old={kind:'run',createdAt:'2026-11-03T08:00:00.000Z',status:'passed',passed:1,failed:0};
      const id=createHash('sha256').update(JSON.stringify(old)).digest('hex');
      db.prepare('INSERT INTO history (id,kind,created_at,status,passed,failed) VALUES (?,?,?,?,?,?)')
        .run(id,old.kind,old.createdAt,old.status,old.passed,old.failed);
      db.close();
      const legacy={kind:'run',createdAt:old.createdAt,passed:true};
      await writeFile(indexFile,JSON.stringify({schemaVersion:1,history:[legacy]}));
      const first=await importHistorySqlite(indexFile,dbFile);
      expect(first).toMatchObject({imported:0,total:1,databaseVersion:2});
      const rows=await queryHistorySqlite(dbFile);
      expect(rows.history).toHaveLength(1);
      expect(rows.history[0]).not.toHaveProperty('version');
      const after=new sqlite.DatabaseSync(dbFile);
      const dbVersion=after.prepare('PRAGMA user_version').get() as {user_version:number};
      expect(dbVersion.user_version).toBe(2);
      expect((after.prepare('SELECT id FROM history').get() as {id:string}).id).toBe(id);
      after.close();
      await writeFile(indexFile,JSON.stringify({schemaVersion:1,history:[
        legacy,{kind:'run',createdAt:'2026-11-03T09:00:00Z',passed:false,
          version:'2.3.0',platform:'linux',plugin:'safe-plugin'},
      ]}));
      const second=await importHistorySqlite(indexFile,dbFile);
      expect(second).toMatchObject({imported:1,total:2});
      expect((await importHistorySqlite(indexFile,dbFile)).imported).toBe(0);
      const matrix=await queryHistoryMatrixSqlite(dbFile);
      expect(matrix.totalGroups).toBe(2);
      expect(matrix.groups.some(x=>x.version==='2.3.0'&&x.platform==='linux'&&
        x.plugin==='safe-plugin'&&x.failed===1)).toBe(true);
      expect(matrix.groups.some(x=>x.version==='unknown'&&x.passed===1)).toBe(true);
      expect((await queryHistoryMatrixSqlite(dbFile,1)).truncated).toBe(true);
      expect((await readFile(dbFile)).toString()).not.toContain('user prompt');
    }finally{await rm(dir,{recursive:true,force:true});}
  },20000);
  it.skipIf(version<22)('drops invalid identifying metadata instead of persisting it',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'canary-history-sanitize-'));
    const file=path.join(dir,'history.sqlite'),index=path.join(dir,'history.json');
    try{
      await writeFile(index,'\uFEFF'+JSON.stringify({schemaVersion:1,history:[
        {kind:'run',createdAt:'2026-11-03T00:00:00Z',passed:true,
          version:'C:/my/private/secret',platform:'unknown-os',plugin:'token=TOPSECRET'},
      ]}));
      await importHistorySqlite(index,file);
      expect((await queryHistorySqlite(file)).history[0]).not.toHaveProperty('plugin');
      const content=(await readFile(file)).toString();
      expect(content).not.toContain('TOPSECRET');
    }finally{await rm(dir,{recursive:true,force:true});}
  },10000);
});
