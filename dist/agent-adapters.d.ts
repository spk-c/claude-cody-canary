export type KnownAgent = 'claude' | 'codex' | 'qwen';
export interface AgentAdapterStatus {
    agent: KnownAgent;
    executable: string;
    available: boolean;
}
export declare const KNOWN_AGENT_ADAPTERS: readonly ({
    agent: "claude";
    executable: string;
} | {
    agent: "codex";
    executable: string;
} | {
    agent: "qwen";
    executable: string;
})[];
/** Discovery-only adapter catalog. This does not execute an agent or assume CLI flag compatibility. */
export declare function discoverAgentAdapters(cwd: string, env?: NodeJS.ProcessEnv): Promise<AgentAdapterStatus[]>;
//# sourceMappingURL=agent-adapters.d.ts.map