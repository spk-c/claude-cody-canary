import { describe, expect, it } from 'vitest';
import { spawnCapture } from '../src/process.js';

describe('process capture', () => {
  it('bounds captured output and marks truncation', async () => {
    const result = await spawnCapture(
      process.execPath,
      ['-e', 'process.stdout.write("x".repeat(10000))'],
      { cwd: process.cwd(), timeoutMs: 10_000, maxOutputChars: 1024 },
    );

    expect(result.outputTruncated).toBe(true);
    expect(result.stdout.length + result.stderr.length).toBeLessThanOrEqual(1024);
  });

  it('rejects invalid output limits before spawning', async () => {
    await expect(spawnCapture(process.execPath, ['--version'], {
      cwd: process.cwd(),
      maxOutputChars: 0,
    })).rejects.toThrow(/positive integer/i);
  });

  it('reports a missing executable instead of throwing or hanging', async () => {
    const result = await spawnCapture(
      'claude-canary-executable-that-does-not-exist-34719',
      [],
      { cwd: process.cwd(), timeoutMs: 2000 },
    );
    expect(result.code).toBe(127);
    expect(result.timedOut).toBe(false);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('terminates a long-running process when its deadline is reached', async () => {
    const result = await spawnCapture(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { cwd: process.cwd(), timeoutMs: 150 },
    );
    expect(result.timedOut).toBe(true);
    expect(result.code).not.toBe(0);
  });

  it('passes arguments without a shell, even with spaces and shell metacharacters', async () => {
    const literal = 'value with spaces & | ; < > % and "quotes"';
    const result = await spawnCapture(
      process.execPath,
      ['-e', 'process.stdout.write(process.argv[1])', literal],
      { cwd: process.cwd(), timeoutMs: 5000 },
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(literal);
    expect(result.outputTruncated).toBe(false);
  });

  it('preserves separate stdout and stderr with a common combined limit', async () => {
    const result = await spawnCapture(
      process.execPath,
      ['-e', 'process.stdout.write("out");process.stderr.write("err")'],
      { cwd: process.cwd(), timeoutMs: 5000, maxOutputChars: 6 },
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
    expect(result.outputTruncated).toBe(false);
  });

});
