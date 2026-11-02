import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    // Keep GitHub-hosted Windows runners from oversubscribing dozens of workers.
    maxWorkers: 4,
    testTimeout: 15_000,
  },
});
