/**
 * pdfnative-react — the authoring surface, derived from the source tree
 * ====================================================================
 * `docs/assets/ecosystem.json` quotes counts the docs repeat in prose: how
 * many components, block kinds, lint rules, error codes, schema subjects,
 * samples, tests, corpus files. None of those figures is hand-maintained
 * here: they are read from the files the package is built from — the
 * registry tables of `src/registry.ts`, the `ErrorCode` table of
 * `src/errors.ts`, `SCHEMA_SUBJECTS` of `src/spec/schema.ts`, the sample plan,
 * the conformance corpus table — and from directory walks for the samples,
 * the tests and the byte baseline.
 *
 * Nothing here imports `src/` at runtime: `verify:docs` runs in the gate's
 * fast profile, before any build, and must stay a pure function over text
 * (the tooling exception to golden rule 1 is for the scripts that RENDER,
 * not for the verifier). Every parser below is unit-tested in
 * tests/tools/react-surface.test.ts; `computeDerived()` is the one function
 * that touches the filesystem.
 *
 * Ported from pdfnative-mcp's scripts/lib/mcp-surface.ts (1.7.0).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CORPUS, claimOf } from './pdfa-corpus.js';
import { MODULE_SAMPLES, SAMPLE_PLAN } from './sample-plan.js';

// ── Pure parsers over src/registry.ts ────────────────────────────────

/** Escape every regular-expression metacharacter, backslash included. */
function escapeRegExpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text of one `export const NAME = [ … ] as const` / `{ … } as const` table, or null. */
function tableBlock(source: string, name: string): string | null {
    const start = source.search(new RegExp(`^export const ${escapeRegExpLiteral(name)}\\s*=`, 'm'));
    if (start === -1) return null;
    const rest = source.slice(start);
    const end = rest.search(/^[\]}] as const/m);
    return end === -1 ? rest : rest.slice(0, end);
}

export type LintSeverity = 'error' | 'warning' | 'info';

/** `LINT_RULES`: code → severity, in registry order. */
export function lintRuleTable(registryText: string): Map<string, LintSeverity> {
    const out = new Map<string, LintSeverity>();
    const block = tableBlock(registryText, 'LINT_RULES');
    if (block === null) return out;
    for (const m of block.matchAll(/^ {4}(L_[A-Z0-9_]+):\s*\{\s*\n\s*severity:\s*'(error|warning|info)'/gm)) {
        out.set(m[1], m[2] as LintSeverity);
    }
    return out;
}

/** `COMPONENT_REGISTRY`: the exported component names, in barrel order (aliases excluded). */
export function componentNames(registryText: string): string[] {
    const block = tableBlock(registryText, 'COMPONENT_REGISTRY');
    return block === null ? [] : [...block.matchAll(/^\s*(?:\{\s*)?name:\s*'([A-Za-z]+)'/gm)].map((m) => m[1]);
}

/** `COMPONENT_REGISTRY`: every `aliases: […]` entry, flattened. */
export function componentAliases(registryText: string): string[] {
    const block = tableBlock(registryText, 'COMPONENT_REGISTRY');
    if (block === null) return [];
    const out: string[] = [];
    for (const m of block.matchAll(/aliases:\s*\[([^\]]*)\]/g)) {
        for (const a of m[1].matchAll(/'([A-Za-z]+)'/g)) out.push(a[1]);
    }
    return out;
}

/** `CLIENT_COMPONENT_REGISTRY`: the client component names. */
export function clientComponentNames(registryText: string): string[] {
    const block = tableBlock(registryText, 'CLIENT_COMPONENT_REGISTRY');
    return block === null ? [] : [...block.matchAll(/name:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
}

/** `BLOCK_REGISTRY`: the block group ids, in schema order. */
export function blockIds(registryText: string): string[] {
    const block = tableBlock(registryText, 'BLOCK_REGISTRY');
    return block === null ? [] : [...block.matchAll(/^\s*(?:\{\s*)?id:\s*'([a-zA-Z]+)'/gm)].map((m) => m[1]);
}

/** `BLOCK_REGISTRY`: every DocSpec block tag (`'h1'`, `'p'`, `'table'`, …), flattened in schema order. */
export function blockKinds(registryText: string): string[] {
    const block = tableBlock(registryText, 'BLOCK_REGISTRY');
    if (block === null) return [];
    const out: string[] = [];
    for (const m of block.matchAll(/kinds:\s*\[([^\]]*)\]/g)) {
        for (const k of m[1].matchAll(/'([a-zA-Z0-9]+)'/g)) out.push(k[1]);
    }
    return out;
}

/** `DOC_SPEC_FIELDS`: the top-level DocSpec field names, in contract order. */
export function docSpecFields(registryText: string): string[] {
    const block = tableBlock(registryText, 'DOC_SPEC_FIELDS');
    return block === null ? [] : [...block.matchAll(/^\s+'([a-zA-Z]+)',/gm)].map((m) => m[1]);
}

// ── Other source tables ──────────────────────────────────────────────

/** The `ErrorCode` table of src/errors.ts: every `'E_…'` value, in declaration order. */
export function errorCodes(errorsText: string): string[] {
    const start = errorsText.search(/^export const ErrorCode\s*=/m);
    if (start === -1) return [];
    const rest = errorsText.slice(start);
    const end = rest.search(/^\}/m);
    const block = end === -1 ? rest : rest.slice(0, end);
    return [...block.matchAll(/'(E_[A-Z_]+)'/g)].map((m) => m[1]);
}

/** `SCHEMA_SUBJECTS` of src/spec/schema.ts. */
export function schemaSubjects(schemaText: string): string[] {
    const block = tableBlock(schemaText, 'SCHEMA_SUBJECTS');
    return block === null ? [] : [...block.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

/** The `pdfnative` range of a package.json field (`^1.8.0`), or null. */
export function enginePin(packageJsonText: string, field: 'peerDependencies' | 'devDependencies' | 'dependencies'): string | null {
    try {
        const pkg = JSON.parse(packageJsonText) as Record<string, Record<string, string> | undefined>;
        return pkg[field]?.['pdfnative'] ?? null;
    } catch {
        return null;
    }
}

/** `^1.8.0` → `1.8.0`; null when the range is not a plain caret/tilde/bare triple. */
export function pinFloor(range: string | null): string | null {
    const m = /^[\^~]?(\d+\.\d+\.\d+)$/.exec(range ?? '');
    return m?.[1] ?? null;
}

// ── Documentation parsers ────────────────────────────────────────────

/**
 * docs/LINTING.md: the rule rows under `### Errors`, `### Warnings`, `### Info`
 * → code → the section it is listed in (as a severity).
 */
export function lintingDocRules(lintingText: string): Map<string, LintSeverity> {
    const out = new Map<string, LintSeverity>();
    let current: LintSeverity | null = null;
    for (const line of lintingText.split(/\r?\n/)) {
        const h = /^###\s+(Errors|Warnings|Info)\b/.exec(line);
        if (h) {
            current = h[1] === 'Errors' ? 'error' : h[1] === 'Warnings' ? 'warning' : 'info';
            continue;
        }
        if (/^##\s/.test(line)) current = null;
        if (current === null) continue;
        const row = /^\|\s*`(L_[A-Z0-9_]+)`\s*\|/.exec(line);
        if (row) out.set(row[1], current);
    }
    return out;
}

/** The first-column codes of the `## 6. Errors` table of the agent contract. */
export function contractErrorRows(contractText: string): string[] {
    const start = contractText.search(/^## 6\. /m);
    if (start === -1) return [];
    const rest = contractText.slice(start + 1);
    const end = rest.search(/^## /m);
    const section = end === -1 ? rest : rest.slice(0, end);
    const out: string[] = [];
    for (const line of section.split(/\r?\n/)) {
        const cell = /^\|\s*`(E_[A-Z_]+)`\s*\|/.exec(line);
        if (cell && !out.includes(cell[1])) out.push(cell[1]);
    }
    return out;
}

/** Every backticked `E_…` token of a text. */
export function errorCodeTokens(text: string): string[] {
    return [...new Set([...text.matchAll(/`(E_[A-Z_]+)`/g)].map((m) => m[1]))];
}

/** Every backticked `L_…` token of a text. */
export function lintCodeTokens(text: string): string[] {
    return [...new Set([...text.matchAll(/`(L_[A-Z0-9_]+)`/g)].map((m) => m[1]))];
}

/** samples/README.md: the relative `.ts` / `.tsx` link targets, in file order (deduplicated). */
export function sampleIndexLinks(readmeText: string): string[] {
    return [...new Set([...readmeText.matchAll(/\]\(([^)\s#]+\.tsx?)\)/g)].map((m) => m[1]))];
}

/** `[1.3.0]: https://…/compare/v1.2.0...v1.3.0` → `{ label, from, to }` per link definition, in file order. */
export interface CompareLink {
    readonly label: string;
    readonly from: string | null;
    readonly to: string;
    readonly line: number;
}

export function changelogCompareLinks(changelogText: string): CompareLink[] {
    const out: CompareLink[] = [];
    changelogText.split(/\r?\n/).forEach((text, i) => {
        const compare = /^\[([^\]]+)\]:\s*\S+\/compare\/(\S+?)\.\.\.(\S+)\s*$/.exec(text);
        if (compare) {
            out.push({ label: compare[1], from: compare[2], to: compare[3], line: i + 1 });
            return;
        }
        const tag = /^\[([^\]]+)\]:\s*\S+\/releases\/tag\/(\S+)\s*$/.exec(text);
        if (tag) out.push({ label: tag[1], from: null, to: tag[2], line: i + 1 });
    });
    return out;
}

/** `## [1.3.0] — …` / `## [Unreleased]` headings, in file order. */
export function changelogHeadings(changelogText: string): Array<{ label: string; line: number }> {
    const out: Array<{ label: string; line: number }> = [];
    changelogText.split(/\r?\n/).forEach((text, i) => {
        const m = /^## \[([^\]]+)\]/.exec(text);
        if (m) out.push({ label: m[1], line: i + 1 });
    });
    return out;
}

export interface LadderFinding {
    readonly line: number;
    readonly message: string;
}

/**
 * The compare-link ladder: every heading has a link definition, every link
 * compares the previous heading's tag with its own, and `[Unreleased]`
 * starts at the newest released tag.
 */
export function checkChangelogLadder(changelogText: string): LadderFinding[] {
    const headings = changelogHeadings(changelogText);
    const links = new Map(changelogCompareLinks(changelogText).map((l) => [l.label, l] as const));
    const out: LadderFinding[] = [];
    const released = headings.filter((h) => h.label !== 'Unreleased');
    headings.forEach((h) => {
        const link = links.get(h.label);
        if (!link) {
            out.push({ line: h.line, message: `heading [${h.label}] has no link definition at the foot of the file` });
            return;
        }
        if (h.label === 'Unreleased') {
            const newest = released[0]?.label;
            if (newest !== undefined && (link.from !== `v${newest}` || link.to !== 'HEAD')) {
                out.push({ line: link.line, message: `[Unreleased] must compare v${newest}...HEAD — found ${link.from ?? '(tag link)'}...${link.to}` });
            }
            return;
        }
        const index = released.findIndex((r) => r.label === h.label);
        const previous = released[index + 1]?.label;
        if (link.to !== `v${h.label}`) out.push({ line: link.line, message: `[${h.label}] must end at v${h.label} — found ${link.to}` });
        if (previous !== undefined && link.from !== `v${previous}`) {
            out.push({ line: link.line, message: `[${h.label}] must compare v${previous}...v${h.label} — found ${link.from ?? '(tag link)'}...${link.to}` });
        }
    });
    for (const [label, link] of links) {
        if (!headings.some((h) => h.label === label)) out.push({ line: link.line, message: `link definition [${label}] has no heading` });
    }
    return out;
}

// ── Filesystem ───────────────────────────────────────────────────────

export function walk(dir: string, filter: (p: string) => boolean, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir).sort()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, filter, out);
        else if (filter(full)) out.push(full);
    }
    return out;
}

function readOr(root: string, rel: string): string {
    const p = join(root, rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function baselineEntryCount(root: string): number {
    const path = join(root, 'tests', 'regression', 'baselines', 'samples.sha256.json');
    if (!existsSync(path)) return 0;
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { entries?: Record<string, unknown> };
        return Object.keys(parsed.entries ?? {}).length;
    } catch {
        return 0;
    }
}

/** Every file under samples/ that is a sample (runnable or module): `.ts`/`.tsx`, `output/` excluded. */
export function sampleSourceFiles(root: string): string[] {
    const dir = join(root, 'samples');
    return walk(dir, (p) => /\.tsx?$/.test(p) && !p.includes(`${join('samples', 'output')}`))
        .map((p) => p.slice(root.length + 1).replace(/\\/g, '/'));
}

export interface DerivedCounts {
    readonly components: number;
    readonly clientComponents: number;
    readonly blocks: number;
    readonly specFields: number;
    readonly lintRules: number;
    readonly errorCodes: number;
    readonly schemaSubjects: number;
    readonly testFiles: number;
    readonly sampleFiles: number;
    readonly samples: number;
    readonly corpusFiles: number;
    readonly pdfaSamples: number;
    readonly pdfxSamples: number;
}

export function computeDerived(root: string): DerivedCounts {
    const registry = readOr(root, 'src/registry.ts');
    return {
        components: componentNames(registry).length,
        clientComponents: clientComponentNames(registry).length,
        blocks: blockIds(registry).length,
        specFields: docSpecFields(registry).length,
        lintRules: lintRuleTable(registry).size,
        errorCodes: errorCodes(readOr(root, 'src/errors.ts')).length,
        schemaSubjects: schemaSubjects(readOr(root, 'src/spec/schema.ts')).length,
        testFiles: walk(join(root, 'tests'), (p) => /\.test\.tsx?$/.test(p) && !p.includes(join('tests', 'regression', 'compat'))).length,
        sampleFiles: SAMPLE_PLAN.length + MODULE_SAMPLES.length,
        samples: baselineEntryCount(root),
        corpusFiles: CORPUS.length,
        pdfaSamples: CORPUS.filter((e) => claimOf(e) === 'pdfa').length,
        pdfxSamples: CORPUS.filter((e) => claimOf(e) === 'pdfx').length,
    };
}
