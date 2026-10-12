import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/DCSS_SV/',
  build: {
    rollupOptions: {
      // The game, and the spell practice room for watching every spell's effect.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        spells: fileURLToPath(new URL('./spells.html', import.meta.url)),
      },
      // three.js is most of the code and changes far less often than the game: it gets its own cached file.
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
