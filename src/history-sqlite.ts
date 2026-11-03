import { createHash } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { renderHistoryDashboard, type HistoryDashboardInput, type HistoryDashboardRecord } from './history-dashboard.js';
import { historyDimensions, type HistoryMatrix, type HistoryMatrixRow } from './history-dimensions.js';
import { wilsonPassRate } from './statistical-regressions.js';

export interface HistoryStoreResult { imported:number; total:number; schemaVersion:1; databaseVersion:2; }
export interface HistoryTrend { day:string; total:number; failed:number; }

/** Optional SQLite backend on Node 22.5+; Node 20 remains supported for core Canary.
 * SQLite schema v2 adds sparse, validated dimensions without modifying v1 IDs.
 */
async function openHistoryDb(file:string){
  if(!file.endsWith('.sqlite'))throw new Error('SQLite file must use .sqlite suffix.');
  try {
    const info=await lstat(file);
    if(!info.isFile()||info.isSymbolicLink())throw new Error('History SQLite database must be a regular, non-symlink file.');
  }catch(error) {
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  }
  let mod:typeof import('node:sqlite');
  try {mod=await import('node:sqlite');}
  catch {throw new Error('Optional SQLite history requires Node.js >=22.5; Node.js 20 uses JSON history.');}
  const db=new mod.DatabaseSync(file);
  try{
    const version=Number((db.prepare('PRAGMA user_version').get() as Record<string,unknown>)?.user_version??0);
    if(version>2||version<0)throw new Error('Unsupported history database schema.');
    if(version<2){
      db.exec('BEGIN IMMEDIATE');
      try{
        const current=Number((db.prepare('PRAGMA user_version').get() as Record<string,unknown>)?.user_version??0);
        if(current===0){
          db.exec(`CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at TEXT NOT NULL,
            status TEXT NOT NULL, passed INTEGER, failed INTEGER NOT NULL DEFAULT 0,
            version TEXT, platform TEXT, plugin TEXT);
            CREATE INDEX IF NOT EXISTS idx_history_day ON history(created_at);`);
        } else if(current===1){
          db.exec('ALTER TABLE history ADD COLUMN version TEXT;');
          db.exec('ALTER TABLE history ADD COLUMN platform TEXT;');
          db.exec('ALTER TABLE history ADD COLUMN plugin TEXT;');
        } else if(current!==2)throw new Error('Unsupported history database schema.');
        db.exec(`CREATE INDEX IF NOT EXISTS idx_history_dimensions
          ON history(version,platform,plugin);
          PRAGMA user_version=2;`);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    return db;
  }catch(error){db.close();throw error;}
}

function sanitized(input:HistoryDashboardRecord):{
  kind:string;createdAt:string;status:string;passed:number|null;failed:number;
  version?:string;platform?:string;plugin?:string;
}{
  const allowed=['suite','run','release-watch'];
  const kind=String(input.kind);
  if(!allowed.includes(kind))throw new Error('Unknown history record kind.');
  const at=String(input.createdAt);
  if(at.length>36||!Number.isFinite(Date.parse(at)))throw new Error('Invalid history time.');
  const failed=Number(input.failed??0);
  if(!Number.isSafeInteger(failed)||failed<0||failed>100000)throw new Error('Invalid history failure count.');
  const passed=input.passed===undefined?null:input.passed===true?1:input.passed===false?0:null;
  const status=String(input.status??(passed===1?'passed':passed===0||failed>0?'failed':'unknown')).slice(0,36);
  if(!/^[a-z0-9-]{1,36}$/i.test(status))throw new Error('Unsafe history status.');
  return {kind,createdAt:new Date(at).toISOString(),status,passed,failed,...historyDimensions(input)};
}

/** Import only validated privacy-preserving history-index records, never source artifacts. */
export async function importHistorySqlite(indexFile:string,dbPath:string,retain=10000):Promise<HistoryStoreResult>{
  if(!Number.isSafeInteger(retain)||retain<10||retain>100000)throw new Error('Invalid retention cap.');
  if((await stat(indexFile)).size>4*1024*1024)throw new Error('History index too large.');
  const data=JSON.parse((await readFile(indexFile,'utf8')).replace(/^\uFEFF/, '')) as HistoryDashboardInput;
  if(data.schemaVersion!==1||!Array.isArray(data.history)||data.history.length>5000)throw new Error('Invalid history index.');
  const entries=data.history.map(sanitized);
  const db=await openHistoryDb(dbPath);
  let imported=0;
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      const add=db.prepare('INSERT OR IGNORE INTO history (id,kind,created_at,status,passed,failed,version,platform,plugin) VALUES (?,?,?,?,?,?,?,?,?)');
      for(const x of entries){
        const id=createHash('sha256').update(JSON.stringify(x)).digest('hex');
        const res=add.run(id,x.kind,x.createdAt,x.status,x.passed,x.failed,
          x.version??null,x.platform??null,x.plugin??null);
        imported+=Number(res.changes);
      }
      db.prepare('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC,id LIMIT ?)').run(retain);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    const row=db.prepare('SELECT count(*) AS total FROM history').get() as Record<string,unknown>;
    return {imported,total:Number(row.total),schemaVersion:1,databaseVersion:2};
  }finally{db.close();}
}

export async function queryHistorySqlite(dbPath:string,limit=5000):Promise<HistoryDashboardInput>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>5000)throw new Error('Invalid result limit.');
  const db=await openHistoryDb(dbPath);
  try {
    const rows=db.prepare('SELECT kind,created_at,status,passed,failed,version,platform,plugin FROM history ORDER BY created_at DESC,id LIMIT ?').all(limit);
    const history:HistoryDashboardRecord[]=rows.map(raw=>{
      const x=raw as Record<string,unknown>;
      return {kind:String(x.kind),createdAt:String(x.created_at),status:String(x.status),
        ...(x.passed===null?{}:{passed:Number(x.passed)===1}),failed:Number(x.failed),
        ...(x.version===null?{}:{version:String(x.version)}),
        ...(x.platform===null?{}:{platform:String(x.platform)}),
        ...(x.plugin===null?{}:{plugin:String(x.plugin)})};
    });
    return {schemaVersion:1,history};
  }finally{db.close();}
}
export async function queryHistoryTrends(dbPath:string):Promise<HistoryTrend[]>{
  const db=await openHistoryDb(dbPath);
  try {
    return db.prepare(`SELECT substr(created_at,1,10) AS day,count(*) AS total,
      sum(CASE WHEN passed=0 OR failed>0 THEN 1 ELSE 0 END) AS failed FROM history GROUP BY day ORDER BY day`).all().map(raw=>{
        const x=raw as Record<string,unknown>;
        return {day:String(x.day),total:Number(x.total),failed:Number(x.failed)};
      });
  }finally{db.close();}
}
/** Entire retained store is grouped in SQLite, not restricted to the newest 5000 dashboard rows. */
export async function queryHistoryMatrixSqlite(dbPath:string,limit=50):Promise<HistoryMatrix>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>5000)throw new Error('Invalid history matrix group limit.');
  const db=await openHistoryDb(dbPath);
  try{
    const total=Number((db.prepare(`SELECT count(*) AS n FROM
      (SELECT version,platform,plugin FROM history GROUP BY version,platform,plugin)`).get() as Record<string,unknown>).n);
    const rows=db.prepare(`SELECT coalesce(version,'unknown') AS version,
      coalesce(platform,'unknown') AS platform,coalesce(plugin,'unknown') AS plugin,
      count(*) AS total,
      sum(CASE WHEN passed=0 OR failed>0 THEN 1 ELSE 0 END) AS failed,
      sum(CASE WHEN passed=1 AND failed=0 THEN 1 ELSE 0 END) AS passed,
      sum(CASE WHEN passed IS NULL AND failed=0 THEN 1 ELSE 0 END) AS unknown
      FROM history GROUP BY version,platform,plugin
      ORDER BY total DESC,version,platform,plugin LIMIT ?`).all(limit);
    const groups:HistoryMatrixRow[]=rows.map(raw=>{
      const row=raw as Record<string,unknown>;
      const passed=Number(row.passed),failed=Number(row.failed);
      return {version:String(row.version),platform:String(row.platform),plugin:String(row.plugin),
        total:Number(row.total),passed,failed,unknown:Number(row.unknown),
        ...(passed+failed>=10?{passRate:wilsonPassRate(passed,passed+failed)}:{})};
    });
    return {schemaVersion:1,dimensions:['version','platform','plugin'],
      totalGroups:total,truncated:total>limit,groups};
  }finally{db.close();}
}
export async function renderStoredHistory(dbPath:string):Promise<string>{
  return renderHistoryDashboard(await queryHistorySqlite(dbPath));
}
