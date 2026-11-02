export interface ConfidenceInterval {
    low: number;
    high: number;
    proportion: number;
    trials: number;
    successes: number;
}
export interface StatisticalDecision {
    verdict: 'regression' | 'improvement' | 'inconclusive' | 'insufficient-data';
    baseline: ConfidenceInterval;
    candidate: ConfidenceInterval;
    minimumSampleSize: number;
}
/** Wilson score interval, robust for small samples and boundary proportions. */
export declare function wilsonPassRate(successes: number, trials: number, z?: number): ConfidenceInterval;
export declare function comparePassRates(baselinePasses: number, baselineRuns: number, candidatePasses: number, candidateRuns: number, minimumSampleSize?: number): StatisticalDecision;
//# sourceMappingURL=statistical-regressions.d.ts.map