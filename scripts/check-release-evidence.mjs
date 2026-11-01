#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FULL_E2E_RUN_NAME = 'Live Claude E2E (full)';
export function findVerifiedFullE2E(response, expectedSha) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')) return null;
  if (!response || !Array.isArray(response.workflow_runs)) return null;
  return response.workflow_runs.find((run) =>
    run?.event === 'workflow_dispatch' &&
    run?.status === 'completed' &&
    run?.conclusion === 'success' &&
    run?.head_sha === expectedSha &&
    run?.head_branch === 'main' &&
    run?.display_title === FULL_E2E_RUN_NAME) ?? null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sha = process.argv[2];
  const file = process.argv[3];
  if (!sha || !file) throw new Error('Usage: node scripts/check-release-evidence.mjs <commit-sha> <github-workflow-runs.json>');
  const json = JSON.parse(await readFile(file, 'utf8'));
  const match = findVerifiedFullE2E(json, sha);
  if (!match) {
    console.error('Release blocked: no successful authenticated full E2E run on exact commit ' + sha);
    process.exitCode = 1;
  } else {
    console.log('Verified full model-backed E2E on release commit: ' + match.html_url);
  }
}
