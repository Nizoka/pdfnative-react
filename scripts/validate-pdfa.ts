#!/usr/bin/env tsx
/**
 * pdfnative-react — veraPDF batch validation runner (v1.3.0)
 * ===========================================================
 * Validates every PDF/A-claiming file in `test-output/pdfa/` (the corpus
 * written by scripts/generate-pdfa-corpus.ts) against the official veraPDF
 * reference validator (https://verapdf.org), using the profile each file
 * claims in its XMP (`pdfaid:part` + `pdfaid:conformance` → 1b / 2b / 2u /
 * 3b), and compares the outcome with the manifest's `expectCompliant` flag.
 *
 * Usage:
 *   npm run build && npm run corpus:pdfa && npm run validate:pdfa
 *   npx tsx scripts/validate-pdfa.ts [--quiet | --verbose] [--json]
 *
 * Requirements:
 *   - veraPDF CLI on PATH, or `VERAPDF_HOME` pointing at a veraPDF install
 *     (`verapdf` / `verapdf.bat` at the root or under `bin/`).
 *   - veraPDF is an external tool — never a dependency of pdfnative-react.
 *     The package's only runtime dependency stays `react-reconciler`
 *     (golden rule 1), and a validator is not an authoring concern.
 *
 * Environment:
 *   VERAPDF_HOME=<dir>       veraPDF install directory (optional, see above).
 *   VERAPDF_REPORT_DIR=<dir> where the raw per-file veraPDF XML reports go
 *                            (default test-output/pdfa/reports/). CI uploads it.
 *
 * Outcomes per claiming file (one line each on stdout):
 *   PASS   compliant, and the manifest expected compliance.
 *   FAIL   non-compliant (failing rule ids listed), manifest expected compliance.
 *   XFAIL  non-compliant as expected — a negative canary proving veraPDF rejects
 *          a file it must reject.
 *   XPASS  compliant although the manifest expects a failure: the validator is
 *          not validating ("accepts everything") — always fatal.
 *   INFRA  veraPDF did not produce a usable report for this file (crash, empty
 *          stdout, zero or several <validationReport> elements). Not a
 *          conformance verdict.
 *   SKIP   no PDF/A claim (the PDF/X-4 files) — never sent to veraPDF.
 *
 * Exit codes:
 *   0 — every expectation met; OR veraPDF is absent: install hints are
 *       printed and validation is SKIPPED (exit 0 is a skip, not a pass —
 *       `scripts/gate.ts --require-all` turns that skip into a failure on CI).
 *       (1.2.0's VERAPDF_REQUIRED=1 / exit 3 contract is retired in favour of
 *       the gate flag, as in the sibling repositories.)
 *   1 — a conformance expectation was not met (FAIL / XPASS), the corpus has no
 *       negative canary, or a coverage canary tripped (a manifest file is
 *       missing, its XMP claim disagrees with the manifest, or the number of
 *       claiming files differs from `declared.pdfaSamples` in
 *       docs/assets/ecosystem.json).
 *   2 — INFRA: the corpus directory / manifest is absent (run
 *       `npm run corpus:pdfa`), veraPDF is installed but cannot run (broken
 *       Java), at least one file produced no usable report, or bad usage.
 *
 * Windows: see runVeraPdf() in scripts/lib/verapdf.ts for the `.bat` quoting.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { REPO_ROOT, TEST_OUTPUT_DIR, parseOutputMode } from './helpers/io.js';
import {
    type CorpusManifest, type Counts, type PdfAClaim,
    EXIT_OK, EXIT_CONFORMANCE, EXIT_INFRA,
    locateVeraPdf, probeVeraPdf, runVeraPdf, detectPdfAClaim, parseReport, classify, exitCodeFor,
} from './lib/verapdf.js';

const CORPUS_DIR = join(TEST_OUTPUT_DIR, 'pdfa');
const MANIFEST = join(CORPUS_DIR, 'manifest.json');
const ECOSYSTEM = join(REPO_ROOT, 'docs', 'assets', 'ecosystem.json');
const REPORT_DIR = process.env.VERAPDF_REPORT_DIR ? resolve(process.env.VERAPDF_REPORT_DIR) : join(CORPUS_DIR, 'reports');

const log = (s: string): void => { process.stderr.write(`${s}\n`); };
const out = (s: string): void => { process.stdout.write(`${s}\n`); };

function printMissingVeraPdfHelp(): void {
    for (const l of [
        'veraPDF CLI not found.',
        '',
        '  pdfnative-react never bundles a validator — veraPDF is an external',
        '  tool. Install it locally to validate the PDF/A corpus, or use the',
        '  online demo at https://demo.verapdf.org for a one-off check.',
        '',
        '  Install hints:',
        '    macOS    : brew install --cask verapdf',
        '    Linux    : https://docs.verapdf.org/install/ → download zip → java -jar installer (headless install)',
        '    Windows  : https://docs.verapdf.org/install/ (GUI installer, ships verapdf.bat) or Chocolatey/Scoop',
        '',
        '  After install, expose it via PATH or set VERAPDF_HOME to the',
        '  install directory (the one containing `verapdf` or `verapdf.bat`).',
        '',
        '  See CONTRIBUTING.md §PDF/A and PDF/X validation.',
    ]) log(l);
}

interface Claiming {
    readonly file: string;
    readonly name: string;
    readonly claim: PdfAClaim;
    readonly expectCompliant: boolean;
}

interface Failure {
    readonly file: string;
    readonly profile: string;
    readonly outcome: string;
    readonly rules: readonly string[];
}

function declaredPdfaSamples(): number | null {
    if (!existsSync(ECOSYSTEM)) return null;
    const m = JSON.parse(readFileSync(ECOSYSTEM, 'utf8')) as { declared?: { pdfaSamples?: number } };
    return typeof m.declared?.pdfaSamples === 'number' ? m.declared.pdfaSamples : null;
}

function main(): number {
    const mode = parseOutputMode(process.argv.slice(2));
    if ('error' in mode) {
        log(mode.error);
        return EXIT_INFRA;
    }
    const { quiet, json } = mode;
    const say = (s: string): void => { if (!json) out(s); };
    const note = (s: string): void => { if (!json && !quiet) log(s); };

    if (!existsSync(CORPUS_DIR) || !existsSync(MANIFEST)) {
        log('No PDF/A corpus found in test-output/pdfa/. Run `npm run corpus:pdfa` first.');
        return EXIT_INFRA;
    }

    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CorpusManifest;
    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    const listed = entries.map((f) => f.file);

    // Coverage canary: every manifest entry must exist on disk, and its XMP
    // claim must match the manifest's expectation. Either drifting means the
    // corpus generator or the engine changed behaviour — fail loudly, never
    // shrink silently.
    const claimed: Claiming[] = [];
    const skipped: string[] = [];
    let canaryFailures = 0;
    for (const entry of entries) {
        const file = join(CORPUS_DIR, entry.file);
        if (!existsSync(file)) {
            log(`Coverage canary: ${entry.file} is listed in manifest.json but missing on disk.`);
            canaryFailures++;
            continue;
        }
        const claim = detectPdfAClaim(readFileSync(file).toString('latin1'));
        const expectClaim = entry.expectPdfAClaim !== false;
        if (expectClaim && claim === null) {
            log(`Coverage canary: ${entry.file} does not claim PDF/A in its XMP metadata.`);
            canaryFailures++;
            continue;
        }
        if (!expectClaim && claim !== null) {
            log(`Coverage canary: ${entry.file} now claims PDF/A-${claim.profile} but the manifest expects no claim.`);
            canaryFailures++;
            continue;
        }
        if (claim === null) skipped.push(entry.file);
        else claimed.push({ file, name: entry.file, claim, expectCompliant: entry.expectCompliant !== false });
    }
    const unlisted = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.pdf') && !listed.includes(f));
    if (unlisted.length > 0) {
        note(`Note: ${String(unlisted.length)} PDF(s) in test-output/pdfa/ are not in manifest.json and are ignored: ${unlisted.join(', ')}`);
    }
    if (listed.length === 0) {
        log('manifest.json lists no files. Run `npm run corpus:pdfa` first.');
        return EXIT_CONFORMANCE;
    }
    if (canaryFailures > 0) {
        log(`\nCoverage canary failed for ${String(canaryFailures)} of ${String(listed.length)} file(s).`);
        return EXIT_CONFORMANCE;
    }
    const declared = declaredPdfaSamples();
    if (declared !== null && declared !== claimed.length) {
        log(`Coverage canary: ${String(claimed.length)} file(s) claim PDF/A but docs/assets/ecosystem.json declares pdfaSamples: ${String(declared)}. Update the manifest in the same change as the corpus.`);
        return EXIT_CONFORMANCE;
    }
    const negatives = claimed.filter((c) => !c.expectCompliant);
    note(`Corpus: ${String(listed.length)} file(s) in manifest.json — ${String(claimed.length)} claim PDF/A (${String(negatives.length)} negative canar${negatives.length === 1 ? 'y' : 'ies'}), ${String(skipped.length)} file(s) without a claim (as expected).`);
    if (negatives.length === 0) {
        // Without a file veraPDF must reject, a validator that accepts
        // everything would be indistinguishable from a fully compliant corpus.
        log('Negative canary missing: manifest.json has no claiming file with expectCompliant: false. Regenerate the corpus.');
        return EXIT_CONFORMANCE;
    }

    const verapdf = locateVeraPdf();
    if (verapdf === null) {
        if (!json) printMissingVeraPdfHelp();
        if (json) {
            out(JSON.stringify({ skipped: true, reason: 'veraPDF not installed', claimed: claimed.length, compliant: 0, failures: [] }));
        } else {
            out('\nSKIPPED: veraPDF not installed — nothing was validated (exit 0 is a skip, not a pass; the gate\'s --require-all fails instead).');
        }
        return EXIT_OK;
    }
    const probe = probeVeraPdf(verapdf);
    if (!probe.ok) {
        log(`veraPDF at ${verapdf} could not be executed (is Java installed?): ${probe.detail}`);
        log('INFRA: veraPDF is installed but unusable — nothing was validated.');
        return EXIT_INFRA;
    }
    mkdirSync(REPORT_DIR, { recursive: true });
    note(`Using ${probe.detail} (${verapdf})`);
    note(`Raw reports → ${relative(REPO_ROOT, REPORT_DIR).split('\\').join('/')}/`);
    note(`Validating ${String(claimed.length)} file(s)…`);

    const counts: { -readonly [K in keyof Counts]: number } = { PASS: 0, FAIL: 0, XFAIL: 0, XPASS: 0, INFRA: 0 };
    const failures: Failure[] = [];
    const showRules = (rules: readonly string[]): void => {
        const shown = rules.slice(0, quiet ? 3 : 5);
        for (const rule of shown) say(`        - ${rule}`);
        if (rules.length > shown.length) say(`        … (${String(rules.length - shown.length)} more)`);
        if (rules.length === 0) say('        - (no failed <rule> elements in the report)');
    };

    for (const { file, name, claim, expectCompliant } of claimed) {
        const rel = relative(REPO_ROOT, file).split('\\').join('/');
        const reportBase = join(REPORT_DIR, name.replace(/\.pdf$/i, ''));
        // veraPDF prints XML to stdout. Its exit code is NOT the verdict (a
        // non-compliant file may still exit 0 or 1 depending on the version),
        // so the XML is always parsed; a missing / unparseable report is INFRA.
        const r = runVeraPdf(verapdf, ['--format', 'xml', '--flavour', claim.profile, file]);
        writeFileSync(`${reportBase}.xml`, r.stdout);
        if (r.stderr.trim().length > 0) writeFileSync(`${reportBase}.stderr.txt`, r.stderr);

        const parsed = r.error
            ? { kind: 'infra' as const, detail: `spawn failed: ${r.error}` }
            : r.stdout.trim().length === 0
                ? { kind: 'infra' as const, detail: `empty stdout (exit ${String(r.status)})` }
                : parseReport(r.stdout);

        if (parsed.kind === 'infra') {
            counts.INFRA++;
            failures.push({ file: name, profile: claim.profile, outcome: 'INFRA', rules: [parsed.detail] });
            say(`  INFRA  [${claim.profile}]  ${rel}  (${parsed.detail})`);
            for (const l of r.stderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 6)) say(`        ! ${l}`);
            continue;
        }
        if (r.stderr.trim()) {
            // veraPDF warnings (e.g. font parsing notes) are informational but must not vanish.
            for (const l of r.stderr.trim().split(/\r?\n/).slice(0, 3)) note(`  note  ${rel}: ${l}`);
        }
        const outcome = classify(parsed.compliant, expectCompliant);
        counts[outcome]++;
        switch (outcome) {
            case 'PASS':
                if (!quiet) say(`  PASS   [${claim.profile}]  ${rel}`);
                break;
            case 'XFAIL':
                if (!quiet) { say(`  XFAIL  [${claim.profile}]  ${rel}  (negative canary rejected as expected)`); showRules(parsed.failedRules); }
                break;
            case 'FAIL':
                failures.push({ file: name, profile: claim.profile, outcome, rules: parsed.failedRules });
                say(`  FAIL   [${claim.profile}]  ${rel}`);
                showRules(parsed.failedRules);
                break;
            case 'XPASS':
                failures.push({ file: name, profile: claim.profile, outcome, rules: [] });
                say(`  XPASS  [${claim.profile}]  ${rel}  (negative canary ACCEPTED — the validator is not validating)`);
                break;
        }
    }

    if (!quiet) for (const file of skipped) say(`  SKIP   [none]  test-output/pdfa/${file}  (no PDF/A claim)`);

    const code = exitCodeFor(counts);
    if (json) {
        out(JSON.stringify({
            claimed: claimed.length,
            compliant: counts.PASS,
            counts,
            skipped: skipped.length,
            failures,
            veraPdf: probe.detail,
            ok: code === EXIT_OK,
        }, null, 2));
        return code;
    }

    say('');
    say(`Summary: ${String(counts.PASS)} PASS, ${String(counts.XFAIL)} XFAIL, ${String(counts.FAIL)} FAIL, ${String(counts.XPASS)} XPASS, ${String(counts.INFRA)} INFRA, ${String(skipped.length)} SKIP (of ${String(claimed.length)} validated).`);
    if (counts.INFRA > 0) say('INFRA: veraPDF produced no usable report for some files — not a conformance verdict. See the raw reports.');
    if (counts.XPASS > 0) say('XPASS: a file that must be rejected was accepted — the validator accepts everything; do not trust the PASS lines.');
    if (code === EXIT_OK) say('All expectations met.');
    return code;
}

process.exit(main());
