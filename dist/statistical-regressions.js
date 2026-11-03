/** Wilson score interval, robust for small samples and boundary proportions. */
export function wilsonPassRate(successes, trials, z = 1.96) {
    if (!Number.isSafeInteger(trials) || trials < 1 || !Number.isSafeInteger(successes) || successes < 0 || successes > trials || !Number.isFinite(z) || z <= 0 || z > 10)
        throw new Error('Invalid binomial sample.');
    const p = successes / trials, z2 = z * z, d = 1 + z2 / trials;
    const center = (p + z2 / (2 * trials)) / d;
    const radius = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials) / d;
    return { low: Math.max(0, center - radius), high: Math.min(1, center + radius), proportion: p, trials, successes };
}
export function comparePassRates(baselinePasses, baselineRuns, candidatePasses, candidateRuns, minimumSampleSize = 10) {
    const baseline = wilsonPassRate(baselinePasses, baselineRuns), candidate = wilsonPassRate(candidatePasses, candidateRuns);
    if (!Number.isSafeInteger(minimumSampleSize) || minimumSampleSize < 2 || minimumSampleSize > 100000)
        throw new Error('Invalid minimum sample size.');
    const verdict = baselineRuns < minimumSampleSize || candidateRuns < minimumSampleSize ? 'insufficient-data' :
        candidate.high < baseline.low ? 'regression' : candidate.low > baseline.high ? 'improvement' : 'inconclusive';
    return { verdict, baseline, candidate, minimumSampleSize };
}
/** Conservative family-wise correction using a Gaussian Chernoff bound.
 * Avoids labeling noisy multiple comparisons as regressions.
 */
export function comparePassRateFamily(cases, alpha = 0.05, minimumSampleSize = 10) {
    if (!Array.isArray(cases) || cases.length < 1 || cases.length > 100 ||
        !Number.isFinite(alpha) || alpha < 0.001 || alpha > 0.2 ||
        !Number.isSafeInteger(minimumSampleSize) || minimumSampleSize < 2 || minimumSampleSize > 100000)
        throw new Error('Invalid statistical family budget.');
    const seen = new Set();
    for (const item of cases) {
        if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,64}$/.test(item.id) || seen.has(item.id))
            throw new Error('Invalid or duplicate comparison identifier.');
        seen.add(item.id);
    }
    // A single family has 2*k two-sided intervals.
    // Gaussian tail <= exp(-z*z/2), so this bound is deliberately conservative.
    const z = Math.sqrt(2 * Math.log(4 * cases.length / alpha));
    const comparisons = cases.map(item => {
        const baseline = wilsonPassRate(item.baselinePasses, item.baselineRuns, z);
        const candidate = wilsonPassRate(item.candidatePasses, item.candidateRuns, z);
        const verdict = item.baselineRuns < minimumSampleSize || item.candidateRuns < minimumSampleSize ? 'insufficient-data' :
            candidate.high < baseline.low ? 'regression' : candidate.low > baseline.high ? 'improvement' : 'inconclusive';
        return { id: item.id, decision: { verdict, baseline, candidate, minimumSampleSize } };
    });
    return { schemaVersion: 1, familyWiseAlpha: alpha, criticalZ: z, comparisons };
}
//# sourceMappingURL=statistical-regressions.js.map