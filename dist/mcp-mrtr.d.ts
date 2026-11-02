/**
 * Offline MRTR retry envelope builder. Caller must explicitly approve and
 * deliver the response; this module never invokes tools or performs I/O.
 */
export declare function prepareMcpMrtrRetry(original: unknown, result: unknown, inputResponses: unknown, nextId: number, approval: {
    approved: true;
}): Record<string, unknown>;
//# sourceMappingURL=mcp-mrtr.d.ts.map