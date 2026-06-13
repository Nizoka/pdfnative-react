import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'es2022',
    outDir: 'dist',
    // React, its reconciler, and the pdfnative engine are provided by the
    // consumer (peer/host) — never bundle them into the published artifact.
    external: ['react', 'react-dom', 'react-reconciler', 'pdfnative'],
});
