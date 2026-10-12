import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/DCSS_SV/',
  // three.js is most of the code and changes far less often than the game: it gets its own cached file.
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } }, chunkSizeWarningLimit: 700 },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
