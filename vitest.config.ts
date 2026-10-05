import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

function resolveAlias(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      '@infra': resolveAlias('./src/infra'),
      '@modules': resolveAlias('./src/modules'),
      '@shared': resolveAlias('./src/shared'),
      '@config': resolveAlias('./src/config'),
      '@constants': resolveAlias('./src/constants'),
      '@providers': resolveAlias('./src/providers'),
      '@test': resolveAlias('./src/test'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/**', 'src/types/**'],
    },
  },
});
