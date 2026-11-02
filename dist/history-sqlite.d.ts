import { type HistoryDashboardInput } from './history-dashboard.js';
export interface HistoryStoreResult {
    imported: number;
    total: number;
    schemaVersion: 1;
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
export declare function renderStoredHistory(dbPath: string): Promise<string>;
//# sourceMappingURL=history-sqlite.d.ts.map