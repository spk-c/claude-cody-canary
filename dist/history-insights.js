import { wilsonPassRate } from './statistical-regressions.js';
/** Stable offline aggregation; never stores raw artifacts, prompts or URLs. */
export function summarizeHistory(value) {
    if (value.schemaVersion !== 1 || !Array.isArray(value.history) || value.history.length > 5000)
        throw new Error('Invalid history summary input.');
    const byDay = new Map(), clusters = new Map();
    let passed = 0, failed = 0, unknown = 0;
    for (const entry of value.history) {
        const kind = String(entry.kind ?? 'unknown').slice(0, 64);
        const date = String(entry.createdAt ?? '');
        const parsed = Date.parse(date), day = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : 'undated';
        const status = entry.passed === false || Number(entry.failed ?? 0) > 0 ? 'failed' :
            entry.passed === true ? 'passed' : 'unknown';
        if (status === 'failed')
            failed++;
        else if (status === 'passed')
            passed++;
        else
            unknown++;
        const row = byDay.get(day) ?? { day, total: 0, passed: 0, failed: 0, unknown: 0 };
        row.total++;
        row[status]++;
        byDay.set(day, row);
        if (status === 'failed') {
            const key = JSON.stringify([kind, status]), cluster = clusters.get(key) ?? { kind, status, count: 0 };
            cluster.count++;
            clusters.set(key, cluster);
        }
    }
    const trials = passed + failed;
    return { schemaVersion: 1, total: value.history.length, passed, failed, unknown,
        ...(trials ? { passRate: wilsonPassRate(passed, trials) } : {}),
        days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-90),
        failureClusters: [...clusters.values()].sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)).slice(0, 20) };
}
//# sourceMappingURL=history-insights.js.map