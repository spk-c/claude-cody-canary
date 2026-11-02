export interface StdioNegativeFinding {
    probe: number;
    passed: boolean;
    reason: string;
}
export interface StdioNegativeReport {
    schemaVersion: 1;
    transport: 'stdio';
    valid: boolean;
    probes: number;
    findings: StdioNegativeFinding[];
}
/**
 * Explicitly trusted, fixture-only stdio audit. Launches a reviewed local
 * CommonJS fixture, NOT an arbitrary command, with no inherited secrets or
 * shell. Sends only three deterministic malformed requests, never tools/call.
 */
export declare function auditStdioNegativeFixture(file: string, options: {
    trusted: true;
    timeoutMs?: number;
}): Promise<StdioNegativeReport>;
//# sourceMappingURL=mcp-stdio-negative.d.ts.map