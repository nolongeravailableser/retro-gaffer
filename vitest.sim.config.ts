import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Config for the balance harness (slow Monte-Carlo sim), kept out of `npm test`.
// Run with: npm run sim
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.sim.ts'],
  },
});
