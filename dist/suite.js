import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { minimatch, Minimatch } from 'minimatch';
import YAML from 'yaml';
import { z } from 'zod';
import { loadScenario } from './config.js';
import { clusterRunFailures, fingerprintRun } from './fingerprint.js';
import { runScenarioWithCache } from './result-cache.js';
import { runScenario } from './runner.js';
import { getRepoRoot, resolveCommit } from './git.js';
import { CANARY_VERSION } from './version.js';
const SuiteEntrySchema = z.object({
    path: z.string().min(1),
    tags: z.array(z.string().min(1)).default([]),
    affects: z.array(z.string().min(1)).default([]),
    always: z.boolean().default(false),
}).strict();
export const SuiteSchema = z.object({
    version: z.literal(1),
    name: z.string().min(1),
    include: z.array(z.string().min(1)).default([]),
    exclude: z.array(z.string().min(1)).default([]),
    /** Tags applied to every scenario reached through include patterns. */
    tags: z.array(z.string().min(1)).default([]),
    scenarios: z.array(SuiteEntrySchema).default([]),
    concurrency: z.number().int().min(1).max(32).default(1),
    fail_fast: z.boolean().default(false),
    max_runs: z.number().int().min(1).max(10_000).default(500),
    reuse_results: z.boolean().default(false),
}).strict().refine((value) => value.include.length > 0 || value.scenarios.length > 0, {
    message: 'A suite needs at least one include pattern or scenarios entry.',
});
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'results']);
function normalizeRelative(value) {
    return value.replace(/\\/g, '/').replace(/^\.\//, '');
}
async function collectFiles(root, current = root, output = []) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && SKIP_DIRS.has(entry.name))
            continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(root, absolute, output);
        }
        else if (entry.isFile()) {
            if (output.length >= 20_000)
                throw new Error('Suite discovery exceeded 20,000 files; narrow the include patterns.');
            output.push(normalizeRelative(path.relative(root, absolute)));
        }
    }
    return output;
}
export function parseSuite(value) {
    const parsed = SuiteSchema.safeParse(value);
    if (parsed.success)
        return parsed.data;
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('\n');
    throw new Error(`Invalid Canary suite:\n${details}`);
}
export async function loadSuite(suitePath) {
    let raw;
    try {
        raw = await readFile(suitePath, 'utf8');
    }
    catch (error) {
        throw new Error(`Could not read suite ${suitePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        return parseSuite(YAML.parse(raw));
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith('Invalid Canary suite:'))
            throw error;
        throw new Error(`Could not parse YAML in ${suitePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function parseShard(value) {
    if (!value)
        return undefined;
    const match = /^(\d+)\/(\d+)$/.exec(value.trim());
    if (!match)
        throw new Error('--shard must use N/M, for example 2/4.');
    const index = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
        throw new Error('--shard must satisfy 1 <= N <= M.');
    }
    return { index, total };
}
function mergeEntry(target, file, entry) {
    const current = target.get(file) ?? { path: file, tags: [], affects: [], always: false };
    current.tags = [...new Set([...current.tags, ...entry.tags])].sort();
    current.affects = [...new Set([...current.affects, ...entry.affects])].sort();
    current.always = current.always || entry.always;
    target.set(file, current);
}
async function discoverSuiteCandidates(suite, cwd) {
    const files = await collectFiles(cwd);
    const selected = new Map();
    // Parse each glob once and scan the file list a single time. Repeatedly
    // compiling minimatch in a pattern x file nested loop is expensive for
    // monorepos; exclusions and patterns remain dotfile-aware.
    const excludes = suite.exclude.map(pattern => new Minimatch(pattern, { dot: true }));
    const includes = suite.include.map(pattern => new Minimatch(pattern, { dot: true }));
    const entries = suite.scenarios.map(entry => ({ entry, matcher: new Minimatch(entry.path, { dot: true }) }));
    for (const file of files) {
        if (excludes.some(pattern => pattern.match(file)))
            continue;
        if (includes.some(pattern => pattern.match(file))) {
            mergeEntry(selected, file, { tags: suite.tags, affects: [], always: false });
        }
        for (const { entry, matcher } of entries) {
            if (matcher.match(file))
                mergeEntry(selected, file, entry);
        }
    }
    const candidates = [...selected.values()].sort((a, b) => a.path.localeCompare(b.path));
    // Limit file parsing concurrency to avoid saturating the file descriptor
    // budget, keeping result order and errors deterministic.
    for (let start = 0; start < candidates.length; start += 16) {
        await Promise.all(candidates.slice(start, start + 16).map(async (candidate) => {
            const scenario = await loadScenario(path.resolve(cwd, candidate.path));
            candidate.tags = [...new Set([...candidate.tags, ...scenario.tags])].sort();
            candidate.affects = [...new Set([...candidate.affects, ...scenario.affects])].sort();
            candidate.always = candidate.always || scenario.always_run;
        }));
    }
    return candidates;
}
export async function explainSuiteSelection(suite, options = {}) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const discovered = await discoverSuiteCandidates(suite, cwd);
    const skipped = [];
    let selected = [...discovered];
    if (options.tag) {
        const next = [];
        for (const item of selected) {
            if (item.tags.includes(options.tag))
                next.push(item);
            else
                skipped.push({ path: item.path, reason: 'tag' });
        }
        selected = next;
    }
    if (options.changedPaths) {
        const changed = options.changedPaths.map(normalizeRelative);
        const next = [];
        for (const item of selected) {
            const affected = item.always || item.affects.length === 0 || changed.some((file) => item.affects.some((pattern) => minimatch(file, pattern, { dot: true })));
            if (affected)
                next.push(item);
            else
                skipped.push({ path: item.path, reason: 'unaffected' });
        }
        selected = next;
    }
    const shard = parseShard(options.shard);
    if (shard) {
        const next = [];
        selected.forEach((item, index) => {
            if (index % shard.total === shard.index - 1)
                next.push(item);
            else
                skipped.push({ path: item.path, reason: 'shard' });
        });
        selected = next;
    }
    return {
        discovered,
        selected: selected.sort((a, b) => a.path.localeCompare(b.path)),
        skipped: skipped.sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason)),
    };
}
export async function resolveSuiteScenarios(suite, options = {}) {
    return (await explainSuiteSelection(suite, options)).selected;
}
function safeSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'suite';
}
function formatSuiteMarkdown(result) {
    const lines = [
        `# Claude Canary suite — ${result.suite}`,
        '',
        `**Result:** ${result.passed ? 'PASS' : 'FAIL'}`,
        `**Scenarios:** ${result.passedCount}/${result.total} passed`,
        `**Discovered:** ${result.discoveredTotal}; skipped by selection/sharding: ${result.skippedBySelection}`,
        `**Cache hits:** ${result.cacheHitCount}`,
    ];
    if (result.tag)
        lines.push(`**Tag:** \`${result.tag}\``);
    if (result.shard)
        lines.push(`**Shard:** \`${result.shard}\``);
    lines.push('', '| Scenario | Result | Fingerprint | Cache |', '| --- | --- | --- | --- |');
    for (const item of result.scenarios) {
        lines.push(`| \`${item.path}\` | ${item.passed ? 'PASS' : item.infrastructureError ? 'INFRA' : 'FAIL'} | ${item.fingerprint ? `\`${item.fingerprint.id}\`` : ''} | ${item.cacheHit ? 'hit' : ''} |`);
        if (item.infrastructureError)
            lines.push(`\n> ${item.path}: ${item.infrastructureError.replace(/\n/g, ' ')}`);
    }
    if (result.skipped.length) {
        lines.push('', '## Skipped', '');
        for (const item of result.skipped)
            lines.push(`- \`${item.path}\` — ${item.reason}`);
    }
    if (result.failureClusters.length) {
        lines.push('', '## Failure clusters', '');
        for (const cluster of result.failureClusters) {
            lines.push(`- \`${cluster.fingerprint.id}\` — ${cluster.count} failure(s): ${cluster.scenarios.join(', ')}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
/**
 * Shared shard identity binds the exact repo commit, full discovered suite
 * definition, selection filters, runtime and hashed provider environment.
 * It excludes shard N/M by design, enabling valid distributed aggregation.
 */
export async function suiteExecutionIdentity(absoluteSuitePath, selection, options, cwd) {
    const gitRoot = await getRepoRoot(cwd);
    const gitCommit = await resolveCommit(gitRoot, options.gitRefOverride ?? 'HEAD');
    const providerEnvironment = Object.fromEntries(Object.entries(process.env)
        .filter(([key]) => /^(ANTHROPIC_|CLAUDE_|MCP_|OPENAI_|AWS_|GOOGLE_|VERTEX_)/.test(key))
        .sort(([a], [b]) => a.localeCompare(b)));
    const record = {
        schemaVersion: 1,
        gitCommit,
        suiteSource: await readFile(absoluteSuitePath, 'utf8'),
        discovered: selection.discovered,
        tag: options.tag ?? null,
        changedPaths: [...(options.changedPaths ?? [])].sort(),
        executable: options.executableOverride ?? null,
        platform: process.platform,
        arch: process.arch,
        nodeMajor: process.versions.node.split('.')[0],
        canaryVersion: CANARY_VERSION,
        providerEnvironment,
    };
    return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
export async function runSuite(suitePath, options = {}) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const absoluteSuitePath = path.resolve(cwd, suitePath);
    const suite = await loadSuite(absoluteSuitePath);
    const selection = await explainSuiteSelection(suite, { cwd, tag: options.tag, changedPaths: options.changedPaths, shard: options.shard });
    const resolved = selection.selected;
    const executionIdentity = options.shard
        ? await suiteExecutionIdentity(absoluteSuitePath, selection, options, cwd)
        : undefined;
    if (resolved.length === 0)
        throw new Error(`Suite ${suite.name} selected no scenarios.`);
    const maxRuns = options.maxRuns ?? suite.max_runs;
    if (!Number.isInteger(maxRuns) || maxRuns < 1)
        throw new Error('Suite maxRuns must be a positive integer.');
    if (resolved.length > maxRuns)
        throw new Error(`Suite ${suite.name} selected ${resolved.length} scenarios, exceeding max run budget ${maxRuns}.`);
    const concurrency = Math.min(32, Math.max(1, options.concurrency ?? suite.concurrency));
    const failFast = options.failFast ?? suite.fail_fast;
    const reuseResults = options.reuseResults ?? suite.reuse_results;
    const results = new Array(resolved.length);
    let cursor = 0;
    let stop = false;
    const worker = async () => {
        while (!stop) {
            const index = cursor++;
            if (index >= resolved.length)
                return;
            const item = resolved[index];
            try {
                const scenario = await loadScenario(path.resolve(cwd, item.path));
                let run;
                let cacheHit = false;
                let cacheKey;
                if (reuseResults) {
                    const cached = await runScenarioWithCache(scenario, item.path, {
                        cwd,
                        executableOverride: options.executableOverride,
                        gitRefOverride: options.gitRefOverride,
                        artifactLabel: options.artifactLabel ? `${options.artifactLabel}-${index + 1}` : undefined,
                        cacheRoot: options.cacheRoot,
                    });
                    run = cached.result;
                    cacheHit = cached.cacheHit;
                    cacheKey = cached.cacheKey;
                }
                else {
                    run = await runScenario(scenario, {
                        cwd,
                        executableOverride: options.executableOverride,
                        gitRefOverride: options.gitRefOverride,
                        artifactLabel: options.artifactLabel ? `${options.artifactLabel}-${index + 1}` : undefined,
                    });
                }
                results[index] = {
                    path: item.path,
                    passed: run.passed,
                    result: run,
                    fingerprint: run.passed ? undefined : fingerprintRun(run),
                    cacheHit,
                    cacheKey,
                };
                if (!run.passed && failFast)
                    stop = true;
            }
            catch (error) {
                results[index] = {
                    path: item.path,
                    passed: false,
                    infrastructureError: error instanceof Error ? error.message : String(error),
                };
                if (failFast)
                    stop = true;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, resolved.length) }, () => worker()));
    const completed = results.filter((item) => Boolean(item));
    const runResults = completed.flatMap((item) => item.result ? [item.result] : []);
    const infrastructureFailedCount = completed.filter((item) => item.infrastructureError).length;
    const failedCount = completed.filter((item) => !item.passed).length;
    const result = {
        schemaVersion: 1,
        suite: suite.name,
        suitePath: normalizeRelative(path.relative(cwd, absoluteSuitePath)),
        createdAt: new Date().toISOString(),
        passed: failedCount === 0 && completed.length === resolved.length,
        total: completed.length,
        discoveredTotal: selection.discovered.length,
        passedCount: completed.filter((item) => item.passed).length,
        failedCount,
        infrastructureFailedCount,
        cacheHitCount: completed.filter((item) => item.cacheHit).length,
        executionIdentity,
        skippedBySelection: selection.skipped.length,
        skipped: selection.skipped,
        shard: options.shard,
        tag: options.tag,
        executable: options.executableOverride,
        scenarios: completed,
        failureClusters: clusterRunFailures(runResults),
    };
    if (options.writeArtifacts !== false) {
        const outputDir = path.join(cwd, '.canary', 'results');
        await mkdir(outputDir, { recursive: true });
        const stamp = result.createdAt.replace(/[:.]/g, '-');
        const base = `${safeSlug(suite.name)}-${stamp}-suite`;
        result.jsonArtifactPath = path.join(outputDir, `${base}.json`);
        result.markdownArtifactPath = path.join(outputDir, `${base}.md`);
        await writeFile(result.jsonArtifactPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
        await writeFile(result.markdownArtifactPath, formatSuiteMarkdown(result), 'utf8');
    }
    return result;
}
export function combineSuiteResults(results) {
    if (!results.length)
        throw new Error('At least one suite result is required.');
    const first = results[0];
    for (const result of results) {
        if (result.suite !== first.suite || result.suitePath !== first.suitePath)
            throw new Error('Cannot combine results from different suites.');
    }
    const scenariosByPath = new Map();
    for (const result of results) {
        for (const scenario of result.scenarios) {
            if (scenariosByPath.has(scenario.path))
                throw new Error(`Duplicate scenario across suite shards: ${scenario.path}`);
            scenariosByPath.set(scenario.path, scenario);
        }
    }
    const identities = results.map(result => result.executionIdentity).filter(Boolean);
    if (identities.length && (identities.length !== results.length || new Set(identities).size !== 1)) {
        throw new Error('Cannot merge shards from different or missing execution identities.');
    }
    const scenarios = [...scenariosByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    const runResults = scenarios.flatMap((item) => item.result ? [item.result] : []);
    const failedCount = scenarios.filter((item) => !item.passed).length;
    const infrastructureFailedCount = scenarios.filter((item) => item.infrastructureError).length;
    return {
        schemaVersion: 1,
        suite: first.suite,
        suitePath: first.suitePath,
        createdAt: new Date().toISOString(),
        passed: failedCount === 0,
        total: scenarios.length,
        discoveredTotal: Math.max(...results.map((result) => result.discoveredTotal)),
        passedCount: scenarios.filter((item) => item.passed).length,
        failedCount,
        infrastructureFailedCount,
        cacheHitCount: scenarios.filter((item) => item.cacheHit).length,
        executionIdentity: identities[0],
        skippedBySelection: 0,
        skipped: [],
        scenarios,
        failureClusters: clusterRunFailures(runResults),
    };
}
export { formatSuiteMarkdown, parseShard };
//# sourceMappingURL=suite.js.map