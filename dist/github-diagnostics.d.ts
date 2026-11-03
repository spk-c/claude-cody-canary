import { type CiInsight, type CiFailureKind } from './ci-insights.js';
export interface GithubJobDiagnostic {
    id: number;
    name: string;
    attempt: number;
    status: string;
    conclusion: string | null;
    runnerAssigned: boolean;
    started: boolean;
    diagnosis: CiInsight;
    /** Inferred only from failed step name, not treated as root cause. */
    failedStage: 'setup' | 'dependencies' | 'tests' | 'publishing' | 'authorization' | 'unknown' | null;
}
export interface GithubRunDiagnostic {
    schemaVersion: 1;
    owner: string;
    repository: string;
    runId: number;
    headSha: string;
    attempts: number;
    jobs: GithubJobDiagnostic[];
    summary: {
        successful: number;
        failed: number;
        cancelledBeforeStart: number;
        incomplete: number;
    };
    /** Issue/PR triage suggestions contain only predefined safe categories, never log content. */
    triage: Array<{
        kind: CiFailureKind;
        fingerprint: string;
        occurrences: number;
        action: string;
    }>;
    /** Earlier attempts are always included; green reruns do not erase original failures. */
    retainsOriginalAttempts: true;
}
interface GithubFetchOptions {
    token?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}
/** Read-only GitHub Action history; no log/body is copied into the result. */
export declare function analyzeGithubRun(owner: string, repo: string, runId: number, opts?: GithubFetchOptions): Promise<GithubRunDiagnostic>;
export {};
//# sourceMappingURL=github-diagnostics.d.ts.map