import type { Scenario } from './config.js';
import type { RunResult } from './types.js';
export interface PreparedRun {
    extraClaudeArgs?: string[];
    env?: NodeJS.ProcessEnv;
    fixtureState?: Record<string, string | null>;
    cleanup?: () => Promise<void>;
}
export interface RunOptions {
    cwd?: string;
    executableOverride?: string;
    artifactLabel?: string;
    prepareWorktree?: (worktreePath: string) => Promise<PreparedRun>;
    gitRefOverride?: string;
    allowDirtyWorkingTree?: boolean;
}
export declare function buildClaudeArgs(scenario: Scenario, extraClaudeArgs?: string[]): string[];
export declare function filterFixtureChanges(worktreePath: string, changedFiles: string[], fixtureState?: Record<string, string | null>): Promise<string[]>;
export declare function runScenario(scenario: Scenario, options?: RunOptions): Promise<RunResult>;
//# sourceMappingURL=runner.d.ts.map