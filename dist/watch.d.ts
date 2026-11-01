import { z } from 'zod';
import { type SuiteRunResult } from './suite.js';
declare const WatchStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    lastObserved: z.ZodString;
    lastKnownGood: z.ZodString;
    updatedAt: z.ZodString;
    lastResult: z.ZodOptional<z.ZodEnum<{
        initialized: "initialized";
        compatible: "compatible";
        regression: "regression";
    }>>;
    pendingVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type WatchState = z.infer<typeof WatchStateSchema>;
export type WatchStatus = 'initialized' | 'no-change' | 'new-release' | 'compatible' | 'regression' | 'infrastructure-error';
export interface WatchOptions {
    cwd?: string;
    suitePath: string;
    statePath?: string;
    good?: string;
    platform?: string;
    checkOnly?: boolean;
    tag?: string;
    shard?: string;
    concurrency?: number;
    onStatus?: (message: string) => void;
    writeArtifacts?: boolean;
}
export interface WatchResult {
    schemaVersion: 1;
    status: WatchStatus;
    createdAt: string;
    previousObserved?: string;
    previousKnownGood?: string;
    latest: string;
    unseen: string[];
    candidate?: string;
    firstBadRelease?: string;
    firstFailingScenario?: string;
    infrastructureError?: string;
    suite?: SuiteRunResult;
    statePath: string;
    jsonArtifactPath?: string;
    markdownArtifactPath?: string;
}
declare function readState(file: string): Promise<WatchState | undefined>;
declare function formatWatchMarkdown(result: WatchResult): string;
/** Infrastructure failures cannot be called model regressions or mark a release good. */
export declare function classifyWatchedSuite(suite: Pick<SuiteRunResult, 'passed' | 'infrastructureFailedCount' | 'total' | 'passedCount'>): 'compatible' | 'regression' | 'infrastructure-error';
export declare function versionsRequiringWatch(published: string[], lastObserved: string, pendingVersion?: string): string[];
export declare function watchClaudeCodeReleases(options: WatchOptions): Promise<WatchResult>;
export { formatWatchMarkdown, readState as readWatchState };
//# sourceMappingURL=watch.d.ts.map