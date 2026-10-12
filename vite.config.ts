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
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
