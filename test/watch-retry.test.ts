import { describe, expect, it } from 'vitest';
import { classifyWatchedSuite, versionsRequiringWatch } from '../src/watch.js';
import { exitCodeForWatch, CanaryExitCode } from '../src/exit-codes.js';

describe('release watch retry safety', () => {
  const versions = ['2.1.220', '2.1.221', '2.1.222'];
  it('retries pending known-bad candidate even without a newer release', () => {
    expect(versionsRequiringWatch(versions, '2.1.222', '2.1.222')).toEqual(['2.1.222']);
  });
  it('prioritizes the latest unseen version without duplicating candidates', () => {
    expect(versionsRequiringWatch(versions, '2.1.220', '2.1.221')).toEqual(['2.1.221', '2.1.222']);
  });
  it('does not retry nonexistent releases or already verified versions', () => {
    expect(versionsRequiringWatch(versions, '2.1.222', '2.1.999')).toEqual([]);
    expect(versionsRequiringWatch(versions, '2.1.222')).toEqual([]);
  });
  it('only calls a fully passing suite compatible', () => {
    expect(classifyWatchedSuite({ passed: true, infrastructureFailedCount: 0, total: 3, passedCount: 3 })).toBe('compatible');
    expect(classifyWatchedSuite({ passed: false, infrastructureFailedCount: 0, total: 3, passedCount: 2 })).toBe('regression');
    expect(classifyWatchedSuite({ passed: true, infrastructureFailedCount: 0, total: 3, passedCount: 2 })).toBe('regression');
  });
  it('preserves infrastructure classification and exit code', () => {
    expect(classifyWatchedSuite({ passed: false, infrastructureFailedCount: 1, total: 3, passedCount: 2 })).toBe('infrastructure-error');
    expect(classifyWatchedSuite({ passed: false, infrastructureFailedCount: 0, total: 0, passedCount: 0 })).toBe('infrastructure-error');
    expect(exitCodeForWatch('infrastructure-error')).toBe(CanaryExitCode.infrastructure);
  });
});
