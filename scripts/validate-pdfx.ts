#!/usr/bin/env tsx
/**
 * pdfnative-react — PDF/X-4 corpus validation (v1.3.0)
 * =====================================================
 * Runs pdfnative's structural `validatePdfX()` (ISO 15930-7 prerequisites)
 * over every PDF/X-claiming file in `test-output/pdfa/` — the same corpus
 * scripts/generate-pdfa-corpus.ts writes for veraPDF — and compares the
 * verdict with the manifest's `expectPdfXCompliant` flag.
 *
 * Why a separate gate: veraPDF does not cover PDF/X and no open reference
 * validator exists. The library validator checks header, XMP identification,
 * OutputIntent profile, page boxes, embedded fonts (incl. XObjects and
 * annotation appearances), annotations, actions, embedded files, OPI /
 * PostScript / reference XObjects, LZW, transfer functions and device colour.
 * A `valid` verdict means those prerequisites hold; it is not a certified
 * preflight. The negative canary proves the validator still rejects.
 *
 * This is repository tooling: the package itself never re-exports
 * `validatePdfX` (golden rule 7 — authoring only); docs/RECIPES.md shows the
 * one-line engine import for callers who want it.
 *
 * Usage:
 *   npm run build && npm run corpus:pdfa && npm run validate:pdfx
 *   npx tsx scripts/validate-pdfx.ts [--quiet | --verbose] [--json]
 *
 * Runs in-process (no external tool), so it never skips: it is part of the
 * `ci` gate profile, not only `publish`.
 *
 * Exit codes:
 *   0 — every expectation met
 *   1 — a claiming file the manifest expects to pass fails (FAIL), the negative
 *       canary passes (XPASS), the corpus has no negative canary, or a coverage
 *       canary tripped (missing file, claim disagreeing with the manifest, or a
 *       count differing from `declared.pdfxSamples` in docs/assets/ecosystem.json)
 *   2 — the corpus directory / manifest is absent (run `npm run corpus:pdfa`),
 *       or bad usage
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validatePdfX } from 'pdfnative';
import { REPO_ROOT, TEST_OUTPUT_DIR, parseOutputMode } from './helpers/io.js';
import type { CorpusManifest } from './lib/verapdf.js';
import {
    type PdfXCounts, PDFX_EXIT_OK, PDFX_EXIT_CONFORMANCE, PDFX_EXIT_INFRA,
    detectPdfXClaim, classifyPdfX, pdfxExitCodeFor,
} from './lib/pdfx.js';

const CORPUS_DIR = join(TEST_OUTPUT_DIR, 'pdfa');
const MANIFEST = join(CORPUS_DIR, 'manifest.json');
const ECOSYSTEM = join(REPO_ROOT, 'docs', 'assets', 'ecosystem.json');

const log = (s: string): void => { process.stderr.write(`${s}\n`); };
const out = (s: string): void => { process.stdout.write(`${s}\n`); };

function declaredPdfxSamples(): number | null {
    if (!existsSync(ECOSYSTEM)) return null;
    const m = JSON.parse(readFileSync(ECOSYSTEM, 'utf8')) as { declared?: { pdfxSamples?: number } };
    return typeof m.declared?.pdfxSamples === 'number' ? m.declared.pdfxSamples : null;
}

function main(): number {
    const mode = parseOutputMode(process.argv.slice(2));
    if ('error' in mode) {
        log(mode.error);
        return PDFX_EXIT_INFRA;
    }
    const { quiet, json } = mode;
    const say = (s: string): void => { if (!json) out(s); };
    const note = (s: string): void => { if (!json && !quiet) log(s); };

    if (!existsSync(CORPUS_DIR) || !existsSync(MANIFEST)) {
        log('No corpus found in test-output/pdfa/. Run `npm run corpus:pdfa` first.');
        return PDFX_EXIT_INFRA;
    }
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CorpusManifest;
    const entries = Array.isArray(manifest.files) ? manifest.files : [];

    interface Claiming { readonly name: string; readonly bytes: Uint8Array; readonly version: string; readonly expectCompliant: boolean }
    const claimed: Claiming[] = [];
    let canaryFailures = 0;
    for (const entry of entries) {
        const file = join(CORPUS_DIR, entry.file);
        if (!existsSync(file)) {
            log(`Coverage canary: ${entry.file} is listed in manifest.json but missing on disk.`);
            canaryFailures++;
            continue;
        }
        const bytes = readFileSync(file);
        const claim = detectPdfXClaim(bytes.toString('latin1'));
        const expectClaim = entry.expectPdfXClaim === true;
        if (expectClaim && claim === null) {
            log(`Coverage canary: ${entry.file} does not claim PDF/X in its XMP metadata.`);
            canaryFailures++;
            continue;
        }
        if (!expectClaim && claim !== null) {
            log(`Coverage canary: ${entry.file} claims ${claim.version} but the manifest expects no PDF/X claim.`);
            canaryFailures++;
            continue;
        }
        if (claim !== null) claimed.push({ name: entry.file, bytes, version: claim.version, expectCompliant: entry.expectPdfXCompliant !== false });
    }
    if (canaryFailures > 0) {
        log(`\nCoverage canary failed for ${String(canaryFailures)} of ${String(entries.length)} file(s).`);
        return PDFX_EXIT_CONFORMANCE;
    }
    const declared = declaredPdfxSamples();
    if (declared !== null && declared !== claimed.length) {
        log(`Coverage canary: ${String(claimed.length)} file(s) claim PDF/X but docs/assets/ecosystem.json declares pdfxSamples: ${String(declared)}.`);
        return PDFX_EXIT_CONFORMANCE;
    }
    const negatives = claimed.filter((c) => !c.expectCompliant).length;
    if (claimed.length === 0) {
        log('No PDF/X-claiming file in the corpus — nothing was validated.');
        return PDFX_EXIT_CONFORMANCE;
    }
    if (negatives === 0) {
        log('Negative canary missing: manifest.json has no PDF/X-claiming file with expectPdfXCompliant: false.');
        return PDFX_EXIT_CONFORMANCE;
    }
    note(`Corpus: ${String(claimed.length)} file(s) claim PDF/X (${String(negatives)} negative canar${negatives === 1 ? 'y' : 'ies'}); validator: pdfnative validatePdfX() (structural, ISO 15930-7).`);

    const counts: { -readonly [K in keyof PdfXCounts]: number } = { PASS: 0, FAIL: 0, XFAIL: 0, XPASS: 0 };
    const failures: { file: string; outcome: string; errors: readonly string[] }[] = [];
    const showErrors = (errors: readonly string[]): void => {
        const shown = errors.slice(0, quiet ? 3 : 6);
        for (const e of shown) say(`        - ${e}`);
        if (errors.length > shown.length) say(`        … (${String(errors.length - shown.length)} more)`);
    };

    for (const c of claimed) {
        const result = validatePdfX(c.bytes);
        const outcome = classifyPdfX(result.valid, c.expectCompliant);
        counts[outcome]++;
        const rel = `test-output/pdfa/${c.name}`;
        switch (outcome) {
            case 'PASS':
                if (!quiet) {
                    say(`  PASS   [${c.version}]  ${rel}${result.warnings.length > 0 ? `  (${String(result.warnings.length)} warning(s))` : ''}`);
                }
                break;
            case 'XFAIL':
                if (!quiet) { say(`  XFAIL  [${c.version}]  ${rel}  (negative canary rejected as expected)`); showErrors(result.errors); }
                break;
            case 'FAIL':
                failures.push({ file: c.name, outcome, errors: result.errors });
                say(`  FAIL   [${c.version}]  ${rel}`);
                showErrors(result.errors);
                break;
            case 'XPASS':
                failures.push({ file: c.name, outcome, errors: [] });
                say(`  XPASS  [${c.version}]  ${rel}  (negative canary ACCEPTED — the validator is not validating)`);
                break;
        }
    }

    const code = pdfxExitCodeFor(counts);
    if (json) {
        out(JSON.stringify({ claimed: claimed.length, compliant: counts.PASS, counts, failures, validator: 'pdfnative validatePdfX', ok: code === PDFX_EXIT_OK }, null, 2));
        return code;
    }
    say('');
    say(`Summary: ${String(counts.PASS)} PASS, ${String(counts.XFAIL)} XFAIL, ${String(counts.FAIL)} FAIL, ${String(counts.XPASS)} XPASS (of ${String(claimed.length)} validated).`);
    if (counts.XPASS > 0) say('XPASS: the negative canary was accepted — do not trust the PASS lines.');
    if (code === PDFX_EXIT_OK) say('All expectations met.');
    return code;
}

process.exit(main());
