import type { HistoryDashboardInput } from './history-dashboard.js';
import { type ConfidenceInterval } from './statistical-regressions.js';
export interface HistoryDay {
    day: string;
    total: number;
    passed: number;
    failed: number;
    unknown: number;
}
export interface HistoryCluster {
    kind: string;
    status: string;
    count: number;
}
export interface HistoryInsights {
    schemaVersion: 1;
    total: number;
    passed: number;
    failed: number;
    unknown: number;
    passRate?: ConfidenceInterval;
    days: HistoryDay[];
    failureClusters: HistoryCluster[];
}
/** Stable offline aggregation; never stores raw artifacts, prompts or URLs. */
export declare function summarizeHistory(value: HistoryDashboardInput): HistoryInsights;
//# sourceMappingURL=history-insights.d.ts.map