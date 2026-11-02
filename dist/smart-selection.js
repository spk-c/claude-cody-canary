import { minimatch } from 'minimatch';
/** Prioritization only. Unmapped and always-run tests are never silently skipped. */
export function prioritizeScenarios(scenarios, changedFiles) {
    if (scenarios.length > 50000 || changedFiles.length > 50000)
        throw new Error('Selection input too large.');
    const changed = changedFiles.map(x => x.replace(/\\/g, '/'));
    return scenarios.map(s => {
        if (!s.name.trim())
            throw new Error('Scenario needs a name.');
        if (!Number.isSafeInteger(s.failureCount ?? 0) || (s.failureCount ?? 0) < 0)
            throw new Error('Invalid failure count.');
        const reasons = [];
        const always = s.alwaysRun === true;
        const unspecified = s.affects.length === 0;
        const matched = s.affects.some(pattern => changed.some(file => minimatch(file, pattern, { dot: true, nocase: false })));
        if (always)
            reasons.push('always-run');
        if (unspecified)
            reasons.push('unmapped-safety');
        if (matched)
            reasons.push('affected-file');
        const selected = always || unspecified || matched;
        const score = (always ? 1000 : 0) + (matched ? 500 : 0) + (unspecified ? 200 : 0) + Math.min(100, s.failureCount ?? 0) * 3 +
            Math.max(0, 100 - Math.ceil((s.lastDurationMs ?? 100000) / 1000));
        return { scenario: s.name, selected, score, reasons };
    }).sort((a, b) => Number(b.selected) - Number(a.selected) || b.score - a.score || a.scenario.localeCompare(b.scenario));
}
//# sourceMappingURL=smart-selection.js.map