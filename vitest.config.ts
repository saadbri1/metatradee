import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    /*
     * HEADROOM FOR THE HEAVY COMPONENT SUITES, not a licence to be slow.
     *
     * The chart and dashboard workspaces are full-surface integration renders
     * driven through `userEvent`. Measured alone, the slowest is a little under
     * two seconds — comfortably inside the 5s default. Run in parallel with the
     * rest of the suite they slow by roughly three to five times, and the
     * heaviest of them crossed 5s intermittently. That produced failures that
     * moved from file to file between runs and vanished on re-run in isolation:
     * a machine-load artefact, not a defect, and the least useful kind of red.
     *
     * 15s keeps a genuinely hung test failing fast while removing the false
     * positives. It is deliberately not larger: if a test needs more than this,
     * that is a signal about the test rather than a number to raise again.
     */
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.config.*', '**/*.d.ts', 'tests/**', '.next/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // See tests/stubs/server-only.ts for why this is safe.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
