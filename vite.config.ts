import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/DCSS_SV/',
  // The DCSS tile library is thousands of files the page never loads; watching them slows the dev server.
  server: { watch: { ignored: ['**/assets/dcss/**'] } },
  build: {
    rollupOptions: {
      // The game, the spell practice room for watching every spell's effect, and the branch gallery.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        spells: fileURLToPath(new URL('./spells.html', import.meta.url)),
        branches: fileURLToPath(new URL('./branches.html', import.meta.url)),
      },
      // three.js is most of the code and changes far less often than the game: it gets its own cached file.
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
