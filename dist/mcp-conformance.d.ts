export interface McpConformanceFinding {
    code: 'INVALID_JSONRPC' | 'INVALID_ID' | 'MISSING_OUTCOME' | 'AMBIGUOUS_OUTCOME' | 'INVALID_ERROR' | 'INVALID_METHOD' | 'OVERSIZE';
    index: number;
}
export interface McpConformanceResult {
    schemaVersion: 1;
    valid: boolean;
    inspected: number;
    findings: McpConformanceFinding[];
}
/** Pure offline envelope conformance: does not execute tools or contact remote MCP servers. */
export declare function validateMcpEnvelopes(input: unknown, maxMessages?: number): McpConformanceResult;
/** Deterministic negative corpus; harmless data for testing a parser, NOT active server fuzzing. */
export declare function mcpMalformedCorpus(): unknown[];
//# sourceMappingURL=mcp-conformance.d.ts.map