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
/** Short-lived, per-suite content hash memo; file metadata is checked before every reuse. */
export type CacheDigestMemo = Map<string, {
    signature: string;
    digest: string;
}>;
/**
 * Validates a cached file digest against the live inode, size and timestamps.
 * A change while hashing fails closed rather than caching an unstable digest.
 */
export declare function sha256FileMemoized(file: string, memo?: CacheDigestMemo): Promise<string>;
export declare function buildResultCacheIdentity(options: {
    cwd: string;
    scenarioSource: string;
    executable: string;
    gitRef?: string;
    featureFlags?: unknown;
    hashMemo?: CacheDigestMemo;
}): Promise<ResultCacheIdentity>;
export declare function resultCacheKey(identity: ResultCacheIdentity): string;
export declare function readCachedRun(cacheRoot: string, identity: ResultCacheIdentity): Promise<RunResult | undefined>;
export declare function writeCachedRun(cacheRoot: string, identity: ResultCacheIdentity, result: RunResult): Promise<string>;
export declare function runScenarioWithCache(scenario: Scenario, scenarioPath: string, options?: RunOptions & {
    cacheRoot?: string;
    featureFlags?: unknown;
    hashMemo?: CacheDigestMemo;
}): Promise<{
    result: RunResult;
    cacheHit: boolean;
    cacheKey: string;
}>;
//# sourceMappingURL=result-cache.d.ts.map