import { type McpSubscriptionProbe } from './mcp-subscriptions.js';
export interface McpSubscriptionCycleReport {
    schemaVersion: 1;
    mode: 'explicit-local-cycles';
    valid: boolean;
    plannedCycles: number;
    completedCycles: number;
    acknowledgedCycles: number;
    notificationsReceived: number;
    reason: 'ok' | 'cycle-failed' | 'total-time-budget';
    findings: Array<{
        cycle: number;
        acknowledged: boolean;
        notifications: number;
        reason: McpSubscriptionProbe['reason'];
    }>;
}
/** Explicit, bounded reconnection probe. Never contacts non-numeric-loopback addresses. */
export declare function probeMcpSubscriptionCycles(endpoint: string, options: {
    trusted: true;
    cycles?: number;
    timeoutMs?: number;
    totalBudgetMs?: number;
    fetchImpl?: typeof fetch;
}): Promise<McpSubscriptionCycleReport>;
//# sourceMappingURL=mcp-subscription-resilience.d.ts.map