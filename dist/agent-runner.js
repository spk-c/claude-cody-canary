import { findExecutable } from './doctor.js';
import { spawnCapture } from './process.js';
/** Explicit per-provider read-only, one-shot arguments. Never enable YOLO/auto-edit. */
export function agentReadOnlyArgs(agent, prompt) {
    if (!prompt.trim() || prompt.length > 8000)
        throw new Error('Agent prompt must have 1–8000 characters.');
    switch (agent) {
        case 'claude': return ['-p', prompt, '--output-format', 'json', '--permission-mode', 'plan', '--no-session-persistence'];
        case 'codex': return ['exec', '--json', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--', prompt];
        case 'qwen': return ['-p', prompt, '--output-format', 'json', '--approval-mode', 'plan'];
        default: throw new Error('Unsupported agent; refusing unknown commands.');
    }
}
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function safeUsage(v) {
    if (!isObj(v))
        return;
    const usage = isObj(v.usage) ? v.usage : v;
    const input = usage.input_tokens ?? usage.inputTokens;
    const output = usage.output_tokens ?? usage.outputTokens;
    const tokens = Number.isSafeInteger(input) && typeof input === 'number' && input >= 0
        && Number.isSafeInteger(output) && typeof output === 'number' && output >= 0
        && Number.isSafeInteger(input + output) ? input + output : undefined;
    const cost = typeof v.total_cost_usd === 'number' && Number.isFinite(v.total_cost_usd)
        && v.total_cost_usd >= 0 ? v.total_cost_usd : undefined;
    return tokens !== undefined || cost !== undefined ? { cost, tokens } : undefined;
}
/** Only turn.completed has authoritative Codex usage; item events can contain arbitrary text. */
function parseCodexEvents(stdout) {
    let tokens = 0, completed = 0, failed = false;
    for (const line of stdout.split(/\r?\n/)) {
        if (!line.trim())
            continue;
        let event;
        try {
            event = JSON.parse(line);
        }
        catch {
            return { completed: false, failed: true };
        }
        if (!isObj(event) || typeof event.type !== 'string')
            return { completed: false, failed: true };
        if (event.type === 'turn.failed' || event.type === 'error')
            failed = true;
        if (event.type !== 'turn.completed')
            continue;
        const usage = safeUsage(event);
        if (usage?.tokens === undefined || !Number.isSafeInteger(tokens + usage.tokens))
            return { completed: false, failed: true };
        tokens += usage.tokens;
        completed++;
    }
    return { completed: completed > 0, failed, tokens: completed > 0 ? tokens : undefined };
}
/** Executes a reviewed, read-only one-shot agent and drops raw prompts/output. */
export async function runAgentTest(opts) {
    if (opts.trusted !== true)
        throw new Error('Explicit trusted-run approval required.');
    const timeoutMs = opts.timeoutMs ?? 120_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000)
        throw new Error('Agent timeout out of bounds.');
    const args = agentReadOnlyArgs(opts.agent, opts.prompt);
    const command = opts.executableOverride ?? opts.agent;
    if (!opts.executableOverride && !(await findExecutable(command, opts.cwd, opts.env ?? process.env)))
        throw new Error('Agent executable not found on PATH.');
    const result = await (opts.execute ?? spawnCapture)(command, args, {
        cwd: opts.cwd, env: opts.env ?? process.env, timeoutMs, maxOutputChars: 512 * 1024,
    });
    let telemetry = 'unavailable';
    let reportedCostUsd, totalTokens;
    let codexCompleted = false, codexFailed = false;
    if (!result.outputTruncated) {
        if (opts.agent === 'codex') {
            const events = parseCodexEvents(result.stdout);
            codexCompleted = events.completed;
            codexFailed = events.failed;
            if (events.tokens !== undefined) {
                telemetry = 'recognized';
                totalTokens = events.tokens;
            }
        }
        else {
            try {
                const data = safeUsage(JSON.parse(result.stdout));
                if (data) {
                    telemetry = 'recognized';
                    reportedCostUsd = data.cost;
                    totalTokens = data.tokens;
                }
            }
            catch { /* Unknown provider output is explicitly marked unavailable. */ }
        }
    }
    const codexValid = opts.agent !== 'codex' || (codexCompleted && !codexFailed);
    return { schemaVersion: 1, agent: opts.agent, passed: result.code === 0 && !result.timedOut && !result.outputTruncated && codexValid,
        exitCode: result.code, timedOut: result.timedOut, durationMs: result.durationMs,
        outputTruncated: result.outputTruncated === true, telemetry, reportedCostUsd, totalTokens };
}
//# sourceMappingURL=agent-runner.js.map