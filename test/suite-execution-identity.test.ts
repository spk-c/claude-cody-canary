import { describe, expect, it } from 'vitest';
import { combineSuiteResults, type SuiteRunResult } from '../src/suite.js';
const sample = (id?: string, shard='1/2'): SuiteRunResult => ({
  schemaVersion: 1, suite:'s', suitePath:'.canary/s.yml', createdAt:'2026-01-01T00:00:00Z',
  passed:true,total:1,discoveredTotal:2,passedCount:1,failedCount:0,infrastructureFailedCount:0,
  cacheHitCount:0,executionIdentity:id,skippedBySelection:1,skipped:[{path:'elsewhere',reason:'shard'}],
  shard,scenarios:[{path:'test-'+shard,passed:true}],failureClusters:[],
});
describe('suite merge source identity',()=>{
  it('rejects mismatched or partially missing SHA-256 identities',()=>{
    expect(()=>combineSuiteResults([sample('a'.repeat(64)),sample('b'.repeat(64),'2/2')])).toThrow(/identit/);
    expect(()=>combineSuiteResults([sample('a'.repeat(64)),sample(undefined,'2/2')])).toThrow(/identit/);
  });
  it('preserves one identical shard execution identity',()=>{
    expect(combineSuiteResults([sample('a'.repeat(64)),sample('a'.repeat(64),'2/2')]).executionIdentity).toBe('a'.repeat(64));
  });
});
