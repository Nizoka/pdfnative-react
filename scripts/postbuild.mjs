/**
 * pdfnative-react — post-build artifact repair and verification
 * =============================================================
 * tsup 8 runs a rollup pass over the bundled output. That pass does two things
 * we need undone, and neither can be prevented from the tsup config — `platform`,
 * `target`, `external` and `banner` were each measured and none survive it:
 *
 *   1. It rewrites `node:fs/promises` to the bare `fs/promises`. Deno and
 *      Cloudflare `nodejs_compat` refuse to resolve the unprefixed form, so a
 *      wrangler or Vite-browser build of a package that advertises those
 *      runtimes fails to compile.
 *   2. It strips module-level directives, so the `'use client'` marker never
 *      reaches `dist/client.*` and a React Server Components app cannot import
 *      the preview components without a hand-written wrapper.
 *
 * This script restores both, then verifies the whole artifact set. It is strict
 * on purpose: if an expected pattern is missing — because tsup changed
 * behaviour, or because someone removed the code it patches — the build
 * **fails** rather than silently shipping a broken package.
 *
 * Usage:  node scripts/postbuild.mjs        (wired into `npm run build`)
 * Exit:   0 all good · 1 a check failed
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');

/** Root-bundle artifacts: must keep the `node:` prefix, must NOT be client. */
const ROOT = ['index.js', 'index.cjs'];
/** Client-entry artifacts: must carry the `'use client'` directive. */
const CLIENT = ['client.js', 'client.cjs'];
/** Everything the `exports` map points at. */
const REQUIRED = [...ROOT, ...CLIENT, 'index.d.ts', 'index.d.cts', 'client.d.ts', 'client.d.cts'];

const errors = [];
const actions = [];

function read(file) {
    return readFileSync(join(DIST, file), 'utf8');
}

function write(file, content) {
    writeFileSync(join(DIST, file), content, 'utf8');
}

// ── 0. Every artifact the exports map promises must exist ────────────────────

for (const file of REQUIRED) {
    if (!existsSync(join(DIST, file))) errors.push(`Missing artifact: dist/${file}`);
}
if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
}

// ── 1. Restore the node: prefix on the root bundles ──────────────────────────

for (const file of ROOT) {
    const before = read(file);

    if (before.includes("import('node:fs/promises')")) {
        // Already correct — tsup behaviour may have changed. Nothing to do.
        continue;
    }

    if (!before.includes("import('fs/promises')")) {
        errors.push(
            `dist/${file}: found neither 'node:fs/promises' nor 'fs/promises'. ` +
                'The dynamic import in src/render.ts may have been removed or renamed — ' +
                'update this script deliberately rather than deleting the check.',
        );
        continue;
    }

    const after = before.replaceAll("import('fs/promises')", "import('node:fs/promises')");
    write(file, after);
    actions.push(`dist/${file}: restored the node: prefix on fs/promises`);
}

// ── 2. Restore the 'use client' directive on the client bundles ──────────────

for (const file of CLIENT) {
    const before = read(file);

    if (/^\s*(['"])use client\1\s*;?/.test(before)) continue;

    // The directive must be the very first statement, ahead of 'use strict'.
    write(file, `'use client';\n${before}`);
    actions.push(`dist/${file}: restored the 'use client' directive`);
}

// ── 3. Verify the final shape ────────────────────────────────────────────────

for (const file of ROOT) {
    const content = read(file);
    if (!content.includes("import('node:fs/promises')")) {
        errors.push(`dist/${file}: the node: prefix is still missing after repair.`);
    }
    if (/^\s*(['"])use client\1/.test(content)) {
        errors.push(
            `dist/${file}: carries a 'use client' directive. The root bundle is server-safe ` +
                'and must never be marked as client code.',
        );
    }
}

for (const file of CLIENT) {
    if (!/^\s*(['"])use client\1\s*;?/.test(read(file))) {
        errors.push(`dist/${file}: the 'use client' directive is missing after repair.`);
    }
}

// ── 4. Tree-shaking: importing pure data must not drag in the reconciler ─────
//
// `import { version }` — or `validateSpec`, `schema`, `capabilityManifest`, none
// of which touch React — used to pull the whole React reconciler into a
// consumer's bundle, because a handful of top-level calls were side effects a
// bundler could not prove away. They are now `/* @__PURE__ */`-annotated. This
// check fails the build if any of them loses its annotation.

async function checkTreeShaking() {
    let esbuild;
    try {
        esbuild = await import('esbuild');
    } catch {
        // Fail closed. esbuild is a transitive dependency of tsup, so if it is
        // gone something is wrong with the tree — and a guard that quietly stops
        // guarding is worse than no guard, because the build still reports
        // success. Set POSTBUILD_SKIP_SHAKE_CHECK=1 to opt out deliberately.
        if (process.env['POSTBUILD_SKIP_SHAKE_CHECK'] === '1') {
            console.warn('postbuild: tree-shaking check skipped by POSTBUILD_SKIP_SHAKE_CHECK.');
            return;
        }
        errors.push(
            'esbuild is unavailable, so the tree-shaking check could not run. It is a '
                + 'transitive dependency of tsup — reinstall, or set '
                + 'POSTBUILD_SKIP_SHAKE_CHECK=1 to skip this check on purpose.',
        );
        return;
    }

    const result = await esbuild.build({
        stdin: {
            contents: "import { version } from './dist/index.js';\nglobalThis.x = version;\n",
            resolveDir: process.cwd(),
            sourcefile: 'shake-probe.mjs',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        minify: true,
        external: ['react', 'react-dom', 'react-reconciler', 'pdfnative', 'node:fs/promises'],
        logLevel: 'silent',
    });

    const code = result.outputFiles[0].text;
    const bytes = Buffer.byteLength(code);

    if (/ReactReconciler|HostTransitionContext/.test(code)) {
        errors.push(
            'Tree-shaking regression: importing `version` alone still pulls in the React ' +
                'reconciler. A `/* @__PURE__ */` annotation was probably lost — check ' +
                'src/reconciler/host-config.ts (`reconciler`, `HostTransitionContext`, ' +
                '`HOST_CONTEXT`) and src/registry.ts (`LINT_RULE_CODES`).',
        );
        return;
    }

    // Generous ceiling: the point is to catch a *regression*, not to police bytes.
    const CEILING = 6_000;
    if (bytes > CEILING) {
        errors.push(
            `Tree-shaking regression: a \`version\`-only bundle is ${String(bytes)} bytes ` +
                `(ceiling ${String(CEILING)}). Something with a top-level side effect became reachable.`,
        );
        return;
    }

    console.log(
        `postbuild: tree-shaking ok — \`version\`-only bundle is ${String(bytes)} bytes, no reconciler.`,
    );
}

await checkTreeShaking();

// ── Report ───────────────────────────────────────────────────────────────────

for (const a of actions) console.log(`postbuild: ${a}`);

if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error('postbuild: artifact verification FAILED — do not publish this build.');
    process.exit(1);
}

console.log(`postbuild: ${String(REQUIRED.length)} artifacts verified.`);
