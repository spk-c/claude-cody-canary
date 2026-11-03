import { type MinimizationResult } from './minimize.js';
export interface ReplayStep {
    id: string;
    command: string;
    dependsOn?: string[];
}
export interface ReplayScenario {
    version: 1;
    steps: ReplayStep[];
    verifyCommand: string;
    expectedExitCode: number;
    failureMarker?: string;
    /** Optional immutable commit pin, validated before any reviewed shell command executes. */
    expectedHeadSha?: string;
}
export interface ReplayProvenanceResult extends MinimizationResult<string> {
    schemaVersion: 1;
    headSha: string;
    scenarioFingerprint: string;
    originalFailureVerified: true;
}
export interface ReplayOptions {
    trusted: true;
    cwd: string;
    maxChecks?: number;
    totalBudgetMs?: number;
}
export declare function validateReplayScenario(input: ReplayScenario): ReplayScenario;
export declare function minimizeDependentSteps(scenario: ReplayScenario, reproduces: (steps: readonly ReplayStep[]) => Promise<boolean>, maxChecks?: number): Promise<MinimizationResult<ReplayStep>>;
/** Trusted shell commands run in a fresh detached Git worktree per attempt.
 * Git worktrees are NOT an OS sandbox; only use reviewed, harmless fixture commands.
 */
export declare function replayMinimizeScenario(input: ReplayScenario, options: ReplayOptions): Promise<ReplayProvenanceResult>;
//# sourceMappingURL=scenario-replay.d.ts.map