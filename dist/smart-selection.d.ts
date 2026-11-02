export interface SmartScenario {
    name: string;
    affects: string[];
    alwaysRun?: boolean;
    failureCount?: number;
    lastDurationMs?: number;
}
export interface SmartSelection {
    scenario: string;
    selected: boolean;
    score: number;
    reasons: string[];
}
/** Prioritization only. Unmapped and always-run tests are never silently skipped. */
export declare function prioritizeScenarios(scenarios: readonly SmartScenario[], changedFiles: readonly string[]): SmartSelection[];
//# sourceMappingURL=smart-selection.d.ts.map