import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/DCSS_SV/',
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
