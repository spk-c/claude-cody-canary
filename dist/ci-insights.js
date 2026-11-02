import { createHash } from 'node:crypto';
const rules = [
    { kind: 'runner-infrastructure', signals: [
            [/job.*(?:cancelled|canceled).*?(?:runner|assign)|runner.*(?:not assigned|not available)|waiting for a runner/i, 'runner-unavailable'],
            [/runner.*(?:lost communication|offline)|failed to acquire.*runner/i, 'runner-disconnected'],
        ], action: 'Review runner availability and labels; rerun only the cancelled job without changing test assertions.', retry: true },
    { kind: 'lock-contention', signals: [
            [/(?:EPERM|EACCES|EBUSY).*?(?:lock|\.lock)|(?:lock|\.lock).*?(?:EPERM|EACCES|EBUSY)/i, 'lock-access-contention'],
        ], action: 'Inspect exclusive file access on Windows; reproduce with concurrent contenders and preserve original failure.', retry: true },
    { kind: 'timeout', signals: [
            [/test timed out|timed out in \d+ms|timeout of \d+ms exceeded/i, 'test-timeout'],
            [/ETIMEDOUT|ESOCKETTIMEDOUT/i, 'network-timeout'],
        ], action: 'Examine deadline, load, and actual process progress; retry once for diagnosis, not to mask a failure.', retry: true },
    { kind: 'dependency', signals: [
            [/npm ERR!.*(?:ERESOLVE|EINTEGRITY|ENOTFOUND)|npm error.*(?:ERESOLVE|EINTEGRITY|ENOTFOUND)/i, 'npm-dependency'],
            [/Cannot find module|ERR_MODULE_NOT_FOUND/i, 'missing-module'],
        ], action: 'Check locked dependency versions, registry status, and package reproducibility.', retry: false },
    { kind: 'assertion', signals: [
            [/AssertionError|expected.*(?:to equal|to be|to match)|\bFAIL\s+(?:test\/|tests\/)/i, 'test-assertion'],
        ], action: 'Reproduce on the same commit and runtime; minimize the failing scenario before changing code.', retry: false },
];
/** Logs are treated as untrusted evidence; only predefined signal codes are emitted. */
export function analyzeCiLog(log, exitCode) {
    if (log.length > 4 * 1024 * 1024)
        throw new Error('CI log exceeds 4 MiB analysis limit.');
    const selected = rules.find(rule => rule.signals.some(([pattern]) => pattern.test(log)));
    const kind = selected?.kind ?? (exitCode === 0 || /(?:all checks passed|tests? passed|process completed with exit code 0)/i.test(log) ? 'passed' : 'unknown');
    const signals = selected?.signals.filter(([pattern]) => pattern.test(log)).map(([, name]) => name) ?? [];
    if (kind === 'passed')
        signals.push('clean-exit');
    const fingerprint = createHash('sha256').update(JSON.stringify([kind, signals])).digest('hex').slice(0, 16);
    return {
        schemaVersion: 1,
        kind,
        confidence: signals.length ? (selected ? 'high' : 'medium') : 'low',
        fingerprint,
        signals,
        action: selected?.action ?? (kind === 'passed' ? 'No failure action needed.' : 'Inspect job output and reproduce before assigning a failure category.'),
        retriesRecommended: selected?.retry ?? false,
    };
}
export function groupCiInsights(insights) {
    const groups = new Map();
    for (const insight of insights) {
        const current = groups.get(insight.fingerprint) ?? { fingerprint: insight.fingerprint, kind: insight.kind, occurrences: 0 };
        current.occurrences += 1;
        groups.set(insight.fingerprint, current);
    }
    return [...groups.values()].sort((a, b) => b.occurrences - a.occurrences || a.fingerprint.localeCompare(b.fingerprint));
}
//# sourceMappingURL=ci-insights.js.map