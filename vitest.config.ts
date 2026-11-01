import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
});
