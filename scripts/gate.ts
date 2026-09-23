#!/usr/bin/env tsx
/**
 * pdfnative-react — Quality gate (v1.3.0)
 * ========================================
 * The single definition of what "green" means. CI, the contributor docs and
 * the agent instructions all point here instead of each carrying its own
 * list of commands, so the list cannot drift between them. Ported from
 * pdfnative-mcp's scripts/gate.ts (1.7.0, itself from pdfnative-cli 1.5.0 and
 * pdfnative 1.8.0) with this package's own step table.
 *
 * Every step is an existing npm script, plus four inline checks on the BUILT
 * package — what `npm publish` ships, which source tests never see: that
 * `dist/` is complete (`dist-check`), that it carries what it must and
 * nothing it must not (`dist-probe`: the `'use client'` directive on the
 * client entry only, no `console.log`, no stray directory), that both entries
 * bundle for a browser the way Deno, Bun and Workers resolve them
 * (`bundle-smoke`), and that the tarball and its `exports` map resolve for ESM
 * and CJS consumers (`pack-check`: the file list, publint and
 * @arethetypeswrong/cli). The gate runs them in order, captures each one's full
 * output to `test-output/.gate/<id>.log`, and prints ONE line per step — a
 * passing run is under twenty lines, which is what makes it usable from an
 * agent loop where every line of output costs tokens. On the first failure
 * it prints the tail of that step's log and stops.
 *
 * The gate is hermetic: no step needs the network, and operator knobs
 * inherited from the shell are scrubbed (helpers/hermetic.ts), so its verdict
 * is the same on a laptop and on a runner. `npm audit` and the publish
 * workflow's consumer smoke test run OUTSIDE the gate on purpose.
 *
 * Usage:
 *   npm run gate                     # --ci: everything except validate:pdfa
 *   npm run gate:fast                # typecheck:all, lint, test, verify:docs
 *   npx tsx scripts/gate.ts --publish   # everything, including validate:pdfa
 *   npx tsx scripts/gate.ts --only lint
 *   npx tsx scripts/gate.ts --from build
 *   npx tsx scripts/gate.ts --ci --json
 *   npx tsx scripts/gate.ts --publish --require-all   # what publish.yml runs
 *
 * (PowerShell swallows a bare `--`, so call the script directly when passing
 * flags rather than `npm run gate -- --fast`; `npm run gate:fast` exists for
 * the common case.)
 *
 * Profiles:
 *   --fast     typecheck:all, lint, test, verify:docs
 *   --ci       every step except validate:pdfa (default)
 *   --publish  every step; validate:pdfa SKIPs with a reason when veraPDF is
 *              absent, like the script it wraps
 *
 * Flags:
 *   --require-all  a step that would SKIP fails instead, with
 *                  `required by --require-all: <reason>`. CI and the release
 *                  workflow pass it: a runner without veraPDF must go red,
 *                  never quietly skip a check.
 *
 * Exit codes:
 *   0 — every selected step passed or was skipped with a reason
 *   1 — a step failed (its log tail is printed; the full log is on disk),
 *       or a step would have skipped under --require-all
 *   2 — bad usage
 */

// Must be first: pins TZ and scrubs operator knobs before anything else loads.
import './helpers/hermetic.js';

import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { locateVeraPdf } from './lib/verapdf.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(REPO_ROOT, 'test-output', '.gate');
const VITEST_JSON = join(LOG_DIR, 'vitest.json');
const COVERAGE_SUMMARY = join(REPO_ROOT, 'coverage', 'coverage-summary.json');
const DIST = join(REPO_ROOT, 'dist');

export type Profile = 'fast' | 'ci' | 'publish';

export interface Step {
    readonly id: string;
    /** The npm script this step runs. Absent for the inline checks. */
    readonly npmScript?: string;
    readonly profiles: readonly Profile[];
    /** Returns a reason to skip the step, or null to run it. */
    readonly skipWhen?: () => string | null;
    /** Extra environment for the child process. */
    readonly env?: Readonly<Record<string, string>>;
    /** In-process check; returns the failure lines, empty when it passes. */
    readonly inline?: () => readonly string[] | Promise<readonly string[]>;
    /** A short figure to show next to PASS, read after the step succeeds. */
    readonly note?: () => string | null;
}

// ── Skip conditions ─────────────────────────────────────────────────

function veraPdfInstalled(): boolean {
    return locateVeraPdf() !== null;
}

// ── Notes (figures shown next to PASS) ──────────────────────────────

function testCount(): string | null {
    if (!existsSync(VITEST_JSON)) return null;
    // The whole suite, skipped tests included — the figure `declared.tests`
    // in docs/assets/ecosystem.json is held to it.
    const report = JSON.parse(readFileSync(VITEST_JSON, 'utf8')) as { numTotalTests?: number; numPassedTests?: number; numPendingTests?: number };
    const total = report.numTotalTests ?? report.numPassedTests;
    if (typeof total !== 'number') return null;
    // A skipped suite is visible in the summary line, never silent.
    const pending = report.numPendingTests ?? 0;
    return pending > 0 ? `${String(total)} tests, ${String(pending)} skipped` : `${String(total)} tests`;
}

function coverageFigure(): string | null {
    if (!existsSync(COVERAGE_SUMMARY)) return null;
    const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf8')) as {
        total?: { statements?: { pct?: number } };
    };
    const pct = summary.total?.statements?.pct;
    return typeof pct === 'number' ? `${pct.toFixed(1)}% stmts` : null;
}

function joinNotes(...parts: Array<string | null>): string | null {
    const kept = parts.filter((p): p is string => p !== null);
    return kept.length > 0 ? kept.join(', ') : null;
}

function walkFiles(dir: string, visit: (path: string) => void): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walkFiles(p, visit);
        else visit(p);
    }
}

function sampleCount(): string | null {
    const dir = join(REPO_ROOT, 'test-output', 'samples');
    if (!existsSync(dir)) return null;
    let n = 0;
    walkFiles(dir, (p) => { if (p.endsWith('.pdf')) n++; });
    return `${String(n)} samples`;
}

// ── Inline checks ───────────────────────────────────────────────────

/** Files `npm run build` must leave behind for the package to be complete — every target of the `exports` map. */
export const DIST_FILES = [
    'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts',
    'dist/client.js', 'dist/client.cjs', 'dist/client.d.ts', 'dist/client.d.cts',
] as const;

function distCheck(): readonly string[] {
    return DIST_FILES.filter((f) => !existsSync(join(REPO_ROOT, f))).map((f) => `missing: ${f}`);
}

/**
 * What the built tree must and must not carry. Pure, so
 * tests/tools/gate.test.ts can feed it hostile input.
 *
 * - `dist/client.{js,cjs}` open with the `'use client'` directive (a React
 *   Server Components app imports the preview components through that
 *   subpath); `dist/index.{js,cjs}` never carry it (the root is server-safe).
 * - No emitted JavaScript calls `console.log`: the library is pure and never
 *   writes to a consumer's stdout.
 * - The root bundles keep the `node:` prefix on the dynamic fs import (Deno
 *   and Cloudflare `nodejs_compat` refuse the bare form).
 * - Nothing under `dist/` but the eight artefacts and their source maps: a
 *   `tests/`, `samples/` or `scripts/` directory there is a tsup regression
 *   that would ship fixtures and tooling to npm.
 *
 * The first three restate `scripts/postbuild.mjs`'s own assertions on
 * purpose: the gate holds the artefact that ships, independently of the step
 * that repaired it.
 */
export function probeDist(files: ReadonlyArray<{ readonly path: string; readonly text: string }>): string[] {
    const failures: string[] = [];
    const allowed = new Set<string>([...DIST_FILES, ...DIST_FILES.map((f) => `${f}.map`)]);
    for (const { path, text } of files) {
        const rel = path.replace(/\\/g, '/').replace(/^.*?(?=dist\/)/, '');
        if (!allowed.has(rel)) {
            failures.push(`${rel}: not an artefact the exports map publishes — only the eight entry files and their source maps belong under dist/`);
            continue;
        }
        const isJs = rel.endsWith('.js') || rel.endsWith('.cjs');
        if (!isJs) continue;
        const directive = /^\s*(['"])use client\1\s*;?/.test(text);
        if (rel.startsWith('dist/client.') && !directive) failures.push(`${rel}: the 'use client' directive is missing — a React Server Components app cannot import the preview components`);
        if (rel.startsWith('dist/index.') && directive) failures.push(`${rel}: carries a 'use client' directive — the root bundle is server-safe and must never be marked as client code`);
        if (/\bconsole\.log\s*\(/.test(text)) failures.push(`${rel}: console.log() in emitted JavaScript — the library never writes to a consumer's stdout`);
        if (rel.startsWith('dist/index.') && text.includes("import('fs/promises')")) failures.push(`${rel}: the dynamic fs import lost its node: prefix — Deno and Cloudflare nodejs_compat refuse the bare form`);
    }
    return failures;
}

function distProbe(): readonly string[] {
    if (!existsSync(DIST)) return ['dist/ is missing (run build first)'];
    const files: Array<{ path: string; text: string }> = [];
    walkFiles(DIST, (p) => files.push({ path: relative(REPO_ROOT, p), text: /\.(c?js)$/.test(p) ? readFileSync(p, 'utf8') : '' }));
    return probeDist(files);
}

/**
 * `renderToResponse` advertises Deno, Bun, Edge and Cloudflare Workers. A
 * Node `require` cannot catch a specifier a non-Node bundler refuses to
 * resolve, so both entries are bundled the way those runtimes would — with
 * esbuild's API, in process, no network and no `npx`.
 */
async function bundleSmoke(): Promise<readonly string[]> {
    if (!existsSync(DIST)) return ['dist/ is missing (run build first)'];
    const esbuild = await import('esbuild');
    const failures: string[] = [];
    for (const entry of ['dist/index.js', 'dist/client.js']) {
        try {
            await esbuild.build({
                entryPoints: [join(REPO_ROOT, entry)],
                bundle: true,
                write: false,
                platform: 'browser',
                format: 'esm',
                logLevel: 'silent',
                external: ['react', 'react-dom', 'react-reconciler', 'pdfnative', 'node:fs/promises'],
            });
        } catch (err) {
            failures.push(`${entry}: browser/ESM bundle failed — ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
        }
    }
    return failures;
}

/** Files the tarball may carry besides `dist/**`. */
const PACKED_OUTSIDE_DIST = new Set(['llms.txt', 'LICENSE', 'README.md', 'package.json']);

/**
 * The tarball and its `exports` map, as a consumer resolves them:
 *   1. `npm pack --dry-run --json` — the file list is exactly dist/** plus the
 *      four files above (a stray PDF or a tests/ directory would ship);
 *   2. publint — the manifest and the artefacts agree (types beside every
 *      condition, no misplaced field);
 *   3. @arethetypeswrong/cli — the four entry points resolve for every module
 *      resolution mode without a false CJS/ESM type (this package is the one
 *      in the ecosystem shipping a dual ESM+CJS `exports` map with per-condition
 *      types, which neither the CLI binary nor the ESM-only MCP server can get
 *      wrong — hence a step the siblings do not need).
 */
function packCheck(): readonly string[] {
    const failures: string[] = [];
    const packDir = join(LOG_DIR, 'pack');
    rmSync(packDir, { recursive: true, force: true });
    mkdirSync(packDir, { recursive: true });

    const dry = runNpm(['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' });
    if (dry.status !== 0) return [`npm pack --dry-run failed (exit ${String(dry.status)}): ${String(dry.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`];
    let listed: string[] = [];
    try {
        // npm may print notices before the JSON; the payload is the last array.
        const text = String(dry.stdout ?? '');
        const parsed = JSON.parse(text.slice(text.indexOf('['))) as Array<{ files: Array<{ path: string }> }>;
        listed = (parsed[0]?.files ?? []).map((f) => f.path.replace(/\\/g, '/')).sort();
    } catch (err) {
        return [`npm pack --dry-run --json produced no parsable file list: ${err instanceof Error ? err.message : String(err)}`];
    }
    for (const f of listed) {
        if (f.startsWith('dist/')) continue;
        if (!PACKED_OUTSIDE_DIST.has(f)) failures.push(`tarball carries ${f} — only dist/** and ${[...PACKED_OUTSIDE_DIST].join(', ')} belong in it (package.json "files")`);
    }
    for (const f of [...DIST_FILES, ...PACKED_OUTSIDE_DIST]) {
        if (!listed.includes(f)) failures.push(`tarball lacks ${f}`);
    }
    if (failures.length > 0) return failures;

    const real = runNpm(['pack', '--ignore-scripts', '--pack-destination', packDir], { encoding: 'utf8' });
    if (real.status !== 0) return [`npm pack failed (exit ${String(real.status)}): ${String(real.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`];
    const tgz = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    if (tgz === undefined) return ['npm pack produced no .tgz'];
    const tarball = join(packDir, tgz);

    const publint = runBin('publint', ['run', tarball, '--strict']);
    if (publint.status !== 0) failures.push(`publint: ${tailOf(publint)}`);
    const attw = runBin('@arethetypeswrong/cli', [tarball, '--format', 'ascii', '--no-color', '--no-emoji']);
    if (attw.status !== 0) failures.push(`attw: ${tailOf(attw)}`);
    return failures;
}

function tailOf(r: { readonly stdout?: string | Buffer | null; readonly stderr?: string | Buffer | null }): string {
    const text = `${String(r.stdout ?? '')}\n${String(r.stderr ?? '')}`.replace(/\r\n/g, '\n').trim().split('\n');
    return text.slice(-8).join(' | ');
}

/** Run a devDependency's CLI through the current Node, from its `bin` field (no `.cmd` shim, no PATH). */
function runBin(pkg: string, args: readonly string[]): ReturnType<typeof spawnSync> {
    const dir = join(REPO_ROOT, 'node_modules', ...pkg.split('/'));
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { bin?: string | Record<string, string> };
    const bin = typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin ?? {})[0];
    if (bin === undefined) throw new Error(`${pkg} declares no bin`);
    return spawnSync(process.execPath, [join(dir, bin), ...args], {
        cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
}

// ── The gate ────────────────────────────────────────────────────────

// Order matters in the ci / publish profiles: `build` and `test:generate`
// run BEFORE `test:coverage`, because two suites need what they produce —
// tests/regression/reproducible-build (spawns dist/index.js) and
// tests/regression/samples (reads test-output/samples/). With the tests first
// those suites would skip silently on every CI runner; `GATE_REQUIRE_ARTIFACTS=1`
// makes them fail loudly when their input is missing. The fast profile keeps
// `test` first (no build).
export const STEPS: readonly Step[] = [
    { id: 'typecheck:all', npmScript: 'typecheck:all', profiles: ['fast', 'ci', 'publish'] },
    { id: 'lint', npmScript: 'lint', profiles: ['fast', 'ci', 'publish'] },
    {
        id: 'test', npmScript: 'test', profiles: ['fast'],
        env: { GATE: '1' }, note: testCount,
    },
    { id: 'build', npmScript: 'build', profiles: ['ci', 'publish'] },
    { id: 'dist-check', profiles: ['ci', 'publish'], inline: distCheck },
    { id: 'dist-probe', profiles: ['ci', 'publish'], inline: distProbe },
    { id: 'bundle-smoke', profiles: ['ci', 'publish'], inline: bundleSmoke },
    { id: 'pack-check', profiles: ['ci', 'publish'], inline: packCheck },
    { id: 'test:generate', npmScript: 'test:generate', profiles: ['ci', 'publish'], note: sampleCount },
    {
        id: 'test:coverage', npmScript: 'test:coverage', profiles: ['ci', 'publish'],
        env: { GATE: '1', GATE_REQUIRE_ARTIFACTS: '1' }, note: () => joinNotes(testCount(), coverageFigure()),
    },
    { id: 'verify:docs', npmScript: 'verify:docs', profiles: ['fast', 'ci', 'publish'] },
    { id: 'verify:samples', npmScript: 'verify:samples', profiles: ['ci', 'publish'] },
    { id: 'corpus:pdfa', npmScript: 'corpus:pdfa', profiles: ['ci', 'publish'] },
    { id: 'validate:pdfx', npmScript: 'validate:pdfx', profiles: ['ci', 'publish'] },
    {
        id: 'validate:pdfa', npmScript: 'validate:pdfa', profiles: ['publish'],
        skipWhen: () => (veraPdfInstalled() ? null : 'veraPDF not installed'),
    },
];

// ── Running a step ──────────────────────────────────────────────────

/**
 * Run the npm CLI. `npm_execpath` is set whenever this script itself was
 * started by npm, and running that CLI under the current node keeps the whole
 * gate on one toolchain; outside npm (a bare `tsx scripts/gate.ts`) fall back
 * to whatever `npm` is on PATH — through a shell, since on Windows that is an
 * `npm.cmd` shim which Node refuses to spawn directly.
 */
function runNpm(args: readonly string[], options: SpawnSyncOptions): ReturnType<typeof spawnSync> {
    const npmCli = process.env.npm_execpath;
    const common: SpawnSyncOptions = { cwd: REPO_ROOT, windowsHide: true, ...options };
    return npmCli && existsSync(npmCli)
        ? spawnSync(process.execPath, [npmCli, ...args], common)
        : spawnSync('npm', [...args], { ...common, shell: true });
}

/** Run an npm script with its stdout and stderr interleaved into one log file. */
function runNpmScript(script: string, logPath: string, extraEnv: Readonly<Record<string, string>>): number {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv, NO_COLOR: '1', FORCE_COLOR: '0' };
    const fd = openSync(logPath, 'w');
    try {
        const result = runNpm(['run', script], { env, stdio: ['ignore', fd, fd] });
        if (result.error) throw result.error;
        return result.status ?? 1;
    } finally {
        closeSync(fd);
    }
}

async function runInline(check: () => readonly string[] | Promise<readonly string[]>, logPath: string): Promise<number> {
    let failures: readonly string[];
    try {
        failures = await check();
    } catch (err) {
        failures = [`inline check threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`];
    }
    const fd = openSync(logPath, 'w');
    try {
        writeSync(fd, failures.length === 0 ? 'ok\n' : `${failures.join('\n')}\n`);
    } finally {
        closeSync(fd);
    }
    return failures.length === 0 ? 0 : 1;
}

function tail(file: string, lines: number): string[] {
    if (!existsSync(file)) return [];
    const all = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
    return all.slice(-lines);
}

// ── CLI ─────────────────────────────────────────────────────────────

export interface Options {
    readonly profile: Profile;
    readonly only: string | null;
    readonly from: string | null;
    readonly json: boolean;
    /** Turn every SKIP into a FAIL (CI and the release workflow). */
    readonly requireAll: boolean;
}

function usage(): string {
    return [
        'Usage: npx tsx scripts/gate.ts [--fast | --ci | --publish] [--only <id>] [--from <id>] [--require-all] [--json]',
        '',
        `Steps: ${STEPS.map((s) => s.id).join(', ')}`,
    ].join('\n');
}

export function parseArgs(argv: readonly string[]): Options | { error: string } {
    let profile: Profile | null = null;
    let only: string | null = null;
    let from: string | null = null;
    let json = false;
    let requireAll = false;
    const ids = new Set(STEPS.map((s) => s.id));

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--fast' || a === '--ci' || a === '--publish') {
            const p = a.slice(2) as Profile;
            if (profile !== null && profile !== p) return { error: `--${profile} and ${a} are mutually exclusive` };
            profile = p;
        } else if (a === '--only' || a === '--from') {
            const id = argv[i + 1];
            if (id === undefined || id.startsWith('--')) return { error: `${a} needs a step id` };
            if (!ids.has(id)) return { error: `unknown step "${id}"` };
            if (a === '--only') only = id; else from = id;
            i++;
        } else if (a === '--json') {
            json = true;
        } else if (a === '--require-all') {
            requireAll = true;
        } else {
            return { error: `unknown argument "${a}"` };
        }
    }
    return { profile: profile ?? 'ci', only, from, json, requireAll };
}

interface StepOutcome {
    readonly id: string;
    readonly status: 'pass' | 'fail' | 'skip';
    readonly seconds: number;
    readonly note: string | null;
}

export function selectSteps(opts: Options): readonly Step[] {
    if (opts.only !== null) return STEPS.filter((s) => s.id === opts.only);
    let selected = STEPS.filter((s) => s.profiles.includes(opts.profile));
    if (opts.from !== null) {
        const at = selected.findIndex((s) => s.id === opts.from);
        if (at < 0) {
            // The step exists but is not in this profile: run the profile
            // from the position it would occupy in the full table.
            const full = STEPS.findIndex((s) => s.id === opts.from);
            selected = selected.filter((s) => STEPS.indexOf(s) >= full);
        } else {
            selected = selected.slice(at);
        }
    }
    return selected;
}

async function main(): Promise<number> {
    const parsed = parseArgs(process.argv.slice(2));
    if ('error' in parsed) {
        process.stderr.write(`gate: ${parsed.error}\n${usage()}\n`);
        return 2;
    }
    const opts = parsed;
    const steps = selectSteps(opts);
    const width = Math.max(...STEPS.map((s) => s.id.length));
    const say = (line: string): void => { if (!opts.json) process.stdout.write(`${line}\n`); };

    mkdirSync(LOG_DIR, { recursive: true });
    const outcomes: StepOutcome[] = [];
    const startedAt = Date.now();
    say(`gate --${opts.profile}: ${String(steps.length)} step(s)`);

    let failedAt: string | null = null;
    for (const step of steps) {
        const reason = step.skipWhen?.() ?? null;
        if (reason !== null) {
            if (opts.requireAll) {
                const note = `required by --require-all: ${reason}`;
                outcomes.push({ id: step.id, status: 'fail', seconds: 0, note });
                say(`FAIL  ${step.id.padEnd(width)}          ${note}`);
                failedAt = step.id;
                break;
            }
            outcomes.push({ id: step.id, status: 'skip', seconds: 0, note: reason });
            say(`SKIP  ${step.id.padEnd(width)}          (${reason})`);
            continue;
        }

        const logPath = join(LOG_DIR, `${step.id.replace(/[^a-z0-9-]/gi, '-')}.log`);
        // A stale report from an earlier run must never be reported as this run's.
        if (step.env?.GATE === '1') rmSync(VITEST_JSON, { force: true });
        if (step.id === 'test:coverage') rmSync(COVERAGE_SUMMARY, { force: true });

        const t0 = Date.now();
        const status = step.inline
            ? await runInline(step.inline, logPath)
            : runNpmScript(step.npmScript ?? step.id, logPath, step.env ?? {});
        const seconds = (Date.now() - t0) / 1000;
        const clock = `${seconds.toFixed(1)}s`.padStart(7);

        if (status === 0) {
            const note = step.note?.() ?? null;
            outcomes.push({ id: step.id, status: 'pass', seconds, note });
            say(`PASS  ${step.id.padEnd(width)}  ${clock}${note ? `  ${note}` : ''}`);
            continue;
        }

        const rel = relative(REPO_ROOT, logPath).replace(/\\/g, '/');
        outcomes.push({ id: step.id, status: 'fail', seconds, note: `exit ${String(status)}; log: ${rel}` });
        say(`FAIL  ${step.id.padEnd(width)}  ${clock}  exit ${String(status)}`);
        for (const line of tail(logPath, 12)) say(`      ${line}`);
        say(`      (full log: ${rel})`);
        failedAt = step.id;
        break;
    }

    const total = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (opts.json) {
        process.stdout.write(`${JSON.stringify({ ok: failedAt === null, profile: opts.profile, steps: outcomes }, null, 2)}\n`);
    } else if (failedAt !== null) {
        process.stdout.write(`gate: failed at ${failedAt}\n`);
    } else {
        const passed = outcomes.filter((o) => o.status === 'pass').length;
        const skipped = outcomes.filter((o) => o.status === 'skip').length;
        process.stdout.write(`gate: ${String(passed)} passed, ${String(skipped)} skipped in ${total} s\n`);
    }
    return failedAt === null ? 0 : 1;
}

// Only run when executed directly, so tests can import STEPS/parseArgs/selectSteps.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(await main());
}
