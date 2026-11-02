import { type CiInsight } from './ci-insights.js';
export interface GithubJobDiagnostic {
    id: number;
    name: string;
    attempt: number;
    status: string;
    conclusion: string | null;
    runnerAssigned: boolean;
    started: boolean;
    diagnosis: CiInsight;
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