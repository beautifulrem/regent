import { defineConfig } from 'vitest/config';

// Pure-logic unit tests only (no DOM): geometry/format helpers under src/lib.
// Visual/animation behaviour is verified via `next build` + manual browser demo.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
