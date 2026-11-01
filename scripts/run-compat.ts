#!/usr/bin/env tsx
/**
 * pdfnative-react — compat-previous: the previous release's own test suite,
 * run against the current sources (v1.4.0)
 * ==================================================================
 * The zero-breaking-change policy (SECURITY.md §Compatibility promise) is
 * proven mechanically in two halves: `tests/api-surface.test.ts`,
 * `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and
 * `npm run typecheck:compat` check that every export, DocSpec field, lint rule
 * and type of the frozen 1.2.0 and 1.3.0 captures still exists with the same shape, and
 * THIS script checks that the previous release's behaviour still holds — by
 * running its test suite, exactly as it was tagged, against today's `src/`.
 *
 * What it does:
 *   1. `git archive <tag> tests vitest.config.ts tsconfig.json
 *      tsconfig.test.json` into `test-output/.compat/<version>/` (git-ignored;
 *      a dot-directory, which the sample walkers skip, removed again when the
 *      run ends unless `--keep`);
 *   2. copies the current `src/`, `scripts/`, `samples/`, `.github/`,
 *      `package.json` and `tsconfig.scripts.json` (which `scripts/tsconfig.json`
 *      extends) next to it, so the archived tests' relative imports
 *      (`../src/…`, `../../scripts/…`) and the suites that read `samples/` or
 *      the governance contract resolve to the sources under test;
 *   3. runs vitest in that directory with the archived configuration (no
 *      coverage), minus the allow-list `tests/regression/compat/allow-<tag>.json`:
 *      a whole file (`pattern`), or only the named tests of a file (`tests`),
 *      each with a reason and, for a behaviour change, the compatibility-ledger
 *      entry (C1…Cn in the release note) that justifies it.
 *
 * Exit code: vitest's (0 green, 1 red), 2 on usage or git failure — among
 * them a tag that is not available locally, named with the fetch command,
 * so that the gate's `--require-all` reports the cause rather than an opaque
 * failure. The run is never skipped silently.
 *
 * Usage:
 *   npx tsx scripts/run-compat.ts                 # tag from tests/regression/compat/allow-*.json
 *   npx tsx scripts/run-compat.ts --tag v1.3.0
 *   npx tsx scripts/run-compat.ts --list          # print the exclusions and exit
 *   npx tsx scripts/run-compat.ts --keep          # leave test-output/.compat/<version> behind for inspection
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The canonical path, drive-letter case included: on Windows a cwd of `d:…`
// and a vitest resolved under `D:…` are two module URLs, and the archived
// setup file's `vitest` import then lands in a second instance of the runner
// ("Vitest failed to find the current suite").
const ROOT = realpathSync.native(resolve(import.meta.dirname, '..'));

/** Where the allow-lists live, relative to the repository root. */
export const COMPAT_DIR = join('tests', 'regression', 'compat');
/** What `git archive` takes from the tag: the suite, its configuration and the tsconfigs it extends. */
export const ARCHIVED_PATHS = ['tests', 'vitest.config.ts', 'tsconfig.json', 'tsconfig.test.json'] as const;
/** The current trees the archived suite imports or reads, besides its own files (`.github` for the governance contract). */
export const CURRENT_TREES = ['src', 'scripts', 'samples', '.github'] as const;
/** Root files the archived suite reads (the version, the exports map, the scripts table) and the tsconfig scripts/tsconfig.json extends. */
export const CURRENT_FILES = ['package.json', 'tsconfig.scripts.json'] as const;

export interface CompatExclusion {
    /** A vitest include-style glob, relative to the archived tree (e.g. `tests/tools/**`). */
    readonly pattern: string;
    /**
     * Without it the whole file is excluded. With it the file RUNS and only the
     * tests whose full name contains one of these fragments are deselected
     * (`-t` with a negative look-ahead), so one changed assertion does not
     * silence the rest of a suite.
     */
    readonly tests?: readonly string[];
    /** Why this file (or these tests) of the previous suite cannot run against the current sources. */
    readonly reason: string;
    /** The release note's compatibility-ledger entries (`C1`, or `C1, C7`) when the reason is a behaviour change. */
    readonly ledger?: string;
}

export interface CompatAllowList {
    readonly tag: string;
    readonly exclude: readonly CompatExclusion[];
}

/** The newest `tests/regression/compat/allow-v<version>.json` — the previous release's. */
export function findAllowList(root: string): string | null {
    const dir = join(root, COMPAT_DIR);
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir)
        .filter((f) => /^allow-v\d+\.\d+\.\d+\.json$/.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return files.length === 0 ? null : join(dir, files[files.length - 1]);
}

export function parseAllowList(text: string): CompatAllowList {
    const parsed = JSON.parse(text) as { tag?: unknown; exclude?: unknown };
    if (typeof parsed.tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(parsed.tag)) throw new Error('allow-list: "tag" must be a vX.Y.Z string');
    if (!Array.isArray(parsed.exclude)) throw new Error('allow-list: "exclude" must be an array');
    for (const e of parsed.exclude as Array<Record<string, unknown>>) {
        if (typeof e.pattern !== 'string' || e.pattern === '') throw new Error('allow-list: every exclusion needs a "pattern"');
        if (typeof e.reason !== 'string' || e.reason.length < 20) throw new Error(`allow-list: ${String(e.pattern)} needs a "reason" (a sentence, not a word)`);
        if (e.ledger !== undefined && (typeof e.ledger !== 'string' || !/^C\d+(?:, C\d+)*$/.test(e.ledger))) throw new Error(`allow-list: ${e.pattern} ledger must look like "C3" or "C3, C7"`);
        if (e.tests !== undefined && (!Array.isArray(e.tests) || e.tests.length === 0 || e.tests.some((n) => typeof n !== 'string' || n === ''))) {
            throw new Error(`allow-list: ${e.pattern} "tests" must be a non-empty array of test-name fragments`);
        }
    }
    return { tag: parsed.tag, exclude: parsed.exclude as CompatExclusion[] };
}

/** Escape every regular-expression metacharacter, backslash included, of a literal. */
const escapeRegExp = (s: string): string => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/**
 * The vitest arguments the allow-list turns into: `--exclude <glob>` per
 * whole-file entry, and ONE `-t` negative look-ahead that deselects every
 * named test of the partial entries (vitest matches the pattern against the
 * full name, describe blocks included).
 */
export function vitestArgsFor(exclude: readonly CompatExclusion[]): string[] {
    const args: string[] = [];
    const names: string[] = [];
    for (const e of exclude) {
        if (e.tests === undefined) args.push('--exclude', e.pattern);
        else names.push(...e.tests);
    }
    if (names.length > 0) args.push('-t', `^(?!.*(?:${names.map(escapeRegExp).join('|')}))`);
    return args;
}

/** The command that makes `tag` available in a clone that lacks it (CI fetches it anonymously). */
export function fetchHint(tag: string): string {
    return `git fetch --no-tags --depth=1 origin +refs/tags/${tag}:refs/tags/${tag}`;
}

/** Whether `tag` resolves to a commit in this clone. */
export function tagAvailable(root: string, tag: string): boolean {
    return git(['rev-parse', '--verify', '--quiet', `${tag}^{commit}`], { cwd: root }).status === 0;
}

function git(args: string[], options: { cwd?: string } = {}): { status: number | null; stdout: Buffer; stderr: string } {
    const r = spawnSync('git', args, { cwd: options.cwd ?? ROOT, windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
    return { status: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: r.stderr?.toString('utf8') ?? '' };
}

function main(): number {
    const args = process.argv.slice(2);
    const tagArg = args.indexOf('--tag');
    const listOnly = args.includes('--list');

    const allowPath = findAllowList(ROOT);
    if (allowPath === null) {
        process.stderr.write(`run-compat: no ${COMPAT_DIR}/allow-v<version>.json — nothing to check against\n`);
        return 2;
    }
    const allow = parseAllowList(readFileSync(allowPath, 'utf8'));
    const tag = tagArg >= 0 ? (args[tagArg + 1] ?? '') : allow.tag;
    if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
        process.stderr.write(`run-compat: tag "${tag}" is not of the form vX.Y.Z\n`);
        return 2;
    }
    if (listOnly) {
        process.stdout.write(`compat-previous: ${tag} suite against the current sources; exclusions from ${allowPath}:\n`);
        for (const e of allow.exclude) {
            const scope = e.tests ? `(${e.tests.length} test${e.tests.length === 1 ? '' : 's'}) ` : '';
            process.stdout.write(`  ${e.pattern.padEnd(48)} ${scope}${e.ledger ? `[${e.ledger}] ` : ''}${e.reason}\n`);
        }
        return 0;
    }

    if (!tagAvailable(ROOT, tag)) {
        process.stderr.write(`run-compat: tag ${tag} is not available — fetch it first (${fetchHint(tag)})\n`);
        return 2;
    }

    const version = tag.slice(1);
    const dir = join(ROOT, 'test-output', '.compat', version);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    // 1. The archived tree: `git archive` writes a tar; extract it with the
    //    platform's tar (present on every GitHub runner and on Windows 10+).
    const archive = git(['archive', '--format=tar', tag, ...ARCHIVED_PATHS]);
    if (archive.status !== 0) {
        process.stderr.write(`run-compat: git archive ${tag} failed — ${archive.stderr.trim()}\n`);
        return 2;
    }
    // Extract from inside the target directory: Git for Windows' tar reads a
    // `D:\…` argument to -C as a remote host.
    const untar = spawnSync('tar', ['-x', '-f', '-'], { cwd: dir, input: archive.stdout, windowsHide: true });
    if (untar.status !== 0) {
        process.stderr.write(`run-compat: tar extraction failed — ${untar.stderr?.toString('utf8').trim() ?? ''}\n`);
        return 2;
    }

    // 2. The sources under test, where the archived tests expect them.
    for (const tree of CURRENT_TREES) cpSync(join(ROOT, tree), join(dir, tree), { recursive: true });
    for (const file of CURRENT_FILES) cpSync(join(ROOT, file), join(dir, file));

    // 3. The archived suite with the archived configuration, minus the allow-list.
    const vitest = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
    if (!existsSync(vitest)) {
        process.stderr.write('run-compat: node_modules/vitest/vitest.mjs is missing — npm ci first\n');
        return 2;
    }
    const vitestArgs = ['run', '--config', 'vitest.config.ts', ...vitestArgsFor(allow.exclude)];
    // Everything after `--` goes to vitest as is (a file filter, `-t`), for
    // inspecting one archived suite without editing the allow-list.
    const dashDash = args.indexOf('--');
    if (dashDash >= 0) vitestArgs.push(...args.slice(dashDash + 1));
    process.stdout.write(`compat-previous: ${tag} suite (${allow.exclude.length} exclusion${allow.exclude.length === 1 ? '' : 's'}) against the current src/ in ${dir}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, TZ: 'UTC' };
    // The archived config would otherwise write its JSON report over the
    // gate's, and the artifact-requiring suites would fail for want of a
    // dist/ that this directory never builds.
    delete env.GATE;
    delete env.GATE_REQUIRE_ARTIFACTS;
    const r = spawnSync(process.execPath, [vitest, ...vitestArgs], { cwd: dir, stdio: 'inherit', env, windowsHide: true });
    // Left behind, the archived fixtures and the copied trees would be
    // walked by every sample and docs walker that does not skip dot-dirs.
    if (!args.includes('--keep')) rmSync(dir, { recursive: true, force: true });
    return r.status ?? 1;
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
