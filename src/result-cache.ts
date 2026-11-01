import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Scenario } from './config.js';
import { findExecutable } from './doctor.js';
import { getRepoRoot, resolveCommit } from './git.js';
import { runScenario, type RunOptions } from './runner.js';
import type { RunResult } from './types.js';
import { CANARY_VERSION } from './version.js';

export interface ResultCacheIdentity {
  schemaVersion: 2;
  runtimeConfigHash: string;
  scenarioHash: string;
  gitCommit: string;
  executableSha256: string;
  canaryVersion: string;
  platform: string;
  arch: string;
  nodeMajor: string;
  featureFlagsHash: string;
}

export interface CachedRunEnvelope {
  schemaVersion: 2;
  key: string;
  identity: ResultCacheIdentity;
  createdAt: string;
  result: RunResult;
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Short-lived, per-suite content hash memo; file metadata is checked before every reuse. */
export type CacheDigestMemo = Map<string, { signature: string; digest: string }>;

function fileSignature(info: Awaited<ReturnType<typeof stat>>): string {
  // bigint stat has nanosecond timestamps even on Windows/Node 20.
  return [info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs].join(':');
}

/**
 * Validates a cached file digest against the live inode, size and timestamps.
 * A change while hashing fails closed rather than caching an unstable digest.
 */
export async function sha256FileMemoized(file: string, memo?: CacheDigestMemo): Promise<string> {
  if (!memo) return sha256File(file);
  const location = path.resolve(file);
  const before = await stat(location);
  const signature = fileSignature(before);
  const previous = memo.get(location);
  if (previous?.signature === signature) return previous.digest;
  const digest = await sha256File(location);
  const after = await stat(location);
  if (fileSignature(after) !== signature) {
    memo.delete(location);
    throw new Error('Cached digest source changed during hashing; retry with stable inputs.');
  }
  memo.set(location, { signature, digest });
  return digest;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

async function runtimeConfigFingerprint(repoRoot: string, memo?: CacheDigestMemo): Promise<string> {
  const files = [
    'CLAUDE.md', 'CLAUDE.local.md', '.mcp.json',
    '.claude/settings.json', '.claude/settings.local.json', '.claude/CLAUDE.md',
  ].map((file) => path.join(repoRoot, file));
  files.push(path.join(homedir(), '.claude.json'), path.join(homedir(), '.claude', 'settings.json'));
  const digest = createHash('sha256');
  for (const file of files.sort()) {
    digest.update(file);
    try { digest.update(await sha256FileMemoized(file, memo)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') digest.update('<missing>');
      else throw error;
    }
  }
  for (const [key, value] of Object.entries(process.env)
    .filter(([key]) => /^(ANTHROPIC_|CLAUDE_|MCP_|OPENAI_|AWS_|GOOGLE_|VERTEX_)/.test(key))
    .sort(([a], [b]) => a.localeCompare(b))) digest.update(JSON.stringify([key, value]));
  return digest.digest('hex');
}
export async function buildResultCacheIdentity(options: {
  cwd: string;
  scenarioSource: string;
  executable: string;
  gitRef?: string;
  featureFlags?: unknown;
  hashMemo?: CacheDigestMemo;
}): Promise<ResultCacheIdentity> {
  const cwd = path.resolve(options.cwd);
  const repoRoot = await getRepoRoot(cwd);
  const gitCommit = await resolveCommit(repoRoot, options.gitRef ?? 'HEAD');
  const executable = await findExecutable(options.executable, cwd);
  if (!executable) throw new Error(`Result reuse requires a resolvable executable so it can be fingerprinted: ${options.executable}`);
  const nodeMajor = process.versions.node.split('.')[0];
  return {
    schemaVersion: 2,
    runtimeConfigHash: await runtimeConfigFingerprint(repoRoot, options.hashMemo),
    scenarioHash: createHash('sha256').update(options.scenarioSource).digest('hex'),
    gitCommit,
    executableSha256: await sha256FileMemoized(executable, options.hashMemo),
    canaryVersion: CANARY_VERSION,
    platform: process.platform,
    arch: process.arch,
    nodeMajor,
    featureFlagsHash: sha256Json(options.featureFlags ?? {}),
  };
}

export function resultCacheKey(identity: ResultCacheIdentity): string {
  return sha256Json(identity);
}

function cacheFile(cacheRoot: string, key: string): string {
  return path.join(cacheRoot, `${key}.json`);
}

export async function readCachedRun(cacheRoot: string, identity: ResultCacheIdentity): Promise<RunResult | undefined> {
  const key = resultCacheKey(identity);
  let raw: string;
  try { raw = await readFile(cacheFile(cacheRoot, key), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined;
    throw error;
  }
  let envelope: CachedRunEnvelope;
  try { envelope = JSON.parse(raw) as CachedRunEnvelope; }
  catch { return undefined; }
  if (envelope.schemaVersion !== 2 || envelope.key !== key) return undefined;
  if (sha256Json(envelope.identity) !== sha256Json(identity)) return undefined;
  if (!envelope.result || envelope.result.schemaVersion !== 1 || envelope.result.gitCommit !== identity.gitCommit ||
    envelope.result.passed !== true || !Array.isArray(envelope.result.failures) || envelope.result.failures.length !== 0) return undefined;
  return { ...envelope.result, artifactPath: undefined };
}

export async function writeCachedRun(cacheRoot: string, identity: ResultCacheIdentity, result: RunResult): Promise<string> {
  const key = resultCacheKey(identity);
  await mkdir(cacheRoot, { recursive: true });
  const file = cacheFile(cacheRoot, key);
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const envelope: CachedRunEnvelope = { schemaVersion: 2, key, identity, createdAt: new Date().toISOString(), result: { ...result, artifactPath: undefined } };
  await writeFile(temporary, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
  return file;
}

export async function runScenarioWithCache(
  scenario: Scenario,
  scenarioPath: string,
  options: RunOptions & { cacheRoot?: string; featureFlags?: unknown; hashMemo?: CacheDigestMemo } = {},
): Promise<{ result: RunResult; cacheHit: boolean; cacheKey: string }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const source = await readFile(path.resolve(cwd, scenarioPath), 'utf8');
  const executable = options.executableOverride ?? scenario.claude.executable;
  const providerFlags = Object.fromEntries([
    'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_MANTLE',
  ].map((key) => [key, process.env[key] ?? null]));
  const identity = await buildResultCacheIdentity({
    cwd,
    scenarioSource: source,
    executable,
    gitRef: options.gitRefOverride,
    hashMemo: options.hashMemo,
    featureFlags: { scenario: { model: scenario.claude.model, permissionMode: scenario.claude.permission_mode, args: scenario.claude.args, env: scenario.claude.env }, providerFlags, extra: options.featureFlags },
  });
  const cacheRoot = path.resolve(cwd, options.cacheRoot ?? '.canary/cache/results');
  const key = resultCacheKey(identity);
  const cached = await readCachedRun(cacheRoot, identity);
  if (cached) return { result: cached, cacheHit: true, cacheKey: key };
  const result = await runScenario(scenario, options);
  if (result.passed) await writeCachedRun(cacheRoot, identity, result);
  return { result, cacheHit: false, cacheKey: key };
}
