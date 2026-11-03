type ApprovedRound = {
    result: unknown;
    inputResponses: unknown;
    nextId: number;
    approval: {
        approved: true;
    };
};
export interface MrtrRoundSummary {
    round: number;
    requestId: number;
    inputCount: number;
    opaqueRequestState: boolean;
}
export interface MrtrOfflinePlan {
    schemaVersion: 1;
    protocolVersion: '2026-07-28';
    transport: 'offline-only';
    approvedRounds: number;
    roundSummaries: MrtrRoundSummary[];
    final: 'pending' | 'success' | 'jsonrpc-error';
    /** No network requests, tools or model calls are performed. */
    executedRequests: 0;
}
/** Pure, bounded offline MRTR state transition audit. Each new round requires explicit approval. */
export declare function planApprovedMcpMrtrRounds(initialRequest: unknown, rounds: readonly ApprovedRound[], finalResponse?: unknown): MrtrOfflinePlan;
export {};
//# sourceMappingURL=mcp-mrtr-plan.d.ts.map