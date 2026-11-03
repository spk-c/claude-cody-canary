import { createHash } from 'node:crypto';
import { z } from 'zod';
import { findExecutable } from './doctor.js';
import { agentReadOnlyArgs } from './agent-runner.js';
import { spawnCapture } from './process.js';
import { AgentLongitudinalSchema } from './agent-longitudinal.js';
const sha = z.string().regex(/^[0-9a-f]{64}$/);
const experiment = AgentLongitudinalSchema.shape.experiment;
export const AgentE2eManifestSchema = z.object({
    schemaVersion: z.literal(1),
    agent: z.enum(['claude', 'codex', 'qwen']),
    version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    experiment,
    limits: z.object({
        maxRuns: z.number().int().min(1).max(20),
        maxDurationMs: z.number().int().min(100).max(600_000),
        perRunTimeoutMs: z.number().int().min(100).max(120_000),
        maxReportedCostUsd: z.number().finite().min(0.01).max(20),
        reserveUsdPerRun: z.number().finite().min(0.01).max(10),
    }).strict(),
    cases: z.array(z.object({
        scenarioHash: sha,
        replicate: z.number().int().min(0).max(29),
        prompt: z.string().min(1).max(2000),
        expectedAnswerSha256: sha,
    }).strict()).min(1).max(20),
}).strict();
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function hashE2eAnswer(answer) {
    if (typeof answer !== 'string' || answer.length > 65536)
        throw new Error('Answer exceeds verification length.');
    return createHash('sha256').update(answer.replace(/\r\n/g, '\n').trim().normalize('NFC'), 'utf8').digest('hex');
}
function finiteUsage(data) {
    const usage = isRecord(data.usage) ? data.usage : data;
    const input = usage.input_tokens ?? usage.inputTokens;
    const output = usage.output_tokens ?? usage.outputTokens;
    const tokens = typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 &&
        typeof output === 'number' && Number.isSafeInteger(output) && output >= 0 &&
        Number.isSafeInteger(input + output) ? input + output : undefined;
    const cost = typeof data.total_cost_usd === 'number' && Number.isFinite(data.total_cost_usd)
        && data.total_cost_usd >= 0 && data.total_cost_usd <= 10000 ? data.total_cost_usd : undefined;
    return { tokens, cost };
}
/** Parse only a final documented response field, never incidental log text. */
export function parseE2eResponse(agent, process) {
    if (process.code !== 0 || process.timedOut || process.outputTruncated || process.stdout.length > 256 * 1024)
        return {};
    try {
        if (agent === 'codex') {
            let answer, tokens = 0, completed = 0, failed = false;
            for (const line of process.stdout.split(/\r?\n/)) {
                if (!line.trim())
                    continue;
                const entry = JSON.parse(line);
                if (!isRecord(entry) || typeof entry.type !== 'string')
                    return {};
                if (entry.type === 'error' || entry.type === 'turn.failed')
                    failed = true;
                if (entry.type === 'item.completed' && isRecord(entry.item) && entry.item.type === 'agent_message') {
                    if (typeof entry.item.text !== 'string' || entry.item.text.length > 65536)
                        return {};
                    answer = entry.item.text;
                }
                if (entry.type === 'turn.completed') {
                    const use = finiteUsage(entry);
                    if (use.tokens === undefined || !Number.isSafeInteger(tokens + use.tokens))
                        return {};
                    tokens += use.tokens;
                    completed++;
                }
            }
            return failed || completed !== 1 || answer === undefined ? {} : { answer, tokens };
        }
        const parsed = JSON.parse(process.stdout);
        if (!isRecord(parsed) || parsed.is_error === true)
            return {};
        const answer = agent === 'claude' ? parsed.result :
            typeof parsed.response === 'string' ? parsed.response : parsed.result;
        if (typeof answer !== 'string' || answer.length > 65536)
            return {};
        const usage = finiteUsage(parsed);
        return { answer, ...usage };
    }
    catch {
        return {};
    }
}
function validateManifest(input) {
    // Do not expose user prompts, expected answers or provider text in thrown validation errors.
    const result = AgentE2eManifestSchema.safeParse(input);
    if (!result.success)
        throw new Error('Invalid E2E manifest schema (sensitive field details suppressed).');
    const manifest = result.data;
    const pairs = new Set();
    const scenarioCounts = new Map();
    if (manifest.cases.length > manifest.limits.maxRuns)
        throw new Error('E2E case count exceeds maxRuns.');
    if (manifest.limits.reserveUsdPerRun > manifest.limits.maxReportedCostUsd)
        throw new Error('E2E per-run cost reservation exceeds total reported-cost limit.');
    for (const entry of manifest.cases) {
        const key = entry.scenarioHash + ':' + entry.replicate;
        if (pairs.has(key))
            throw new Error('E2E manifest has duplicate scenario/replicate keys.');
        pairs.add(key);
        scenarioCounts.set(entry.scenarioHash, (scenarioCounts.get(entry.scenarioHash) ?? 0) + 1);
        if (scenarioCounts.get(entry.scenarioHash) > 30)
            throw new Error('E2E has too many repetitions per scenario.');
    }
    return manifest;
}
/**
 * Preview is strictly offline. Execution requires both explicit approvals and
 * only runs bounded provider CLIs in their read-only modes, without shell.
 *
 * Reported-cost stopping is retrospective. No hard cost cap can be guaranteed
 * until the provider supports a trusted pre-authorization/spend-limit API.
 */
export async function runAgentE2e(input, opts) {
    const manifest = validateManifest(input);
    const actual = opts.trusted === true && opts.allowProviderCosts === true;
    if ((opts.trusted === true) !== (opts.allowProviderCosts === true))
        throw new Error('E2E requires both --trusted and --allow-provider-costs for provider execution.');
    const limit = manifest.limits;
    const report = {
        schemaVersion: 1, mode: actual ? 'executed' : 'preview', agent: manifest.agent, version: manifest.version,
        planned: manifest.cases.length, attempted: 0, completed: 0, verifiedPassed: 0, verifiedFailed: 0,
        infrastructure: 0, elapsedMs: 0, reportedCostUsd: 0, costTracking: actual ? 'reported' : 'not-run',
        stoppedReason: actual ? 'completed' : 'preview', budgetGuarantee: 'not-a-provider-spend-cap', cases: [],
    };
    if (!actual)
        return report;
    const command = opts.executableOverride ?? manifest.agent;
    if (!opts.executableOverride && !(await findExecutable(command, opts.cwd, opts.env ?? process.env)))
        throw new Error('E2E agent executable unavailable on PATH.');
    const now = opts.now ?? Date.now;
    const started = now();
    for (const entry of manifest.cases) {
        const elapsed = Math.max(0, now() - started);
        const remaining = limit.maxDurationMs - elapsed;
        if (remaining < 100) {
            report.stoppedReason = 'duration-limit';
            break;
        }
        if (report.reportedCostUsd + limit.reserveUsdPerRun > limit.maxReportedCostUsd + 1e-9) {
            report.stoppedReason = 'reported-cost-limit';
            break;
        }
        const completedProcess = await (opts.execute ?? spawnCapture)(command, agentReadOnlyArgs(manifest.agent, entry.prompt), {
            cwd: opts.cwd, env: opts.env ?? process.env, timeoutMs: Math.min(limit.perRunTimeoutMs, remaining),
            maxOutputChars: 256 * 1024,
        });
        report.attempted++;
        const evidence = parseE2eResponse(manifest.agent, completedProcess);
        const verified = evidence.answer === undefined ? undefined :
            hashE2eAnswer(evidence.answer) === entry.expectedAnswerSha256;
        const outcome = verified === undefined ? 'infrastructure' : verified ? 'passed' : 'failed';
        const reason = verified === undefined
            ? completedProcess.code !== 0 || completedProcess.timedOut || completedProcess.outputTruncated ? 'process-error' : 'unverifiable-response'
            : verified ? 'answer-matched' : 'answer-mismatched';
        const record = {
            scenarioHash: entry.scenarioHash, replicate: entry.replicate, outcome, reason,
            durationMs: Math.min(3_600_000, Math.max(0, Math.round(completedProcess.durationMs))),
            recordedAt: new Date().toISOString(),
            ...(evidence.tokens === undefined ? {} : { totalTokens: evidence.tokens }),
            ...(evidence.cost === undefined ? {} : { reportedCostUsd: evidence.cost }),
        };
        report.cases.push(record);
        report.completed++;
        if (outcome === 'passed')
            report.verifiedPassed++;
        else if (outcome === 'failed')
            report.verifiedFailed++;
        else
            report.infrastructure++;
        if (evidence.cost !== undefined) {
            report.reportedCostUsd += evidence.cost;
            if (report.reportedCostUsd > limit.maxReportedCostUsd + 1e-9) {
                report.costTracking = 'exceeded';
                report.stoppedReason = 'reported-cost-limit';
                break;
            }
        }
        else {
            report.costTracking = 'unavailable';
            report.stoppedReason = 'cost-unavailable';
            break;
        }
        if (outcome === 'infrastructure') {
            report.stoppedReason = 'process-error';
            break;
        }
    }
    report.elapsedMs = Math.max(0, now() - started);
    if (report.attempted === manifest.cases.length && report.costTracking === 'reported' &&
        report.stoppedReason === 'completed' && report.infrastructure === 0) {
        // Even if reported cost is unknown, all cases can be passed to the
        // longitudinal analyzer, which will refuse any infrastructure outcomes.
        report.cohort = {
            schemaVersion: 1, agent: manifest.agent, version: manifest.version,
            experiment: manifest.experiment, runs: report.cases.map(({ scenarioHash, replicate, outcome, durationMs, recordedAt, totalTokens, reportedCostUsd }) => ({
                scenarioHash, replicate, outcome, durationMs, recordedAt,
                ...(totalTokens === undefined ? {} : { totalTokens }),
                ...(reportedCostUsd === undefined ? {} : { reportedCostUsd }),
            })),
        };
    }
    return report;
}
//# sourceMappingURL=agent-e2e.js.map