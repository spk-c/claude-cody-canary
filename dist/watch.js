import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { bisectReleases } from './bisect.js';
import { loadScenario } from './config.js';
import { compareExactVersions, fetchPublishedClaudeVersions, publishedVersionsBetween } from './release-catalog.js';
import { runSuite } from './suite.js';
import { installClaudeVersion } from './versions.js';
const WatchStateSchema = z.object({
    version: z.literal(1),
    lastObserved: z.string().regex(/^\d+\.\d+\.\d+$/),
    lastKnownGood: z.string().regex(/^\d+\.\d+\.\d+$/),
    updatedAt: z.string().min(1),
    lastResult: z.enum({ initialized: 'initialized', compatible: 'compatible', regression: 'regression' }).optional(),
    /** A regression remains retryable until a candidate passes all scenarios. */
    pendingVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
}).strict();
async function readState(file) {
    try {
        const raw = await readFile(file, 'utf8');
        const parsed = WatchStateSchema.safeParse(JSON.parse(raw));
        if (!parsed.success)
            throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
        return parsed.data;
    }
    catch (error) {
        if (error?.code === 'ENOENT')
            return undefined;
        throw new Error(`Could not read Canary watch state ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function saveState(file, state) {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
        await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        await rename(temporary, file);
    }
    finally {
        await rm(temporary, { force: true });
    }
}
function formatWatchMarkdown(result) {
    const lines = [
        '# Claude Canary release watch',
        '',
        `**Status:** ${result.status}`,
        `**Latest published:** \`${result.latest}\``,
    ];
    if (result.previousKnownGood)
        lines.push(`**Previous known-good:** \`${result.previousKnownGood}\``);
    if (result.candidate)
        lines.push(`**Candidate:** \`${result.candidate}\``);
    if (result.firstBadRelease)
        lines.push(`**First bad release:** \`${result.firstBadRelease}\``);
    if (result.firstFailingScenario)
        lines.push(`**First failing scenario:** \`${result.firstFailingScenario}\``);
    if (result.infrastructureError)
        lines.push('**Infrastructure error:** test attempt incomplete; state not advanced (details suppressed).');
    if (result.unseen.length)
        lines.push(`**New releases observed:** ${result.unseen.map((value) => `\`${value}\``).join(', ')}`);
    if (result.suite) {
        lines.push('', '## Suite', '', `Passed ${result.suite.passedCount}/${result.suite.total} scenarios.`);
        for (const scenario of result.suite.scenarios.filter((item) => !item.passed)) {
            lines.push(`- FAIL \`${scenario.path}\`${scenario.fingerprint ? ` — \`${scenario.fingerprint.id}\`` : ''}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
async function writeWatchArtifacts(cwd, result) {
    const outputDir = path.join(cwd, '.canary', 'results');
    await mkdir(outputDir, { recursive: true });
    const stamp = result.createdAt.replace(/[:.]/g, '-');
    result.jsonArtifactPath = path.join(outputDir, `release-watch-${stamp}.json`);
    result.markdownArtifactPath = path.join(outputDir, `release-watch-${stamp}.md`);
    await writeFile(result.jsonArtifactPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await writeFile(result.markdownArtifactPath, formatWatchMarkdown(result), 'utf8');
}
/** Infrastructure failures cannot be called model regressions or mark a release good. */
export function classifyWatchedSuite(suite) {
    if (suite.infrastructureFailedCount > 0 || suite.total < 1)
        return 'infrastructure-error';
    if (suite.passed && suite.passedCount === suite.total)
        return 'compatible';
    return 'regression';
}
export function versionsRequiringWatch(published, lastObserved, pendingVersion) {
    const unseen = published.filter(version => compareExactVersions(version, lastObserved) > 0);
    if (pendingVersion && published.includes(pendingVersion) && !unseen.includes(pendingVersion)) {
        unseen.push(pendingVersion);
    }
    return unseen.sort(compareExactVersions);
}
export async function watchClaudeCodeReleases(options) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const statePath = path.resolve(cwd, options.statePath ?? '.canary/watch-state.json');
    const published = await fetchPublishedClaudeVersions();
    if (!published.length)
        throw new Error('Claude Code release catalog contains no exact stable releases.');
    const latest = published[published.length - 1];
    let state = await readState(statePath);
    const createdAt = new Date().toISOString();
    if (!state) {
        if (options.good) {
            if (!published.includes(options.good))
                throw new Error(`Initial known-good release ${options.good} is not published.`);
            state = { version: 1, lastObserved: options.good, lastKnownGood: options.good, updatedAt: createdAt, lastResult: 'initialized' };
        }
        else {
            const result = {
                schemaVersion: 1,
                status: 'initialized',
                createdAt,
                latest,
                unseen: [],
                statePath,
            };
            if (!options.checkOnly)
                await saveState(statePath, { version: 1, lastObserved: latest, lastKnownGood: latest, updatedAt: createdAt, lastResult: 'initialized' });
            if (options.writeArtifacts !== false)
                await writeWatchArtifacts(cwd, result);
            return result;
        }
    }
    const unseen = versionsRequiringWatch(published, state.lastObserved, state.pendingVersion);
    const base = {
        schemaVersion: 1,
        status: unseen.length ? 'new-release' : 'no-change',
        createdAt,
        previousObserved: state.lastObserved,
        previousKnownGood: state.lastKnownGood,
        latest,
        unseen,
        candidate: unseen.length ? unseen[unseen.length - 1] : undefined,
        statePath,
    };
    if (!unseen.length || options.checkOnly) {
        if (options.writeArtifacts !== false)
            await writeWatchArtifacts(cwd, base);
        return base;
    }
    const candidate = unseen[unseen.length - 1];
    options.onStatus?.(`Testing new Claude Code release ${candidate}...`);
    let suite;
    try {
        const installed = await installClaudeVersion(candidate, { platform: options.platform, onStatus: options.onStatus });
        suite = await runSuite(options.suitePath, {
            cwd,
            tag: options.tag,
            shard: options.shard,
            concurrency: options.concurrency,
            executableOverride: installed.executablePath,
            artifactLabel: `watch-${candidate}`,
        });
    }
    catch (error) {
        base.status = 'infrastructure-error';
        base.infrastructureError = error instanceof Error ? error.message : String(error);
        // Deliberately keep existing state intact. No completed test means no progress.
        if (options.writeArtifacts !== false)
            await writeWatchArtifacts(cwd, base);
        return base;
    }
    base.suite = suite;
    const outcome = classifyWatchedSuite(suite);
    if (outcome === 'infrastructure-error') {
        base.status = 'infrastructure-error';
        base.infrastructureError = `${suite.infrastructureFailedCount} scenario(s) failed due to infrastructure`;
        // Retain prior state so the same candidate can be retried.
        if (options.writeArtifacts !== false)
            await writeWatchArtifacts(cwd, base);
        return base;
    }
    if (outcome === 'compatible') {
        base.status = 'compatible';
        await saveState(statePath, {
            version: 1,
            lastObserved: candidate,
            lastKnownGood: candidate,
            updatedAt: createdAt,
            lastResult: 'compatible',
        });
    }
    else {
        base.status = 'regression';
        const firstFailure = suite.scenarios.find((item) => !item.passed && item.result);
        if (firstFailure && compareExactVersions(state.lastKnownGood, candidate) < 0) {
            base.firstFailingScenario = firstFailure.path;
            const scenario = await loadScenario(path.resolve(cwd, firstFailure.path));
            const range = publishedVersionsBetween(published, state.lastKnownGood, candidate);
            if (range.length >= 2) {
                const bisect = await bisectReleases(scenario, range, {
                    cwd,
                    platform: options.platform,
                    onStatus: options.onStatus,
                });
                base.firstBadRelease = bisect.firstBadVersion;
            }
        }
        await saveState(statePath, {
            version: 1,
            lastObserved: candidate,
            lastKnownGood: state.lastKnownGood,
            updatedAt: createdAt,
            lastResult: 'regression',
            pendingVersion: candidate,
        });
    }
    if (options.writeArtifacts !== false)
        await writeWatchArtifacts(cwd, base);
    return base;
}
export { formatWatchMarkdown, readState as readWatchState };
//# sourceMappingURL=watch.js.map