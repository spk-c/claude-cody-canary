/**
 * Bounded stateless MCP 2026-07-28 response classification.
 * The inspector never fulfils MRTR input requests or executes tools.
 */
export interface McpWireNotifications {
    toolsListChanged: number;
    promptsListChanged: number;
    resourcesListChanged: number;
    progress: number;
    message: number;
}
export interface McpSseResult {
    response: Record<string, unknown>;
    notifications: McpWireNotifications;
    events: number;
}
/** A result requiring input is reported rather than silently invoked/fulfilled. */
export declare function classifyMcpResult(value: unknown, method: string): 'complete' | 'input_required';
export declare function parseMcpSseResponse(source: string, requestId: number, maxEvents?: number): McpSseResult;
//# sourceMappingURL=mcp-wire.d.ts.map