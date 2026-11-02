import { type McpContract } from './mcp-contract.js';
export interface LiveMcpFinding {
    name: string;
    passed: boolean;
    reason: string;
}
export interface LiveMcpAudit {
    schemaVersion: 1;
    transport: 'stdio' | 'streamable-http';
    valid: boolean;
    protocolVersion: string;
    toolsDiscovered: number;
    findings: LiveMcpFinding[];
    negativeProbes: number;
}
export interface LiveMcpOptions {
    trusted: true;
    negativeProbes?: boolean;
    maxRequests?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}
/**
 * Acknowledged trusted-server audit. Positive checks use existing MCP inspector,
 * which does not call tools. Deliberately malformed messages are sent ONLY to
 * numeric loopback endpoints, with a separate explicit opt-in.
 */
export declare function auditLiveMcp(contract: McpContract, options: LiveMcpOptions): Promise<LiveMcpAudit>;
//# sourceMappingURL=mcp-live-audit.d.ts.map