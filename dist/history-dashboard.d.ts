export interface HistoryDashboardRecord {
    kind: string;
    createdAt: string;
    passed?: boolean;
    failed?: number;
    status?: string;
}
export interface HistoryDashboardInput {
    schemaVersion: 1;
    history: HistoryDashboardRecord[];
}
/** Offline, dependency-free interactive dashboard. No browser network requests. */
export declare function renderHistoryDashboard(data: HistoryDashboardInput): string;
export declare function buildHistoryDashboard(indexFile: string, outputFile: string): Promise<void>;
//# sourceMappingURL=history-dashboard.d.ts.map