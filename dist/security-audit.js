const obj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
/** Static, value-blind policy review; no hooks or config-supplied commands are executed. */
export function auditClaudeSettings(value) {
    if (!obj(value))
        throw new Error('Claude settings must contain a JSON object.');
    const findings = [];
    const permissions = value.permissions;
    if (permissions !== undefined && !obj(permissions))
        throw new Error('permissions must be a JSON object.');
    if (obj(permissions)) {
        if (permissions.defaultMode === 'bypassPermissions')
            findings.push({ code: 'BYPASS_PERMISSIONS_MODE', severity: 'high', location: 'permissions.defaultMode' });
        if (permissions.disableBypassPermissionsMode === false)
            findings.push({ code: 'BYPASS_MODE_ALLOWED', severity: 'medium', location: 'permissions.disableBypassPermissionsMode' });
        if (permissions.allow !== undefined) {
            if (!Array.isArray(permissions.allow))
                throw new Error('permissions.allow must be an array.');
            for (const p of permissions.allow) {
                if (typeof p !== 'string')
                    throw new Error('permissions.allow must contain strings.');
                if (p === '*' || p === 'Bash(*)' || p === 'Bash' || p === 'mcp__*')
                    findings.push({ code: 'BROAD_ALLOW_RULE', severity: 'high', location: 'permissions.allow' });
            }
        }
    }
    if (value.hooks !== undefined && !obj(value.hooks))
        throw new Error('hooks must be a JSON object.');
    if (obj(value.hooks)) {
        for (const [kind, entries] of Object.entries(value.hooks)) {
            if (!Array.isArray(entries))
                continue;
            for (const block of entries) {
                if (!obj(block) || !Array.isArray(block.hooks))
                    continue;
                for (const hook of block.hooks) {
                    if (!obj(hook) || typeof hook.command !== 'string')
                        continue;
                    if (/(?:\bcurl\b|\bwget\b).{0,240}\|\s*(?:bash|sh)\b/i.test(hook.command))
                        findings.push({ code: 'REMOTE_SCRIPT_PIPE_TO_SHELL', severity: 'high', location: `hooks.${kind}` });
                }
            }
        }
    }
    return { schemaVersion: 1, ok: findings.length === 0, findings };
}
//# sourceMappingURL=security-audit.js.map