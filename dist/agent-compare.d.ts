import { z } from 'zod';
import { type StatisticalDecision } from './statistical-regressions.js';
declare const cohortSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    agent: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
        qwen: "qwen";
    }>;
    version: z.ZodString;
    runs: z.ZodArray<z.ZodObject<{
        scenarioHash: z.ZodString;
        passed: z.ZodBoolean;
        durationMs: z.ZodNumber;
        totalTokens: z.ZodOptional<z.ZodNumber>;
        reportedCostUsd: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type AgentCohort = z.infer<typeof cohortSchema>;
export interface AgentComparison {
    schemaVersion: 1;
    comparability: 'comparable' | 'not-comparable';
    reason: 'same-scenarios' | 'different-scenarios';
    baseline: {
        agent: AgentCohort['agent'];
        version: string;
        runs: number;
        passed: number;
        meanDurationMs: number;
    };
    candidate: {
        agent: AgentCohort['agent'];
        version: string;
        runs: number;
        passed: number;
        meanDurationMs: number;
    };
    statisticalDecision?: StatisticalDecision;
    passRateDelta?: number;
    tokenComparison: 'available' | 'unavailable' | 'different-provider';
    baselineMeanTokens?: number;
    candidateMeanTokens?: number;
    costComparison: 'available' | 'unavailable' | 'different-provider';
    baselineMeanCostUsd?: number;
    candidateMeanCostUsd?: number;
}
/**
 * Compare ONLY the same test population; cross-provider token/cost accounting
 * is explicitly unavailable, even when both providers report metrics.
 * Raw prompts/outputs and environment values are not accepted by the schema.
 */
export declare function compareAgentCohorts(baselineInput: unknown, candidateInput: unknown): AgentComparison;
export {};
//# sourceMappingURL=agent-compare.d.ts.map