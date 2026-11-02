import { z } from 'zod';
import { clusterRunFailures, type FailureFingerprint } from './fingerprint.js';
import type { RunResult } from './types.js';
declare const SuiteEntrySchema: z.ZodObject<{
    path: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    affects: z.ZodDefault<z.ZodArray<z.ZodString>>;
    always: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const SuiteSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    name: z.ZodString;
    include: z.ZodDefault<z.ZodArray<z.ZodString>>;
    exclude: z.ZodDefault<z.ZodArray<z.ZodString>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    scenarios: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        affects: z.ZodDefault<z.ZodArray<z.ZodString>>;
        always: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>>>;
    concurrency: z.ZodDefault<z.ZodNumber>;
    fail_fast: z.ZodDefault<z.ZodBoolean>;
    max_runs: z.ZodDefault<z.ZodNumber>;
    reuse_results: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export type ScenarioSuite = z.infer<typeof SuiteSchema>;
export type ScenarioSuiteEntry = z.infer<typeof SuiteEntrySchema>;
export interface ResolvedSuiteScenario {
    path: string;
    tags: string[];
    affects: string[];
    always: boolean;
}
export interface SkippedSuiteScenario {
    path: string;
    reason: 'tag' | 'unaffected' | 'shard';
}
export interface SuiteSelection {
    discovered: ResolvedSuiteScenario[];
    selected: ResolvedSuiteScenario[];
    skipped: SkippedSuiteScenario[];
}
export interface SuiteRunOptions {
    cwd?: string;
    tag?: string;
    shard?: string;
    concurrency?: number;
    failFast?: boolean;
    maxRuns?: number;
    changedPaths?: string[];
    executableOverride?: string;
    gitRefOverride?: string;
    writeArtifacts?: boolean;
    artifactLabel?: string;
    reuseResults?: boolean;
    cacheRoot?: string;
    /** Optional local per-scenario failure history. Reorders but never deselects. */
    priorityHistory?: Record<string, {
        failureCount: number;
        lastDurationMs?: number;
    }>;
}
export interface SuiteScenarioResult {
    path: string;
    passed: boolean;
    result?: RunResult;
    fingerprint?: FailureFingerprint;
    infrastructureError?: string;
    cacheHit?: boolean;
    cacheKey?: string;
}
export interface SuiteRunResult {
    schemaVersion: 1;
    suite: string;
    suitePath: string;
    createdAt: string;
    passed: boolean;
    total: number;
    discoveredTotal: number;
    passedCount: number;
    failedCount: number;
    infrastructureFailedCount: number;
    cacheHitCount: number;
    /** SHA-256 of the shared execution configuration for strict shard merging. */
    executionIdentity?: string;
    skippedBySelection: number;
    skipped: SkippedSuiteScenario[];
    shard?: string;
    tag?: string;
    executable?: string;
    scenarios: SuiteScenarioResult[];
    failureClusters: ReturnType<typeof clusterRunFailures>;
    jsonArtifactPath?: string;
    markdownArtifactPath?: string;
}
export declare function parseSuite(value: unknown): ScenarioSuite;
export declare function loadSuite(suitePath: string): Promise<ScenarioSuite>;
declare function parseShard(value?: string): {
    index: number;
    total: number;
} | undefined;
export declare function explainSuiteSelection(suite: ScenarioSuite, options?: Pick<SuiteRunOptions, 'cwd' | 'tag' | 'shard' | 'changedPaths'>): Promise<SuiteSelection>;
export declare function resolveSuiteScenarios(suite: ScenarioSuite, options?: Pick<SuiteRunOptions, 'cwd' | 'tag' | 'shard' | 'changedPaths'>): Promise<ResolvedSuiteScenario[]>;
declare function formatSuiteMarkdown(result: SuiteRunResult): string;
/**
 * Shared shard identity binds the exact repo commit, full discovered suite
 * definition, selection filters, runtime and hashed provider environment.
 * It excludes shard N/M by design, enabling valid distributed aggregation.
 */
export declare function suiteExecutionIdentity(absoluteSuitePath: string, selection: SuiteSelection, options: SuiteRunOptions, cwd: string): Promise<string>;
export declare function runSuite(suitePath: string, options?: SuiteRunOptions): Promise<SuiteRunResult>;
export declare function combineSuiteResults(results: SuiteRunResult[]): SuiteRunResult;
/** Deterministically prioritize selected cases; never drop an already selected test. */
export declare function sortSuiteByPriority(selected: ResolvedSuiteScenario[], history: Record<string, {
    failureCount: number;
    lastDurationMs?: number;
}>, changedPaths: string[]): ResolvedSuiteScenario[];
export { formatSuiteMarkdown, parseShard };
//# sourceMappingURL=suite.d.ts.map