import { type HistoryDashboardInput } from './history-dashboard.js';
import { type HistoryMatrix } from './history-dimensions.js';
export interface HistoryStoreResult {
    imported: number;
    total: number;
    schemaVersion: 1;
    databaseVersion: 2;
}
export interface HistoryTrend {
    day: string;
    total: number;
    failed: number;
}
/** Import only validated privacy-preserving history-index records, never source artifacts. */
export declare function importHistorySqlite(indexFile: string, dbPath: string, retain?: number): Promise<HistoryStoreResult>;
export declare function queryHistorySqlite(dbPath: string, limit?: number): Promise<HistoryDashboardInput>;
export declare function queryHistoryTrends(dbPath: string): Promise<HistoryTrend[]>;
/** Entire retained store is grouped in SQLite, not restricted to the newest 5000 dashboard rows. */
export declare function queryHistoryMatrixSqlite(dbPath: string, limit?: number): Promise<HistoryMatrix>;
export declare function renderStoredHistory(dbPath: string): Promise<string>;
//# sourceMappingURL=history-sqlite.d.ts.map