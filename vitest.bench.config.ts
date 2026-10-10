import { defineConfig } from 'vitest/config';

// `npm run bench`: bots play many runs and print how they fared. Kept out of `npm test`.
export default defineConfig({
  test: { include: ['tests/bench/**/*.test.ts'], environment: 'node' },
});
