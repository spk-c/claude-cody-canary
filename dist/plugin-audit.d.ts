import { type PluginDiscovery } from './plugin-init.js';
export type PluginAuditFinding = {
    code: string;
    severity: 'info' | 'warning';
    component: string;
};
export interface PluginAuditReport {
    schemaVersion: 1;
    pluginName: string;
    counts: Record<string, number>;
    findings: PluginAuditFinding[];
    needsModelTests: boolean;
}
/** Read-only structural compatibility audit: never loads or executes plugin commands. */
export declare function auditPluginDiscovery(d: PluginDiscovery): PluginAuditReport;
export declare function auditPluginDirectory(dir: string): Promise<PluginAuditReport>;
//# sourceMappingURL=plugin-audit.d.ts.map