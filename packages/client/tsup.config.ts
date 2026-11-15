import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/react.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: false,
    external: ['react'],
    treeshake: true,
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    dts: false,
    clean: false,
    sourcemap: false,
    platform: 'node',
    target: 'node18',
    external: ['readline', 'fs/promises', 'path', 'process'],
  },
]);