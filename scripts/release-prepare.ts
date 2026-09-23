#!/usr/bin/env tsx
/**
 * pdfnative-react — Release preparation (ported from pdfnative-mcp 1.7.0 / pdfnative-cli 1.5.0 / pdfnative 1.8.0)
 * ============================================================================================================
 * Applies the mechanical part of a version bump in one pass. Until 1.3.0 a
 * release spread the same number across a dozen files edited by hand —
 * package manifests, `src/version.ts`, CITATION.cff, the SECURITY.md support
 * table, the knowledge-base header, llms.txt — and only `tests/version.test.ts`
 * caught part of the drift (`verify:docs` now holds the rest, after the fact).
 *
 * What it edits, in order (every touched file is printed):
 *   1. package.json + package-lock.json `version`
 *   2. src/version.ts `version` — the lock-step tests/version.test.ts asserts
 *      (the JSON Schema `$id` derives from it)
 *   3. docs/assets/ecosystem.json `packages.pdfnative-react.version` + `verifiedOn`,
 *      and the "Verified on" stamps the verified-on-parity rule holds to
 *      that date (llms.txt, docs/KNOWLEDGE_BASE.md, docs/AGENT_CONTRACT.md)
 *   4. CITATION.cff `version` + `date-released`
 *   5. SECURITY.md supported-versions table
 *   6. README.md engine badge, docs/KNOWLEDGE_BASE.md header and llms.txt
 *      `Current release:` line (the engine version is the package.json
 *      peer-dependency floor)
 *   7. release-notes/vX.Y.Z.md scaffolded from release-notes/TEMPLATE.md, and
 *      release-notes/draft/PR-vX.Y.Z.md scaffolded from release-notes/PR_TEMPLATE.md
 *
 * NOT bumped here, because each is a reviewed decision, never a mechanical one:
 * the `pdfnative` peer pin (package.json, twice), `REQUIRED_ENGINE` in
 * src/doctor.ts and `contract.engine` in src/manifest.ts — `verify:docs` rule
 * `peer-pin-parity` holds the three together — and the compatibility baselines
 * under tests/regression/baselines/ (frozen captures of a published surface).
 *
 * It never reserialises JSON or YAML: each edit is a targeted regex on the
 * one field it owns, so formatting, key order and comments survive and the
 * diff reads as the bump and nothing else.
 *
 * Usage:
 *   npx tsx scripts/release-prepare.ts --version 1.3.0
 *   npx tsx scripts/release-prepare.ts --version 1.3.0 --date 2026-09-22 --previous v1.2.0
 *   npx tsx scripts/release-prepare.ts --version 1.3.0 --dry-run
 *
 * (PowerShell swallows a bare `--`, so call the script directly rather than
 * going through `npm run release:prepare`.)
 *
 * Exit codes:
 *   0 — done, or the dry run reported what would change
 *   1 — a file the bump owns is missing, or a pattern it edits was not found
 *   2 — bad usage (invalid semver or date), or git could not name the previous tag
 *
 * The script writes files and nothing else: it never commits, tags, pushes or
 * publishes — those are the maintainer's steps (.github/AGENT_RULES.md).
 *
 * The pure functions are exported and covered by
 * tests/tools/release-prepare.test.ts; only `main()` touches git and disk.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── Types ───────────────────────────────────────────────────────────

/** Result of one targeted edit. `text` equals the input when nothing changed. */
export interface Rewrite {
    readonly text: string;
    /** How many places the owning pattern was found — changed or already right. */
    readonly matched: number;
}

export interface Options {
    readonly version: string;
    readonly date: string;
    readonly previous: string | null;
    readonly dryRun: boolean;
}

// ── Small helpers ───────────────────────────────────────────────────

const SEMVER = /^\d+\.\d+\.\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isSemver(v: string): boolean {
    return SEMVER.test(v);
}

export function isIsoDate(d: string): boolean {
    return ISO_DATE.test(d) && !Number.isNaN(Date.parse(d));
}

/** Today as YYYY-MM-DD in UTC — the same clock CI uses. */
export function todayUtc(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/** `v1.2.0` → `1.2.0`. */
export function stripTag(tag: string): string {
    return tag.replace(/^v/, '');
}

/** `1.3.2` → `1.3`. */
export function minorLine(version: string): string {
    return version.split('.').slice(0, 2).join('.');
}

/** Replace with a counter, so the caller learns whether the pattern existed at all. */
function replaceCounting(text: string, re: RegExp, replacement: (...groups: string[]) => string): Rewrite {
    let matched = 0;
    const out = text.replace(re, (...args: unknown[]) => {
        matched++;
        return replacement(...(args as string[]));
    });
    return { text: out, matched };
}

// ── 1. package.json / package-lock.json ─────────────────────────────

/**
 * The top-level `"version"` of an npm manifest sits at the file's base indent
 * (two spaces in package.json and in this repository's lockfile). Nested
 * `version` keys — every dependency in the lockfile — are deeper and are left
 * alone: only the FIRST `"version"` at the shallowest indent is the package's.
 */
export function bumpJsonVersion(text: string, version: string): Rewrite {
    return replaceCounting(text, /^( {2}| {4})("version":[ \t]*")([^"]*)(")/m, (_m, indent, a, _old, c) => `${indent}${a}${version}${c}`);
}

/** The lockfile carries the version twice: at the root and under `packages[""]`. */
export function bumpLockVersion(text: string, version: string): Rewrite {
    const root = bumpJsonVersion(text, version);
    const pkg = replaceCounting(
        root.text,
        /("packages":\s*\{\s*"":\s*\{[^}]*?"version":[ \t]*")([^"]*)(")/,
        (_m, a, _old, c) => `${a}${version}${c}`,
    );
    return { text: pkg.text, matched: root.matched + pkg.matched };
}

/** The `pdfnative` PEER floor of package.json (`^1.8.0` → `1.8.0`), or null. */
export function engineVersion(packageJson: string): string | null {
    const m = /"peerDependencies":\s*\{[^}]*"pdfnative":\s*"[\^~]?(\d+\.\d+\.\d+)"/.exec(packageJson);
    return m?.[1] ?? null;
}

// ── 2. src/version.ts ───────────────────────────────────────────────

/** `export const version = '1.2.0';` */
export function bumpVersionTs(text: string, version: string): Rewrite {
    return replaceCounting(text, /(export const version\s*=\s*['"])([^'"]*)(['"])/, (_m, a, _old, c) => `${a}${version}${c}`);
}

// ── 3. ecosystem.json + "Verified on" stamps ────────────────────────

/** `packages.pdfnative-react.version` and the top-level `verifiedOn`. */
export function bumpManifest(text: string, version: string, date: string): Rewrite {
    const v = replaceCounting(
        text,
        /("packages":\s*\{\s*"pdfnative-react":\s*\{\s*"version":[ \t]*")([^"]*)(")/,
        (_m, a, _old, c) => `${a}${version}${c}`,
    );
    const d = replaceCounting(v.text, /^( {2}"verifiedOn":[ \t]*")([^"]*)(")/m, (_m, a, _old, c) => `${a}${date}${c}`);
    return { text: d.text, matched: v.matched + d.matched };
}

/**
 * The entry-point artefacts carry a `Verified on YYYY-MM-DD` sentence that
 * verify-docs requires to equal the manifest's date exactly — bumping one
 * without the other fails the build.
 */
export function restampVerifiedOn(text: string, date: string): Rewrite {
    return replaceCounting(text, /(Verified on |"verifiedOn":[ \t]*")\d{4}-\d{2}-\d{2}/, (_m, a) => `${a}${date}`);
}

// ── 4. CITATION.cff ─────────────────────────────────────────────────

/**
 * The software's own `version:` — not `cff-version:`, which is the format
 * revision (the anchored `^version` cannot match a line starting with `cff-`).
 * `date-released` is rewritten when present (keeping its quoting style) and
 * added directly under `version:` otherwise, so a citation names the date.
 */
export function bumpCitation(text: string, version: string, date: string): Rewrite {
    const v = replaceCounting(text, /^(version:[ \t]*)([^\r\n]*)/m, (_m, a) => `${a}${version}`);
    if (v.matched === 0) return v;
    if (/^date-released:/m.test(v.text)) {
        const d = replaceCounting(v.text, /^(date-released:[ \t]*)([^\r\n]*)/m, (_m, a, old) => `${a}${/^["']/.test(old) ? `"${date}"` : date}`);
        return { text: d.text, matched: v.matched + d.matched };
    }
    const eol = v.text.includes('\r\n') ? '\r\n' : '\n';
    const out = v.text.replace(/^(version:[^\r\n]*)/m, `$1${eol}date-released: ${date}`);
    return { text: out, matched: v.matched + 1 };
}

// ── 5. SECURITY.md ──────────────────────────────────────────────────

/**
 * This repository supports the current minor line, keeps the previous one on
 * security fixes, and drops the rest:
 *
 *   | `1.3.x`  | :white_check_mark: |
 *   | `1.2.x`  | security fixes only |
 *   | `< 1.2`  | :x:                |
 *
 * A minor or major bump moves the three rows one line up; a patch release
 * lands on the line already listed, so the table is left as it is. Column
 * padding is preserved for same-width lines (`1.3` → `1.4`).
 */
export function bumpSecurityTable(text: string, version: string): Rewrite {
    const line = minorLine(version);
    const re = /^(\| `)(\d+\.\d+)(\.x`[ \t]*\| :white_check_mark:[ \t]*\|[^\r\n]*\r?\n\| `)(\d+\.\d+)(\.x`[ \t]*\|[^\r\n|]*security[^\r\n]*\r?\n\| `< )(\d+\.\d+)(`[ \t]*\| :x:)/m;
    return replaceCounting(text, re, (_whole, a, current, b, previous, c, _cutoff, d) => {
        if (current === line) return `${a}${current}${b}${previous}${c}${previous}${d}`;
        return `${a}${line}${b}${current}${c}${current}${d}`;
    });
}

// ── 6. README badge, knowledge-base header, llms.txt ────────────────

/** The shields.io engine badge: `badge/pdfnative-1.8-0a7e8c.svg` names the engine's minor line. */
export function bumpReadmeEngineBadge(text: string, engine: string): Rewrite {
    return replaceCounting(text, /(img\.shields\.io\/badge\/pdfnative-)(\d+\.\d+)(-)/, (_m, a, _old, c) => `${a}${minorLine(engine)}${c}`);
}

/** `pdfnative-react **v1.2.0**` in the knowledge-base header blockquote. */
export function bumpKnowledgeBaseHeader(text: string, version: string): Rewrite {
    return replaceCounting(text, /(pdfnative-react \*\*v)(\d+\.\d+\.\d+)(\*\*)/, (_m, a, _old, c) => `${a}${version}${c}`);
}

/** `Current release: X.Y.Z` (llms.txt, AGENTS-style prose). */
export function bumpCurrentRelease(text: string, version: string): Rewrite {
    return replaceCounting(text, /(Current (?:release|version):\s*\**v?)(\d+\.\d+\.\d+)/, (_m, a) => `${a}${version}`);
}

// ── 7. Release note and PR draft scaffolds ──────────────────────────

/**
 * release-notes/TEMPLATE.md and release-notes/PR_TEMPLATE.md carry the
 * document as a fenced ```markdown block whose own code fences are escaped as
 * \`\`\`. Extract it, resolve the `vX.Y.Z` / `X.Y.Z` / `vX.Y.Z-1` /
 * `YYYY-MM-DD` placeholders and unescape.
 */
export function scaffoldFromTemplate(template: string, version: string, date: string, previousTag: string, templateName = 'the template'): string {
    const m = /```markdown\r?\n([\s\S]*?)\r?\n```/.exec(template);
    if (!m) throw new Error(`${templateName} has no \`\`\`markdown block to scaffold from`);
    return (
        m[1]
            .replace(/vX\.Y\.Z-1/g, previousTag)
            .replace(/vX\.Y\.Z/g, `v${version}`)
            .replace(/X\.Y\.Z/g, version)
            .replace(/YYYY-MM-DD/g, date)
            .replace(/\\`\\`\\`/g, '```') + '\n'
    );
}

// ── CLI ─────────────────────────────────────────────────────────────

export const USAGE =
    'usage: npx tsx scripts/release-prepare.ts --version X.Y.Z [--date YYYY-MM-DD] [--previous vA.B.C] [--dry-run]';

/** Returns the options, or a usage error message. */
export function parseArgs(argv: readonly string[]): Options | string {
    let version: string | null = null;
    let date: string | null = null;
    let previous: string | null = null;
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = (): string | null => (i + 1 < argv.length ? argv[++i] : null);
        if (arg === '--dry-run') dryRun = true;
        else if (arg === '--version') version = value();
        else if (arg === '--date') date = value();
        else if (arg === '--previous') previous = value();
        else if (arg.startsWith('--version=')) version = arg.slice('--version='.length);
        else if (arg.startsWith('--date=')) date = arg.slice('--date='.length);
        else if (arg.startsWith('--previous=')) previous = arg.slice('--previous='.length);
        else return `unknown argument "${arg}"\n${USAGE}`;
    }
    if (version === null) return `--version is required\n${USAGE}`;
    if (!isSemver(version)) return `--version "${version}" is not a plain semver triple (X.Y.Z)`;
    if (date !== null && !isIsoDate(date)) return `--date "${date}" is not an ISO date (YYYY-MM-DD)`;
    if (previous !== null && !isSemver(stripTag(previous))) return `--previous "${previous}" is not a tag of the form vA.B.C`;
    return { version, date: date ?? todayUtc(), previous: previous === null ? null : `v${stripTag(previous)}`, dryRun };
}

function git(root: string, args: string[]): string | null {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    return r.status === 0 ? r.stdout : null;
}

export function main(argv: readonly string[], root = resolve(import.meta.dirname, '..')): number {
    const parsed = parseArgs(argv);
    if (typeof parsed === 'string') {
        console.error(`release-prepare: ${parsed}`);
        return 2;
    }
    const opts = parsed;
    const rel = (p: string): string => relative(root, p).replace(/\\/g, '/');

    const previousTag = opts.previous ?? git(root, ['describe', '--tags', '--abbrev=0'])?.trim() ?? null;
    if (!previousTag || !isSemver(stripTag(previousTag))) {
        console.error('release-prepare: could not determine the previous tag (git describe --tags --abbrev=0); pass --previous vA.B.C');
        return 2;
    }
    const previousVersion = stripTag(previousTag);
    const { version, date, dryRun } = opts;
    const mark = dryRun ? '~' : '+';
    let problems = 0;
    const engine = existsSync(join(root, 'package.json')) ? engineVersion(readFileSync(join(root, 'package.json'), 'utf8')) : null;

    console.log(
        `release-prepare: v${version} (previous ${previousTag}, date ${date}, engine pdfnative ${engine ?? '?'})${dryRun ? ' — dry run, nothing is written' : ''}`,
    );

    /** Read, rewrite, report, and write unless --dry-run. */
    const edit = (relPath: string, what: string, fn: (text: string) => Rewrite): void => {
        const abs = join(root, relPath);
        if (!existsSync(abs)) {
            console.log(`  !  ${relPath} — missing`);
            problems++;
            return;
        }
        const before = readFileSync(abs, 'utf8');
        const r = fn(before);
        if (r.matched === 0) {
            console.log(`  !  ${relPath} — ${what}: pattern not found, edit by hand`);
            problems++;
        } else if (r.text === before) {
            console.log(`  =  ${relPath} — ${what}: already current`);
        } else {
            console.log(`  ${mark}  ${relPath} — ${what}`);
            if (!dryRun) writeFileSync(abs, r.text);
        }
    };

    /** Scaffold a file from a template unless it exists. */
    const scaffold = (targetRel: string, templateRel: string): void => {
        const target = join(root, targetRel);
        const template = join(root, templateRel);
        if (existsSync(target)) {
            console.log(`  =  ${rel(target)} — exists, left alone`);
        } else if (!existsSync(template)) {
            console.log(`  !  ${templateRel} — missing`);
            problems++;
        } else {
            console.log(`  ${mark}  ${rel(target)} — scaffolded from ${templateRel}`);
            if (!dryRun) {
                mkdirSync(dirname(target), { recursive: true });
                writeFileSync(target, scaffoldFromTemplate(readFileSync(template, 'utf8'), version, date, previousTag, templateRel));
            }
        }
    };

    console.log('\n1. Package manifests');
    edit('package.json', 'version', (t) => bumpJsonVersion(t, version));
    edit('package-lock.json', 'version (root + packages[""])', (t) => bumpLockVersion(t, version));

    console.log('\n2. Version lock-step (tests/version.test.ts; the schema $id derives from it)');
    edit('src/version.ts', 'version', (t) => bumpVersionTs(t, version));

    console.log('\n3. Ecosystem manifest and the Verified-on stamps it governs');
    edit('docs/assets/ecosystem.json', `packages.pdfnative-react.version + verifiedOn ${date}`, (t) => bumpManifest(t, version, date));
    for (const stamped of ['llms.txt', 'docs/KNOWLEDGE_BASE.md', 'docs/AGENT_CONTRACT.md']) {
        edit(stamped, `Verified on ${date}`, (t) => restampVerifiedOn(t, date));
    }

    console.log('\n4. Citation metadata');
    edit('CITATION.cff', `version + date-released ${date}`, (t) => bumpCitation(t, version, date));

    console.log('\n5. Supported versions');
    edit('SECURITY.md', `${minorLine(version)}.x supported, the previous line on security fixes, older lines unsupported`, (t) => bumpSecurityTable(t, version));

    console.log('\n6. README engine badge, knowledge-base header and llms.txt');
    if (engine !== null) edit('README.md', `engine badge pdfnative ${minorLine(engine)}`, (t) => bumpReadmeEngineBadge(t, engine));
    edit('docs/KNOWLEDGE_BASE.md', `header pdfnative-react v${version}`, (t) => bumpKnowledgeBaseHeader(t, version));
    edit('llms.txt', `Current release: ${version}`, (t) => bumpCurrentRelease(t, version));

    console.log('\n7. Release note and PR draft');
    scaffold(`release-notes/v${version}.md`, 'release-notes/TEMPLATE.md');
    scaffold(`release-notes/draft/PR-v${version}.md`, 'release-notes/PR_TEMPLATE.md');

    console.log(`
Next steps
  1. git diff --stat                      review: the diff should read as the bump and nothing else
  2. npm run verify:docs                  every count and version the docs quote
  3. write release-notes/v${version}.md and the CHANGELOG.md entry ## [${version}]
     (every sample rebaseline goes in the note's Upgrade section; add the compare link)
  4. decide whether the pdfnative peer pin, REQUIRED_ENGINE and contract.engine move — they are not bumped here
  5. npx tsx scripts/gate.ts --publish --require-all   the full release gate (previous release: v${previousVersion})
  6. fill release-notes/draft/PR-v${version}.md — every figure from a command run on the branch
  See CONTRIBUTING.md § Release for the merge, tag and publish steps (the maintainer's).`);

    if (problems > 0) {
        console.log(`\nrelease-prepare: ${problems} step${problems === 1 ? '' : 's'} need${problems === 1 ? 's' : ''} a hand edit (marked "!").`);
        return 1;
    }
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
