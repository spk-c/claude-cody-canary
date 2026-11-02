import { createHash } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { renderHistoryDashboard } from './history-dashboard.js';
/** Optional SQLite backend on Node 22.5+; Node 20 remains supported for core Canary. */
async function openHistoryDb(path) {
    if (!path.endsWith('.sqlite'))
        throw new Error('SQLite file must use .sqlite suffix.');
    try {
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink())
            throw new Error('History SQLite database must be a regular, non-symlink file.');
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    let mod;
    try {
        mod = await import('node:sqlite');
    }
    catch {
        throw new Error('Optional SQLite history requires Node.js >=22.5; Node.js 20 uses JSON history.');
    }
    const db = new mod.DatabaseSync(path);
    try {
        const row = db.prepare('PRAGMA user_version').get();
        const version = Number(row?.user_version ?? 0);
        if (version > 1)
            throw new Error('Unsupported future history database schema.');
        if (version === 0) {
            db.exec(`CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at TEXT NOT NULL,
        status TEXT NOT NULL, passed INTEGER, failed INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS idx_history_day ON history(created_at);
        PRAGMA user_version=1;`);
        }
        return db;
    }
    catch (error) {
        db.close();
        throw error;
    }
}
function sanitized(input) {
    const valid = ['suite', 'run', 'release-watch'];
    const kind = String(input.kind);
    if (!valid.includes(kind))
        throw new Error('Unknown history record kind.');
    const at = String(input.createdAt);
    if (at.length > 36 || !Number.isFinite(Date.parse(at)))
        throw new Error('Invalid history time.');
    const failed = Number(input.failed ?? 0);
    if (!Number.isSafeInteger(failed) || failed < 0 || failed > 100000)
        throw new Error('Invalid history failure count.');
    const passed = input.passed === undefined ? null : input.passed === true ? 1 : input.passed === false ? 0 : null;
    const status = String(input.status ?? (passed === 1 ? 'passed' : passed === 0 || failed > 0 ? 'failed' : 'unknown')).slice(0, 36);
    if (!/^[a-z0-9-]{1,36}$/i.test(status))
        throw new Error('Unsafe history status.');
    return { kind, createdAt: new Date(at).toISOString(), status, passed, failed };
}
/** Import only validated privacy-preserving history-index records, never source artifacts. */
export async function importHistorySqlite(indexFile, dbPath, retain = 10000) {
    if (!Number.isSafeInteger(retain) || retain < 10 || retain > 100000)
        throw new Error('Invalid retention cap.');
    if ((await stat(indexFile)).size > 4 * 1024 * 1024)
        throw new Error('History index too large.');
    const data = JSON.parse(await readFile(indexFile, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.history) || data.history.length > 5000)
        throw new Error('Invalid history index.');
    const entries = data.history.map(sanitized);
    const db = await openHistoryDb(dbPath);
    let imported = 0;
    try {
        db.exec('BEGIN IMMEDIATE');
        try {
            const add = db.prepare('INSERT OR IGNORE INTO history (id,kind,created_at,status,passed,failed) VALUES (?,?,?,?,?,?)');
            for (const x of entries) {
                const id = createHash('sha256').update(JSON.stringify(x)).digest('hex');
                const res = add.run(id, x.kind, x.createdAt, x.status, x.passed, x.failed);
                imported += Number(res.changes);
            }
            db.prepare('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC,id LIMIT ?)').run(retain);
            db.exec('COMMIT');
        }
        catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
        const row = db.prepare('SELECT count(*) AS total FROM history').get();
        return { imported, total: Number(row.total), schemaVersion: 1 };
    }
    finally {
        db.close();
    }
}
export async function queryHistorySqlite(dbPath, limit = 5000) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000)
        throw new Error('Invalid result limit.');
    const db = await openHistoryDb(dbPath);
    try {
        const rows = db.prepare('SELECT kind,created_at,status,passed,failed FROM history ORDER BY created_at DESC,id LIMIT ?').all(limit);
        const history = rows.map(raw => {
            const x = raw;
            return { kind: String(x.kind), createdAt: String(x.created_at), status: String(x.status),
                ...(x.passed === null ? {} : { passed: Number(x.passed) === 1 }), failed: Number(x.failed) };
        });
        return { schemaVersion: 1, history };
    }
    finally {
        db.close();
    }
}
export async function queryHistoryTrends(dbPath) {
    const db = await openHistoryDb(dbPath);
    try {
        return db.prepare(`SELECT substr(created_at,1,10) AS day,count(*) AS total,
      sum(CASE WHEN passed=0 OR failed>0 THEN 1 ELSE 0 END) AS failed FROM history GROUP BY day ORDER BY day`).all().map(raw => {
            const x = raw;
            return { day: String(x.day), total: Number(x.total), failed: Number(x.failed) };
        });
    }
    finally {
        db.close();
    }
}
export async function renderStoredHistory(dbPath) {
    return renderHistoryDashboard(await queryHistorySqlite(dbPath));
}
//# sourceMappingURL=history-sqlite.js.map