import { spawnCapture } from './process.js';
import type { KnownAgent } from './agent-adapters.js';
export interface AgentTestResult {
    schemaVersion: 1;
    agent: KnownAgent;
    passed: boolean;
    exitCode: number;
    timedOut: boolean;
    durationMs: number;
    outputTruncated: boolean;
    telemetry: 'recognized' | 'unavailable';
    reportedCostUsd?: number;
    totalTokens?: number;
}
export interface AgentTestOptions {
    agent: KnownAgent;
    prompt: string;
    cwd: string;
    trusted: true;
    executableOverride?: string;
    timeoutMs?: number;
    execute?: typeof spawnCapture;
    env?: NodeJS.ProcessEnv;
}
/** Explicit per-provider read-only, one-shot arguments. Never enable YOLO/auto-edit. */
export declare function agentReadOnlyArgs(agent: KnownAgent, prompt: string): string[];
/** Executes a reviewed, read-only one-shot agent and drops raw prompts/output. */
export declare function runAgentTest(opts: AgentTestOptions): Promise<AgentTestResult>;
//# sourceMappingURL=agent-runner.d.ts.map