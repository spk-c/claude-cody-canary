#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * Accepts a stable version optionally prefixed with 'v', but always returns
 * a canonical GitHub tag starting with 'v'. Never accepts arbitrary refs.
 */
export function normalizeReleaseTag(requested, packageVersion) {
  if (typeof requested !== 'string' || !/^(?:v)?\d+\.\d+\.\d+$/.test(requested)) {
    throw new Error('Version must be X.Y.Z or vX.Y.Z (for example 2.1.0 or v2.1.0).');
  }
  if (typeof packageVersion !== 'string' || !SEMVER.test(packageVersion)) {
    throw new Error('package.json must contain a stable X.Y.Z version.');
  }
  const tag = `v${requested.replace(/^v/, '')}`;
  if (tag !== `v${packageVersion}`) {
    throw new Error(`Release version mismatch: requested ${tag}, package.json v${packageVersion}.`);
  }
  return tag;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const tag = normalizeReleaseTag(process.argv[2], pkg.version);
    process.stdout.write(`tag=${tag}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
