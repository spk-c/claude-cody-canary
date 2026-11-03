import { wilsonPassRate } from './statistical-regressions.js';
/** Only accept public-looking identifiers. Never store arbitrary descriptions, paths or environment values. */
export function safeHistoryDimension(key, value) {
    if (typeof value !== 'string')
        return undefined;
    if (key === 'platform')
        return ['linux', 'darwin', 'win32'].includes(value) ? value : undefined;
    if (key === 'version') {
        return /^v?[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}(?:-[a-zA-Z0-9.-]{1,24})?$/.test(value)
            && value.length <= 50 ? value : undefined;
    }
    return value.length <= 80 && /^(?:@?[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}\/)?[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)
        ? value : undefined;
}
export function historyDimensions(record) {
    const version = safeHistoryDimension('version', record.version);
    const platform = safeHistoryDimension('platform', record.platform);
    const plugin = safeHistoryDimension('plugin', record.plugin);
    return { ...(version ? { version } : {}), ...(platform ? { platform } : {}), ...(plugin ? { plugin } : {}) };
}
/** Descriptive groups only: different scenarios/cohorts may be confounded, not causal comparisons. */
export function summarizeHistoryMatrix(input, limit = 50) {
    if (input.schemaVersion !== 1 || !Array.isArray(input.history) || input.history.length > 5000)
        throw new Error('Invalid history matrix input.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000)
        throw new Error('Invalid history matrix group limit.');
    const groups = new Map();
    for (const record of input.history) {
        const dims = historyDimensions(record);
        const version = dims.version ?? 'unknown';
        const platform = dims.platform ?? 'unknown';
        const plugin = dims.plugin ?? 'unknown';
        const key = JSON.stringify([version, platform, plugin]);
        let group = groups.get(key);
        if (!group) {
            group = { version, platform, plugin, total: 0, passed: 0, failed: 0, unknown: 0 };
            groups.set(key, group);
        }
        group.total++;
        if (record.passed === false || typeof record.failed === 'number' && record.failed > 0)
            group.failed++;
        else if (record.passed === true)
            group.passed++;
        else
            group.unknown++;
    }
    const sorted = [...groups.values()].sort((a, b) => b.total - a.total ||
        a.version.localeCompare(b.version) || a.platform.localeCompare(b.platform) || a.plugin.localeCompare(b.plugin));
    for (const row of sorted) {
        const known = row.passed + row.failed;
        if (known >= 10)
            row.passRate = wilsonPassRate(row.passed, known);
    }
    return { schemaVersion: 1, dimensions: ['version', 'platform', 'plugin'],
        totalGroups: sorted.length, truncated: sorted.length > limit, groups: sorted.slice(0, limit) };
}
//# sourceMappingURL=history-dimensions.js.map