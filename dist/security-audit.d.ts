export interface SecurityAuditFinding {
    code: string;
    severity: 'high' | 'medium';
    location: string;
}
export interface SecurityAuditResult {
    schemaVersion: 1;
    findings: SecurityAuditFinding[];
    ok: boolean;
}
/** Static, value-blind policy review; no hooks or config-supplied commands are executed. */
export declare function auditClaudeSettings(value: unknown): SecurityAuditResult;
//# sourceMappingURL=security-audit.d.ts.map