// @vitest-environment node
/**
 * The engine-surface traceability matrix (tests/regression/engine-surface.json).
 *
 * pdfnative-react wraps an engine: a release of the engine that the renderer's
 * tests and samples do not exercise is a release the renderer has not really
 * adopted. This suite holds the matrix to the tree, so coverage cannot rot
 * silently:
 *
 *   - every reference is real (the test file holds that test name, the sample
 *     is an entry of the byte baseline, the transmission suite exists);
 *   - every typography key is set by an executed sample, and the five new
 *     script codes reach a fingerprinted sample;
 *   - moving the pdfnative peer pin fails the suite until the matrix follows.
 *
 * Ported from pdfnative-mcp 1.7.0 (tests/engine-surface.test.ts) and
 * pdfnative-cli 1.5.0; the item ids are shared, so the three wrappers can be
 * compared line by line.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

interface TestRef { readonly file: string; readonly name: string }
interface Waiver { readonly kind: string; readonly reason: string; readonly transmission?: string }
interface Item {
    readonly id: string;
    readonly kind: string;
    readonly changelog: string;
    readonly tests?: readonly TestRef[];
    readonly samples?: readonly string[];
    readonly waiver?: Waiver;
    readonly note?: string;
}
interface UpstreamLimit { readonly id: string; readonly summary: string; readonly pinnedBy: TestRef; readonly roadmap: string }
interface Matrix { readonly engine: string; readonly items: readonly Item[]; readonly upstreamLimits: readonly UpstreamLimit[] }

const matrix = JSON.parse(read('tests/regression/engine-surface.json')) as Matrix;
const baseline = JSON.parse(read('tests/regression/baselines/samples.sha256.json')) as { entries: Record<string, unknown> };
const pkg = JSON.parse(read('package.json')) as { peerDependencies: Record<string, string>; devDependencies: Record<string, string> };
const installed = JSON.parse(read('node_modules/pdfnative/package.json')) as { version: string };

const WAIVER_KINDS = ['LIB', 'TOOLING', 'DOCS', 'tested-upstream', 'upstream-limit'];
const ITEM_KINDS = ['feature', 'change', 'fix', 'docs'];

/** The twelve keys of the engine's TypographyOptions (pinned by tests/typography.test.tsx against the schema). */
const TYPOGRAPHY_KEYS = [
    'splitParagraphs', 'orphans', 'widows', 'keepHeadingsWithNext', 'unitBinding', 'bindShortWords', 'punctuationSpacing',
    'opticalMargins', 'metrics', 'fontFeatures', 'kerning', 'hyphenationLanguage',
] as const;

describe('engine-surface matrix: shape', () => {
    it('describes the pdfnative release the package is pinned to — moving the pin fails until the matrix follows', () => {
        expect(pkg.peerDependencies['pdfnative']).toBe(`^${matrix.engine}`);
        expect(pkg.devDependencies['pdfnative']).toBe(`^${matrix.engine}`);
        // Same minor: a patch release of the engine adds no surface to adopt.
        expect(installed.version.split('.').slice(0, 2)).toEqual(matrix.engine.split('.').slice(0, 2));
    });

    it('has unique ids, known kinds, and exactly one of tests / waiver per item', () => {
        const ids = matrix.items.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThanOrEqual(85);
        for (const item of matrix.items) {
            expect(ITEM_KINDS, item.id).toContain(item.kind);
            expect(item.changelog.length, item.id).toBeGreaterThan(8);
            const tested = (item.tests?.length ?? 0) > 0;
            expect(tested !== (item.waiver !== undefined), `${item.id}: tests XOR waiver`).toBe(true);
            if (item.waiver !== undefined) {
                expect(WAIVER_KINDS, item.id).toContain(item.waiver.kind);
                expect(item.waiver.reason.length, `${item.id}: a waiver states its reason`).toBeGreaterThan(20);
                expect(item.samples, `${item.id}: a waived item lists no sample`).toBeUndefined();
            }
        }
    });

    it('a user-facing feature or fix is never waived as documentation', () => {
        for (const item of matrix.items) {
            if (item.waiver?.kind === 'DOCS') expect(item.kind, item.id).toBe('docs');
        }
    });

    it('every engine feature JSX or a DocSpec can reach is tested, not waived', () => {
        // The headline features of the release, by id: none may drift into a waiver.
        const mustBeTested = [
            'typography', 'five-new-scripts', 'cmyk-colours', 'cmyk-gray-output-intents', 'pdfx4', 'validate-pdfx', 'colour-bars',
            'utc-dates', 'deterministic-samples', 'latin-marks', 'deflate-raw-impl', 'typography-feature-ineffective', 'bind-short-words',
            'parse-color-cmyk', 'output-intent-cmyk-gray', 'fix-soft-hyphens', 'fix-justified-text', 'fix-pdfx-trimbox',
            'fix-output-intent-validation', 'fix-acroform-pdfa', 'fix-locale-dependent-samples',
        ];
        for (const id of mustBeTested) {
            const item = matrix.items.find((i) => i.id === id);
            expect(item, id).toBeDefined();
            expect(item!.waiver, `${id} must be exercised through the renderer`).toBeUndefined();
        }
    });
});

describe('engine-surface matrix: every reference is real', () => {
    const sources = new Map<string, string>();
    const source = (file: string): string => {
        let text = sources.get(file);
        if (text === undefined) {
            expect(existsSync(join(ROOT, file)), `${file} exists`).toBe(true);
            text = read(file);
            sources.set(file, text);
        }
        return text;
    };

    it('each named test exists in the file that is said to hold it', () => {
        for (const item of matrix.items) {
            for (const ref of item.tests ?? []) {
                expect(ref.file, item.id).toMatch(/^tests\/.+\.test\.tsx?$/);
                expect(source(ref.file).includes(ref.name), `${item.id}: "${ref.name}" in ${ref.file}`).toBe(true);
            }
        }
    });

    it('each sample is an entry of the byte baseline', () => {
        for (const item of matrix.items) {
            for (const sample of item.samples ?? []) {
                expect(Object.hasOwn(baseline.entries, sample), `${item.id}: ${sample}`).toBe(true);
            }
        }
    });

    it('a tested-upstream waiver names the suite that proves the transmission', () => {
        for (const item of matrix.items) {
            if (item.waiver?.kind !== 'tested-upstream') continue;
            expect(item.waiver.transmission, item.id).toBeDefined();
            expect(existsSync(join(ROOT, item.waiver.transmission!)), `${item.id}: ${item.waiver.transmission}`).toBe(true);
        }
    });

    it('every upstream limit is pinned in the tree and listed in ROADMAP.md', () => {
        const roadmap = read('ROADMAP.md');
        expect(matrix.upstreamLimits.length).toBeGreaterThanOrEqual(2);
        for (const limit of matrix.upstreamLimits) {
            expect(limit.summary.length, limit.id).toBeGreaterThan(40);
            expect(source(limit.pinnedBy.file).includes(limit.pinnedBy.name), `${limit.id}: "${limit.pinnedBy.name}" in ${limit.pinnedBy.file}`).toBe(true);
            expect(roadmap.includes(limit.roadmap), `${limit.id}: ROADMAP.md mentions "${limit.roadmap}"`).toBe(true);
        }
    });
});

describe('engine-surface: named means exercised', () => {
    it('every TypographyOptions key is set by an executed sample', () => {
        const used = new Set<string>();
        for (const sample of ['samples/text/typography-engine.tsx', 'samples/text/typography-french.tsx', 'samples/agent/compact-spec.ts']) {
            const text = read(sample);
            for (const key of TYPOGRAPHY_KEYS) if (new RegExp(`\\b${key}\\s*:`).test(text)) used.add(key);
        }
        expect(TYPOGRAPHY_KEYS.filter((key) => !used.has(key)), 'typography keys no sample sets').toEqual([]);
    });

    it('the five new scripts and the four Latin aliases reach a fingerprinted sample', () => {
        const text = read('samples/fonts/scripts-27.tsx');
        for (const code of ['lo', 'nod', 'khb', 'tdd', 'cjm']) expect(text, code).toMatch(new RegExp(`^\\s+${code}:\\s*\\(\\)\\s*=>\\s*import\\(`, 'm'));
        for (const alias of ['ha', 'yo', 'ig', 'sw']) expect(text, alias).toContain(`(${alias})`);
        expect(Object.hasOwn(baseline.entries, 'fonts/scripts-27.pdf')).toBe(true);
        // Rendered for real: the parametrised suite resolves every module.
        expect(read('tests/fonts-27.test.tsx')).toContain('resolveFonts');
    });

    it('every diagnostic code the engine can raise has a row in the agent contract and a lint rule ahead of it', () => {
        const contract = read('docs/AGENT_CONTRACT.md');
        const codes = [
            'PDFA_NO_FONT_ENTRIES', 'PDFA_DEVICE_CMYK_IMAGE', 'PDFA_UNEMBEDDED_FORM_FONT', 'PDFA_DEVICE_CMYK_CONTENT', 'PDFA_ICC_PROFILE_VERSION',
            'PDFX_NO_FONT_ENTRIES', 'PDFX_DEVICE_CMYK', 'PDFX_ANNOTATIONS', 'TYPOGRAPHY_FEATURE_INEFFECTIVE',
        ];
        for (const code of codes) expect(contract.includes(`\`${code}\``), `the agent contract documents ${code}`).toBe(true);
        expect(read('samples/quality/diagnostics.tsx')).toContain('Nine codes');
    });
});

// The engine ships no CHANGELOG in its npm package: this check runs where the
// sibling checkout exists (the maintainer's machine), never on a CI runner.
const ENGINE_CHANGELOG = resolve(ROOT, '..', 'pdfnative', 'CHANGELOG.md');

describe.skipIf(!existsSync(ENGINE_CHANGELOG))('engine-surface matrix: complete against the engine changelog', () => {
    it('maps every bullet of the release entry to exactly one item', () => {
        const text = readFileSync(ENGINE_CHANGELOG, 'utf8').replace(/\r\n/g, '\n');
        const start = text.indexOf(`## [${matrix.engine}]`);
        expect(start, `the changelog has a [${matrix.engine}] entry`).toBeGreaterThan(-1);
        const next = text.indexOf('\n## [', start + 1);
        const entry = text.slice(start, next === -1 ? undefined : next);
        const titles = [...entry.matchAll(/^- \*\*(.+?)(?:\*\*|$)/gm)].map((m) => m[1]!.trim());
        expect(titles.length).toBeGreaterThan(40);

        const used = new Map<string, string>();
        const unmatched: string[] = [];
        for (const title of titles) {
            const candidates = matrix.items.filter((i) => title.startsWith(i.changelog)).sort((a, b) => b.changelog.length - a.changelog.length);
            const item = candidates[0];
            if (item === undefined) {
                unmatched.push(title);
                continue;
            }
            expect(used.get(item.id), `${item.id} matched twice ("${used.get(item.id) ?? ''}" and "${title}")`).toBeUndefined();
            used.set(item.id, title);
        }
        expect(unmatched, 'changelog bullets without a matrix item').toEqual([]);
        expect(matrix.items.filter((i) => !used.has(i.id)).map((i) => i.id), 'matrix items matching no changelog bullet').toEqual([]);
    });
});
