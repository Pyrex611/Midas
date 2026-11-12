import { defineConfig } from 'tsup';

export default defineConfig([
  // 1. Core Isomorphic SDK (Universal Node / Browser / Edge)
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    minify: true,
    target: 'es2022',
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.cjs',
      };
    },
  },
  // 2. React Hooks & First-Party Component Wrapper (Next.js Client Compatible)
  {
    entry: ['src/react.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: false,
    minify: true,
    target: 'es2022',
    banner: {
      js: "'use client';",
    },
    external: ['react'],
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.cjs',
      };
    },
  },
]);