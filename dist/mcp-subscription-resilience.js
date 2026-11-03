import { probeMcpSubscriptions } from './mcp-subscriptions.js';
/** Explicit, bounded reconnection probe. Never contacts non-numeric-loopback addresses. */
export async function probeMcpSubscriptionCycles(endpoint, options) {
    if (options?.trusted !== true)
        throw new Error('Explicit trusted MCP cycles acknowledgement required.');
    const cycles = options.cycles ?? 3, timeout = options.timeoutMs ?? 1500, total = options.totalBudgetMs ?? 7000;
    if (!Number.isSafeInteger(cycles) || cycles < 2 || cycles > 4 ||
        !Number.isSafeInteger(timeout) || timeout < 100 || timeout > 2500 ||
        !Number.isSafeInteger(total) || total < 300 || total > 12000)
        throw new Error('Invalid bounded subscription cycles budget.');
    const start = Date.now();
    const result = {
        schemaVersion: 1, mode: 'explicit-local-cycles', valid: false, plannedCycles: cycles,
        completedCycles: 0, acknowledgedCycles: 0, notificationsReceived: 0,
        reason: 'ok', findings: [],
    };
    for (let i = 0; i < cycles; i++) {
        const remaining = total - (Date.now() - start);
        if (remaining < 100) {
            result.reason = 'total-time-budget';
            break;
        }
        // The subscription probe validates URL, no redirect and event correlation.
        const report = await probeMcpSubscriptions(endpoint, {
            trusted: true, maxNotifications: 1, subscriptionId: 100 + i,
            timeoutMs: Math.min(timeout, remaining), fetchImpl: options.fetchImpl,
        });
        result.completedCycles++;
        if (report.acknowledged)
            result.acknowledgedCycles++;
        result.notificationsReceived += report.notificationsReceived;
        result.findings.push({ cycle: i + 1, acknowledged: report.acknowledged,
            notifications: report.notificationsReceived, reason: report.reason });
        if (!report.valid) {
            result.reason = 'cycle-failed';
            break;
        }
    }
    result.valid = result.completedCycles === cycles && result.reason === 'ok';
    return result;
}
//# sourceMappingURL=mcp-subscription-resilience.js.map