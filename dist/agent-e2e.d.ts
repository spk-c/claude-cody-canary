import { z } from 'zod';
import { spawnCapture } from './process.js';
import { type AgentLongitudinalCohort } from './agent-longitudinal.js';
import type { ProcessResult } from './types.js';
export declare const AgentE2eManifestSchema: z.ZodObject<{
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
    limits: z.ZodObject<{
        maxRuns: z.ZodNumber;
        maxDurationMs: z.ZodNumber;
        perRunTimeoutMs: z.ZodNumber;
        maxReportedCostUsd: z.ZodNumber;
        reserveUsdPerRun: z.ZodNumber;
    }, z.core.$strict>;
    cases: z.ZodArray<z.ZodObject<{
        scenarioHash: z.ZodString;
        replicate: z.ZodNumber;
        prompt: z.ZodString;
        expectedAnswerSha256: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type AgentE2eManifest = z.infer<typeof AgentE2eManifestSchema>;
export type AgentE2eOutcome = 'passed' | 'failed' | 'infrastructure';
export interface AgentE2eCaseReport {
    scenarioHash: string;
    replicate: number;
    outcome: AgentE2eOutcome;
    reason: 'answer-matched' | 'answer-mismatched' | 'unverifiable-response' | 'process-error';
    durationMs: number;
    recordedAt: string;
    totalTokens?: number;
    reportedCostUsd?: number;
}
export interface AgentE2eReport {
    schemaVersion: 1;
    mode: 'preview' | 'executed';
    agent: AgentE2eManifest['agent'];
    version: string;
    planned: number;
    attempted: number;
    completed: number;
    verifiedPassed: number;
    verifiedFailed: number;
    infrastructure: number;
    elapsedMs: number;
    reportedCostUsd: number;
    costTracking: 'not-run' | 'reported' | 'unavailable' | 'exceeded';
    stoppedReason: 'preview' | 'completed' | 'reported-cost-limit' | 'cost-unavailable' | 'duration-limit' | 'process-error';
    /** Never claim a hard dollar cap: one provider call may cost more than the ledger reserve. */
    budgetGuarantee: 'not-a-provider-spend-cap';
    cases: AgentE2eCaseReport[];
    cohort?: AgentLongitudinalCohort;
}
export interface AgentE2eOptions {
    cwd: string;
    trusted?: true;
    allowProviderCosts?: true;
    executableOverride?: string;
    execute?: typeof spawnCapture;
    env?: NodeJS.ProcessEnv;
    now?: () => number;
}
export declare function hashE2eAnswer(answer: string): string;
/** Parse only a final documented response field, never incidental log text. */
export declare function parseE2eResponse(agent: AgentE2eManifest['agent'], process: ProcessResult): {
    answer?: string;
    tokens?: number;
    cost?: number;
};
/**
 * Preview is strictly offline. Execution requires both explicit approvals and
 * only runs bounded provider CLIs in their read-only modes, without shell.
 *
 * Reported-cost stopping is retrospective. No hard cost cap can be guaranteed
 * until the provider supports a trusted pre-authorization/spend-limit API.
 */
export declare function runAgentE2e(input: unknown, opts: AgentE2eOptions): Promise<AgentE2eReport>;
//# sourceMappingURL=agent-e2e.d.ts.map