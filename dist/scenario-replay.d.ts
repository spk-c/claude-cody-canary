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
export declare function replayMinimizeScenario(input: ReplayScenario, options: ReplayOptions): Promise<MinimizationResult<string>>;
//# sourceMappingURL=scenario-replay.d.ts.map