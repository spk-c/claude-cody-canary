import type { Scenario } from './config.js';
import { type RunOptions } from './runner.js';
import type { RunResult } from './types.js';
export interface ResultCacheIdentity {
    schemaVersion: 2;
    runtimeConfigHash: string;
    scenarioHash: string;
    gitCommit: string;
    executableSha256: string;
    canaryVersion: string;
    platform: string;
    arch: string;
    nodeMajor: string;
    featureFlagsHash: string;
}
export interface CachedRunEnvelope {
    schemaVersion: 2;
    key: string;
    identity: ResultCacheIdentity;
    createdAt: string;
    result: RunResult;
}
export declare function buildResultCacheIdentity(options: {
    cwd: string;
    scenarioSource: string;
    executable: string;
    gitRef?: string;
    featureFlags?: unknown;
}): Promise<ResultCacheIdentity>;
export declare function resultCacheKey(identity: ResultCacheIdentity): string;
export declare function readCachedRun(cacheRoot: string, identity: ResultCacheIdentity): Promise<RunResult | undefined>;
export declare function writeCachedRun(cacheRoot: string, identity: ResultCacheIdentity, result: RunResult): Promise<string>;
export declare function runScenarioWithCache(scenario: Scenario, scenarioPath: string, options?: RunOptions & {
    cacheRoot?: string;
    featureFlags?: unknown;
}): Promise<{
    result: RunResult;
    cacheHit: boolean;
    cacheKey: string;
}>;
//# sourceMappingURL=result-cache.d.ts.map