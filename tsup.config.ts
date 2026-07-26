import { defineConfig } from 'tsup';

/** Shared build settings. */
const shared = {
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    treeshake: true,
    minify: false,
    target: 'es2022',
    outDir: 'dist',
    external: [
        // React, its reconciler, and the pdfnative engine are provided by the
        // consumer (peer/host) — never bundle them into the published artifact.
        'react',
        'react-dom',
        'react-reconciler',
        'pdfnative',
        // `renderToFile` dynamically imports `node:fs/promises`. Marking it
        // external is necessary but *not* sufficient — see the note below and
        // `scripts/postbuild.mjs`.
        'node:fs/promises',
    ],
} as const;

/**
 * Two builds rather than one, because the `'use client'` directive must land on
 * the client entry **only**. Putting it on the root bundle would mark the whole
 * package as client code and break every server usage.
 *
 * They are separate builds, so each is self-contained; `clean` runs once, on
 * the first, or the second would delete the first's output.
 *
 * **Why there is a post-build step.** tsup 8 runs a rollup pass over the bundled
 * output. That pass strips module-level directives (it warns
 * *"Module level directives cause errors when bundled"*) and rewrites
 * `node:`-prefixed specifiers to their bare form — regardless of `platform`,
 * `target`, `external` or `banner`. All four were measured and none survive it.
 * `scripts/postbuild.mjs` restores both and **fails the build** if the expected
 * shape is not found. The artifact is what ships, so the artifact is what we
 * assert.
 */
export default defineConfig([
    {
        ...shared,
        entry: { index: 'src/index.ts' },
        clean: true,
        splitting: false,
    },
    {
        ...shared,
        entry: { client: 'src/client.ts' },
        clean: false,
        splitting: false,
    },
]);
