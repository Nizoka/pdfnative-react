// @vitest-environment node
/**
 * Sample regression gate (v1.3.0) — ported from pdfnative-mcp 1.7.0, itself
 * from pdfnative-cli 1.5.0 and pdfnative 1.8.0.
 *
 * The sample corpus lives in the git-ignored `test-output/samples/`, which
 * only `npm run test:generate` populates (each sample runs in its own
 * process with the creation instant pinned). This suite SKIPS when the corpus
 * is absent in a plain local run; under the gate's ci / publish profiles,
 * which run test:generate before test:coverage and set
 * GATE_REQUIRE_ARTIFACTS=1, a missing corpus FAILS this file instead. The
 * dedicated workflow (sample-regression.yml) additionally holds the baseline
 * through scripts/verify-samples.ts.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BASELINE_PATH, ENCRYPTED_SAMPLES, IDENTICAL_SAMPLE_GROUPS, OUTPUT_DIR, REPO_ROOT, SIGNED_SAMPLES, TIMESTAMPED_SAMPLES,
    canonicalJson, chainSince, compareToBaseline, fingerprintAll, loadBaseline, relPath, semanticSamplePaths,
    sha256Hex, unexpectedDuplicates, walkSamples,
    type Baseline, type Fingerprint,
} from '../../scripts/lib/sample-fingerprint.js';
import { MODULE_SAMPLES, SAMPLE_PLAN, SAMPLE_SUPPORT_FILES, expectedOutputs } from '../../scripts/lib/sample-plan.js';
import { requireArtifact } from '../_dist.js';

/** The release that introduced the chain: pdfnative-react 1.2.0 had no determinism plumbing to chain from. */
const CHAIN_ORIGIN = '1.3.0';

const samples = [...walkSamples(OUTPUT_DIR)];
const skip = requireArtifact(samples.length > 0, 'test-output/samples/', 'npm run test:generate');

describe.skipIf(skip)('sample regression baseline', () => {
    it('every tracked sample still emits what its reference release emitted', () => {
        const baseline = loadBaseline();
        expect(baseline, `missing baseline at ${BASELINE_PATH}`).not.toBeNull();

        const { entries, unreadable, missingSemantic } = fingerprintAll();
        expect(unreadable, 'samples that could not be fingerprinted').toEqual([]);
        expect(missingSemantic, 'ENCRYPTED_SAMPLES entries with no generated file').toEqual([]);

        const { changed, removed } = compareToBaseline(entries, baseline!);
        expect(changed, 'samples whose output changed').toEqual([]);
        expect(removed, 'baseline entries with no generated sample').toEqual([]);
        // `added` is deliberately not asserted: a sample introduced by the
        // release under development has no earlier reference to be held to.
        // `verify-samples --strict` is the opt-in gate for that.
    });

    it('never holds two samples meant to differ to the same bytes', () => {
        const baseline = loadBaseline()!;
        expect(unexpectedDuplicates(baseline.entries)).toEqual([]);
        expect(unexpectedDuplicates(fingerprintAll().entries)).toEqual([]);
        for (const group of IDENTICAL_SAMPLE_GROUPS) {
            for (const path of group) expect(baseline.entries[path], `${path} listed as identical but absent`).toBeDefined();
        }
    });

    it('fingerprints every sample by bytes: no sample of this repository encrypts or signs', () => {
        const { entries } = fingerprintAll();
        expect(Object.values(entries).every((e) => e.mode === 'bytes')).toBe(true);
        expect(semanticSamplePaths()).toEqual([]);
        expect(Object.keys(ENCRYPTED_SAMPLES)).toEqual([]);
        expect(SIGNED_SAMPLES).toEqual([]);
        expect(TIMESTAMPED_SAMPLES).toEqual([]);
    });

    it('holds exactly the PDFs the sample plan lists, the 1.3.0 samples included', () => {
        const rels = samples.map(relPath).sort();
        const planned = SAMPLE_PLAN.filter((e) => e.exclude === undefined).flatMap(expectedOutputs).sort();
        expect(rels).toEqual(planned);
        for (const sample of ['text/typography-engine.pdf', 'layout/print-pdfx4.pdf', 'layout/cmyk.pdf', 'quality/reproducible.pdf', 'fonts/scripts-27.pdf']) {
            expect(rels).toContain(sample);
        }
        expect(rels.length).toBeGreaterThanOrEqual(35);
    });
});

describe('committed baseline', () => {
    it('ships, pinned to UTC and to a parsable creation instant', () => {
        expect(existsSync(BASELINE_PATH)).toBe(true);
        const baseline = loadBaseline()!;
        expect(baseline.timezone).toBe('UTC');
        expect(Number.isNaN(Date.parse(baseline.creationDate))).toBe(false);
        expect(baseline.provenance.length).toBeGreaterThan(80);
        expect(baseline.provenance).not.toMatch(/^Initial baseline: every entry is anchored/);
    });

    it('anchors every entry to a release, never to one later than the baseline itself', () => {
        const baseline = loadBaseline()!;
        const rank = (v: string): number => {
            const [a = 0, b = 0, c = 0] = v.split('.').map(Number);
            return a * 1e6 + b * 1e3 + c;
        };
        const ceiling = rank(baseline.baselineVersion);
        for (const [path, entry] of Object.entries(baseline.entries)) {
            expect(entry.since, `${path} has no \`since\``).toMatch(/^\d+\.\d+\.\d+$/);
            expect(rank(entry.since), `${path} claims a reference from the future`).toBeLessThanOrEqual(ceiling);
            expect(rank(entry.since), `${path} predates the chain`).toBeGreaterThanOrEqual(rank(CHAIN_ORIGIN));
        }
    });

    it('carries forward references from the previous release once there is one', () => {
        // The chain is the point: after the first release, a large share of
        // the entries must still be held to what the previous release emitted,
        // not silently re-anchored to the current tree. The chain starts at
        // 1.3.0, so the first baseline is exempt; the provenance note explains.
        const baseline = loadBaseline()!;
        if (baseline.baselineVersion === CHAIN_ORIGIN) return;
        const inherited = Object.values(baseline.entries).filter((e) => e.since !== baseline.baselineVersion).length;
        expect(inherited).toBeGreaterThan(20);
    });

    it('lists every planned sample and nothing else', () => {
        const baseline = loadBaseline()!;
        const planned = SAMPLE_PLAN.filter((e) => e.exclude === undefined).flatMap(expectedOutputs).sort();
        expect(Object.keys(baseline.entries).sort()).toEqual(planned);
    });
});

describe('the sample plan', () => {
    function* walkSources(dir: string): Generator<string> {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'output') yield* walkSources(p);
            } else yield relative(REPO_ROOT, p).replace(/\\/g, '/');
        }
    }

    it('names every file under samples/ exactly once: a runnable sample, a module, or a support file', () => {
        const onDisk = [...walkSources(join(REPO_ROOT, 'samples'))].sort();
        const listed = [...SAMPLE_PLAN.map((e) => e.source), ...MODULE_SAMPLES, ...SAMPLE_SUPPORT_FILES].sort();
        expect(new Set(listed).size).toBe(listed.length);
        expect(onDisk).toEqual(listed);
    });

    it('produces distinct output names', () => {
        const outputs = SAMPLE_PLAN.flatMap(expectedOutputs);
        expect(new Set(outputs).size).toBe(outputs.length);
    });

    it('excludes only the one sample that fetches from the network', () => {
        expect(SAMPLE_PLAN.filter((e) => e.exclude !== undefined).map((e) => e.source)).toEqual(['samples/media/image-helpers.tsx']);
    });
});

describe('baseline chaining', () => {
    const fp = (hash: string, mode = 'bytes'): Fingerprint => ({ mode, hash, size: 1 }) as unknown as Fingerprint;
    const prior = {
        baselineVersion: '1.3.0',
        entries: { kept: { mode: 'bytes', hash: 'aa', size: 1, since: '1.3.0' } },
    } as unknown as Baseline;

    it('keeps the original release for an unchanged sample', () => {
        expect(chainSince({ kept: fp('aa') }, prior, '1.4.0')['kept']!.since).toBe('1.3.0');
    });

    it('re-anchors a sample whose hash changed, so the rebaseline is visible', () => {
        expect(chainSince({ kept: fp('bb') }, prior, '1.4.0')['kept']!.since).toBe('1.4.0');
    });

    it('stamps a sample the previous manifest never held', () => {
        expect(chainSince({ fresh: fp('cc') }, prior, '1.4.0')['fresh']!.since).toBe('1.4.0');
    });

    it('re-anchors when only the fingerprint mode changed', () => {
        expect(chainSince({ kept: fp('aa', 'semantic') }, prior, '1.4.0')['kept']!.since).toBe('1.4.0');
    });

    it('stamps everything when there is no previous manifest', () => {
        const out = chainSince({ a: fp('1'), b: fp('2') }, null, '1.3.0');
        expect(Object.values(out).every((e) => e.since === '1.3.0')).toBe(true);
    });

    it('emits keys in sorted order, so the manifest diff stays readable', () => {
        expect(Object.keys(chainSince({ z: fp('1'), a: fp('2'), m: fp('3') }, null, '1.3.0'))).toEqual(['a', 'm', 'z']);
    });
});

describe('sample fingerprint helpers', () => {
    it('serialises object keys in a stable order', () => {
        expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
        expect(canonicalJson({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
        expect(canonicalJson([{ z: 1, y: 2 }])).toBe('[{"y":2,"z":1}]');
        expect(canonicalJson(null)).toBe('null');
    });

    it('hashes strings and bytes consistently', () => {
        expect(sha256Hex('abc')).toBe(sha256Hex(new TextEncoder().encode('abc')));
        expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
    });

    it('normalises sample paths to forward slashes', () => {
        expect(relPath(join(OUTPUT_DIR, 'layout', 'page-setup.pdf'))).toBe('layout/page-setup.pdf');
    });

    it('reports unexpected duplicates', () => {
        const entries = { 'a/x.pdf': { hash: '1' }, 'a/y.pdf': { hash: '1' }, 'b/z.pdf': { hash: '2' } };
        expect(unexpectedDuplicates(entries)).toEqual([['a/x.pdf', 'a/y.pdf']]);
        expect(unexpectedDuplicates({ 'a/x.pdf': { hash: '1' }, 'b/z.pdf': { hash: '2' } })).toEqual([]);
    });
});

describe('sample generation is environment-independent', () => {
    // Reproducibility needs more than a pinned clock. `toLocaleString()` with
    // no explicit locale follows the machine's: on a fr-FR developer machine
    // 1500 formats as "1 500" with U+202F, on a C/en-US CI runner as "1,500".
    const LOCALE_SENSITIVE = /\.toLocale(?:String|DateString|TimeString)\(\s*\)/;

    function* walkTs(dir: string): Generator<string> {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) yield* walkTs(p);
            else if (/\.tsx?$/.test(entry.name)) yield p;
        }
    }

    it('never formats numbers or dates without an explicit locale — in the library, the scripts or the samples', () => {
        const offenders: string[] = [];
        for (const dir of ['scripts', 'src', 'samples']) {
            for (const file of walkTs(join(REPO_ROOT, dir))) {
                readFileSync(file, 'utf8')
                    .split('\n')
                    .forEach((line, i) => {
                        if (LOCALE_SENSITIVE.test(line)) offenders.push(`${relative(REPO_ROOT, file)}:${String(i + 1)}`);
                    });
            }
        }
        expect(offenders, "pass an explicit locale, e.g. toLocaleString('en-US')").toEqual([]);
    });

    it('runs the generator, the verifier and the test runner in UTC, with the operator knobs scrubbed', () => {
        expect(readFileSync(join(REPO_ROOT, 'scripts', 'helpers', 'tz.ts'), 'utf8')).toContain("process.env.TZ = 'UTC'");
        for (const script of ['generate-samples.ts', 'verify-samples.ts', 'generate-pdfa-corpus.ts', 'gate.ts']) {
            const source = readFileSync(join(REPO_ROOT, 'scripts', script), 'utf8');
            const firstImport = /^import\s+['"]([^'"]+)['"];/m.exec(source)?.[1];
            expect(firstImport, `${script}: the hermetic side-effect import must come first`).toBe('./helpers/hermetic.js');
        }
        // vitest.config.ts sets `env.TZ`, so a date formatted inside a test renders the same on every machine.
        expect(process.env['TZ']).toBe('UTC');
        expect(new Date(0).getTimezoneOffset()).toBe(0);
    });

    it('never sets a locale-dependent Date string into a document: the pinned instant is the sample date', () => {
        const generator = readFileSync(join(REPO_ROOT, 'scripts', 'generate-samples.ts'), 'utf8');
        expect(generator).toContain('SOURCE_DATE_EPOCH');
        expect(generator).toContain("'--import', PRELOAD_URL");
        const preload = readFileSync(join(REPO_ROOT, 'scripts', 'helpers', 'pin-creation-date.mjs'), 'utf8');
        expect(preload).toContain('setDefaultCreationDate');
    });
});
