import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Exclude integration tests by default (they need Docker environment)
    // Set VITEST_INCLUDE_INTEGRATION=1 to run them
    exclude: process.env.VITEST_INCLUDE_INTEGRATION ? [] : ['tests/integration/**'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/cli.ts'],
    },
  },
});
