import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
/**
 * Explicitly trusted, fixture-only stdio audit. Launches a reviewed local
 * CommonJS fixture, NOT an arbitrary command, with no inherited secrets or
 * shell. Sends only three deterministic malformed requests, never tools/call.
 */
export async function auditStdioNegativeFixture(file, options) {
    if (options?.trusted !== true)
        throw new Error('Explicit --trusted acknowledgement required.');
    const timeout = options.timeoutMs ?? 3000;
    if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 10000)
        throw new Error('Invalid stdio fixture timeout.');
    if (!path.isAbsolute(file) || path.extname(file) !== '.cjs')
        throw new Error('Expected an absolute .cjs fixture path.');
    const source = path.resolve(file);
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Refusing symlink or non-regular stdio fixture.');
    const probes = [
        { jsonrpc: '1.0', id: 91, method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 92, method: '', params: {} },
        { jsonrpc: '2.0', id: 93, method: 'tools/list', result: {} },
    ];
    const child = spawn(process.execPath, [source], {
        cwd: path.dirname(source), shell: false, windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
            ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}) },
    });
    let output = '', overLimit = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        output += chunk;
        if (Buffer.byteLength(output, 'utf8') > 65536) {
            overLimit = true;
            child.kill('SIGKILL');
        }
    });
    const done = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Stdio fixture timed out.')); }, timeout);
        timer.unref();
        child.once('error', error => { clearTimeout(timer); reject(new Error('Stdio fixture spawn failed.')); });
        child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    child.stdin.on('error', () => { });
    child.stdin.end(probes.map(x => JSON.stringify(x)).join('\n') + '\n');
    await done;
    if (overLimit)
        throw new Error('Stdio fixture response exceeded 64 KiB.');
    const lines = output.split(/\r?\n/).filter(x => x.trim());
    const findings = probes.map((probe, index) => {
        const line = lines[index];
        if (!line)
            return { probe: probe.id, passed: false, reason: 'missing-response' };
        let response;
        try {
            response = JSON.parse(line);
        }
        catch {
            return { probe: probe.id, passed: false, reason: 'invalid-json' };
        }
        if (response === null || typeof response !== 'object' || Array.isArray(response))
            return { probe: probe.id, passed: false, reason: 'invalid-envelope' };
        const m = response;
        if (m.jsonrpc !== '2.0' || m.id !== probe.id)
            return { probe: probe.id, passed: false, reason: 'mismatched-response' };
        const err = m.error;
        if (!err || typeof err !== 'object' || Array.isArray(err) || Object.hasOwn(m, 'result'))
            return { probe: probe.id, passed: false, reason: 'missing-error' };
        const error = err;
        return error.code === -32600 && typeof error.message === 'string'
            ? { probe: probe.id, passed: true, reason: 'invalid-request-rejected' }
            : { probe: probe.id, passed: false, reason: 'unexpected-error-code' };
    });
    if (lines.length !== 3)
        findings.push({ probe: 0, passed: false, reason: 'unexpected-response-count' });
    return { schemaVersion: 1, transport: 'stdio', valid: findings.every(x => x.passed), probes: 3, findings };
}
//# sourceMappingURL=mcp-stdio-negative.js.map