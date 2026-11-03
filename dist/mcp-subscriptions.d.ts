export interface McpSubscriptionProbe {
    schemaVersion: 1;
    valid: boolean;
    acknowledged: boolean;
    notificationsReceived: number;
    cancelledByClient: boolean;
    reason: 'ok' | 'missing-acknowledgement' | 'invalid-stream' | 'timeout' | 'unexpected-notification';
}
/** An explicitly approved, loopback-only, bounded 2026-07-28 notification probe. */
export declare function probeMcpSubscriptions(endpoint: string, options: {
    trusted: true;
    maxNotifications?: number;
    timeoutMs?: number;
    subscriptionId?: number;
    fetchImpl?: typeof fetch;
}): Promise<McpSubscriptionProbe>;
//# sourceMappingURL=mcp-subscriptions.d.ts.map