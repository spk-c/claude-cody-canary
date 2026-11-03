export type CiFailureKind = 'runner-infrastructure' | 'lock-contention' | 'timeout' | 'assertion' | 'dependency' | 'permission' | 'cancelled-before-execution' | 'unknown' | 'passed';
export interface CiInsight {
    schemaVersion: 1;
    kind: CiFailureKind;
    confidence: 'high' | 'medium' | 'low';
    fingerprint: string;
    signals: string[];
    action: string;
    /** This diagnostic deliberately excludes raw logs, secrets, commands and paths. */
    retriesRecommended: boolean;
}
/** Logs are treated as untrusted evidence; only predefined signal codes are emitted. */
export declare function analyzeCiLog(log: string, exitCode?: number): CiInsight;
export declare function groupCiInsights(insights: CiInsight[]): Array<{
    fingerprint: string;
    kind: CiFailureKind;
    occurrences: number;
}>;
//# sourceMappingURL=ci-insights.d.ts.map