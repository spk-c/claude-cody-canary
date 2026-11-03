import type { HistoryDashboardInput, HistoryDashboardRecord } from './history-dashboard.js';
import { type ConfidenceInterval } from './statistical-regressions.js';
export type HistoryDimension = 'version' | 'platform' | 'plugin';
export interface HistoryMatrixRow {
    version: string;
    platform: string;
    plugin: string;
    total: number;
    passed: number;
    failed: number;
    unknown: number;
    passRate?: ConfidenceInterval;
}
export interface HistoryMatrix {
    schemaVersion: 1;
    dimensions: readonly ['version', 'platform', 'plugin'];
    totalGroups: number;
    truncated: boolean;
    groups: HistoryMatrixRow[];
}
/** Only accept public-looking identifiers. Never store arbitrary descriptions, paths or environment values. */
export declare function safeHistoryDimension(key: HistoryDimension, value: unknown): string | undefined;
export declare function historyDimensions(record: HistoryDashboardRecord): {
    version?: string;
    platform?: string;
    plugin?: string;
};
/** Descriptive groups only: different scenarios/cohorts may be confounded, not causal comparisons. */
export declare function summarizeHistoryMatrix(input: HistoryDashboardInput, limit?: number): HistoryMatrix;
//# sourceMappingURL=history-dimensions.d.ts.map