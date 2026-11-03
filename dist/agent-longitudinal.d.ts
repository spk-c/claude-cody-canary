import { z } from 'zod';
export declare const AgentLongitudinalSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    agent: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
        qwen: "qwen";
    }>;
    version: z.ZodString;
    experiment: z.ZodObject<{
        suiteHash: z.ZodString;
        configurationHash: z.ZodString;
        hardwareHash: z.ZodString;
        platform: z.ZodEnum<{
            darwin: "darwin";
            linux: "linux";
            win32: "win32";
        }>;
    }, z.core.$strict>;
    runs: z.ZodArray<z.ZodObject<{
        scenarioHash: z.ZodString;
        replicate: z.ZodNumber;
        outcome: z.ZodEnum<{
            passed: "passed";
            failed: "failed";
            infrastructure: "infrastructure";
        }>;
        durationMs: z.ZodNumber;
        recordedAt: z.ZodString;
        totalTokens: z.ZodOptional<z.ZodNumber>;
        reportedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type AgentLongitudinalCohort = z.infer<typeof AgentLongitudinalSchema>;
export type LongitudinalVerdict = 'improvement' | 'regression' | 'inconclusive' | 'insufficient-data' | 'not-comparable';
export interface LongitudinalAnalysis {
    schemaVersion: 1;
    comparability: 'matched' | 'not-comparable';
    reason: 'matched-experiment' | 'experiment-identity-mismatch' | 'different-sample-pairs' | 'infrastructure-incomplete';
    baseline: {
        agent: string;
        version: string;
        runs: number;
        infrastructure: number;
    };
    candidate: {
        agent: string;
        version: string;
        runs: number;
        infrastructure: number;
    };
    matching: {
        uniqueScenarios: number;
        pairedRuns: number;
        positive: number;
        negative: number;
        tied: number;
    };
    verdict: LongitudinalVerdict;
    /** Two-sided exact sign test using independent scenario-level mean pass rates, not pseudo-independent repetitions. */
    pValue?: number;
    familyWiseAlpha: number;
    familySize: number;
    deltaPassRate?: number;
    scenarioWeightedDurationDeltaMs?: number;
    usageComparison: 'same-provider-reported' | 'different-provider' | 'incomplete';
    baselineMeanTokens?: number;
    candidateMeanTokens?: number;
    baselineMeanCostUsd?: number;
    candidateMeanCostUsd?: number;
    dateRange?: {
        earliest: string;
        latest: string;
    };
    temporalCoverage?: 'single-day' | 'multi-day';
}
/**
 * Conservative observational summary of matched repeated runs.
 *
 * Repetitions are correlated within a scenario. The exact sign test uses each
 * unique scenario ONE time (mean pass fraction), preventing pseudoreplication.
 * Differences in hardware, test config, sample pairs or infrastructure runs
 * block claims. No prompts, outputs, host identifiers or credentials accepted.
 */
export declare function analyzeAgentLongitudinal(baselineInput: unknown, candidateInput: unknown, options?: {
    familySize?: number;
    familyWiseAlpha?: number;
    minimumScenarios?: number;
}): LongitudinalAnalysis;
//# sourceMappingURL=agent-longitudinal.d.ts.map