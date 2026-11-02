import { z } from 'zod';
export declare const AgentTeamScenarioSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    name: z.ZodString;
    prompt: z.ZodString;
    claude: z.ZodDefault<z.ZodObject<{
        executable: z.ZodDefault<z.ZodString>;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        model: z.ZodOptional<z.ZodString>;
        permission_mode: z.ZodOptional<z.ZodEnum<{
            default: "default";
            dontAsk: "dontAsk";
            plan: "plan";
            acceptEdits: "acceptEdits";
            auto: "auto";
            bypassPermissions: "bypassPermissions";
        }>>;
        timeout_seconds: z.ZodDefault<z.ZodNumber>;
        env: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strict>>;
    expect: z.ZodOptional<z.ZodObject<{
        expected_teammates: z.ZodDefault<z.ZodArray<z.ZodString>>;
        deny_unexpected_teammates: z.ZodDefault<z.ZodBoolean>;
        deny_duplicate_spawns: z.ZodDefault<z.ZodBoolean>;
        min_teammates: z.ZodOptional<z.ZodNumber>;
        max_teammates: z.ZodOptional<z.ZodNumber>;
        min_tasks_created: z.ZodOptional<z.ZodNumber>;
        min_tasks_completed: z.ZodOptional<z.ZodNumber>;
        min_messages_sent: z.ZodOptional<z.ZodNumber>;
        require_all_tasks_completed: z.ZodDefault<z.ZodBoolean>;
        require_all_teammates_idle: z.ZodDefault<z.ZodBoolean>;
        max_stop_failures: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type AgentTeamScenario = z.infer<typeof AgentTeamScenarioSchema>;
export type AgentTeamEventKind = 'teammate_spawned' | 'teammate_idle' | 'task_created' | 'task_completed' | 'message_sent' | 'stop_failure';
export interface AgentTeamEvent {
    kind: AgentTeamEventKind;
    at: string;
    teammate?: string;
    agentType?: string;
    model?: string;
    taskId?: string;
    recipient?: string;
}
export interface AgentTeamMember {
    name: string;
    agentType?: string;
    model?: string;
}
export interface AgentTeamMetrics {
    teammateCount: number;
    teammates: AgentTeamMember[];
    duplicateTeammates: string[];
    idleTeammates: string[];
    orphanedTeammates: string[];
    tasksCreated: number;
    tasksCompleted: number;
    incompleteTaskIds: string[];
    completedWithoutCreateIds: string[];
    messagesSent: number;
    stopFailures: number;
    coordinationDurationMs?: number;
}
export interface AgentTeamRunResult {
    schemaVersion: 1;
    kind: 'agent-team-run';
    canaryVersion: string;
    experimental: true;
    status: 'passed' | 'failed' | 'unsupported';
    scenario: string;
    executable: string;
    claudeVersion?: string;
    gitCommit: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    failures: string[];
    metrics: AgentTeamMetrics;
    events: AgentTeamEvent[];
    createdAt: string;
    artifactPath?: string;
}
export interface AgentTeamComparisonResult {
    schemaVersion: 1;
    kind: 'agent-team-comparison';
    passed: boolean;
    failures: string[];
    baseline: AgentTeamRunResult;
    candidate: AgentTeamRunResult;
    deltas: {
        teammateCount: number;
        tasksCreated: number;
        tasksCompleted: number;
        messagesSent: number;
        stopFailures: number;
        coordinationDurationMs?: number;
    };
}
interface InteractiveProcessResult {
    code: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
}
export interface RunAgentTeamOptions {
    cwd?: string;
    version?: string;
    platform?: string;
    executableOverride?: string;
    gitRefOverride?: string;
    onStatus?: (message: string) => void;
    isTTY?: boolean;
    interactiveRunner?: (executable: string, args: string[], options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        timeoutMs: number;
    }) => Promise<InteractiveProcessResult>;
}
export declare function parseAgentTeamScenario(value: unknown): AgentTeamScenario;
export declare function loadAgentTeamScenario(file: string): Promise<AgentTeamScenario>;
export declare function aggregateAgentTeamEvents(events: AgentTeamEvent[]): AgentTeamMetrics;
export declare function evaluateAgentTeamExpectations(scenario: AgentTeamScenario, metrics: AgentTeamMetrics): string[];
export declare function compareAgentTeamResults(baseline: AgentTeamRunResult, candidate: AgentTeamRunResult): AgentTeamComparisonResult;
export declare function runAgentTeam(scenario: AgentTeamScenario, options?: RunAgentTeamOptions): Promise<AgentTeamRunResult>;
export declare function loadAgentTeamResult(file: string): Promise<AgentTeamRunResult>;
export declare function formatAgentTeamRun(result: AgentTeamRunResult): string;
export declare function formatAgentTeamComparison(result: AgentTeamComparisonResult): string;
export {};
//# sourceMappingURL=agent-team.d.ts.map