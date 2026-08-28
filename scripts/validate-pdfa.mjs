/**
 * pdfnative-react — veraPDF batch validation runner
 * =================================================
 * Validates every PDF in `test-output/pdfa/` (the corpus written by
 * scripts/generate-pdfa-corpus.mjs) against the official veraPDF reference
 * validator (https://verapdf.org), using the PDF/A profile each file claims in
 * its XMP metadata (`pdfaid:part` + `pdfaid:conformance` → 1b / 2b / 2u / 3b),
 * and compares the outcome with the manifest's `expectCompliant` flag.
 *
 * Usage:
 *   npm run validate:pdfa                # build + corpus + validate
 *   node scripts/validate-pdfa.mjs       # validate an existing corpus only
 *
 * Requirements:
 *   - veraPDF CLI on PATH, or `VERAPDF_HOME` pointing at a veraPDF install
 *     (`verapdf` / `verapdf.bat` at the root or under `bin/`).
 *   - veraPDF is an external tool — never a dependency of pdfnative-react.
 *     The package's only runtime dependency stays `react-reconciler`
 *     (golden rule 1), and a validator is not an authoring concern.
 *
 * Environment:
 *   VERAPDF_HOME=<dir>      veraPDF install directory (optional, see above).
 *   VERAPDF_REQUIRED=1      fail-closed: a missing veraPDF / Java, a crash, or an
 *                           unparseable report is an INFRA failure (exit 3)
 *                           instead of a skip. Set in CI; unset locally so a
 *                           machine without veraPDF never blocks.
 *   VERAPDF_REPORT_DIR=<dir> where the raw per-file veraPDF XML reports go
 *                           (default test-output/pdfa/reports/). CI uploads it.
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
 *   SKIP   no PDF/A claim (`expectPdfAClaim: false` outputs) — never sent to
 *          veraPDF. (pdfnative-react authors documents and performs no
 *          page-tree surgery, so its corpus has none today; the field is kept
 *          so the manifest schema stays identical across the ecosystem.)
 *
 * Exit codes:
 *   0 — every expectation met (or veraPDF is absent and VERAPDF_REQUIRED is
 *       unset: install hints are printed and validation is SKIPPED — exit 0 is
 *       a skip, not a pass).
 *   1 — a conformance expectation was not met (FAIL / XPASS), the corpus has no
 *       negative canary, or the coverage canary tripped (a manifest file is
 *       missing, or its XMP claim disagrees with the manifest).
 *   2 — the corpus directory / manifest is absent (run `npm run corpus:pdfa`).
 *   3 — INFRA: veraPDF unusable (only with VERAPDF_REQUIRED=1), or at least one
 *       file produced an INFRA outcome.
 *
 * Windows: a `.bat` launcher cannot be spawned without a shell (Node rejects it
 * with EINVAL since the CVE-2024-27980 hardening); shell mode performs no
 * escaping, so every argument is quoted explicitly.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = join(ROOT, 'test-output', 'pdfa');
const MANIFEST = join(CORPUS_DIR, 'manifest.json');
const REPORT_DIR = process.env.VERAPDF_REPORT_DIR ? resolve(process.env.VERAPDF_REPORT_DIR) : join(CORPUS_DIR, 'reports');
const REQUIRED = process.env.VERAPDF_REQUIRED === '1' || process.env.VERAPDF_REQUIRED === 'true';

const EXIT_OK = 0;
const EXIT_CONFORMANCE = 1;
const EXIT_NO_CORPUS = 2;
const EXIT_INFRA = 3;

const log = (s) => process.stderr.write(`${s}\n`);
const out = (s) => process.stdout.write(`${s}\n`);

// ── Locate veraPDF CLI ──────────────────────────────────────────────

function locateVeraPdf() {
    const home = process.env.VERAPDF_HOME;
    if (home) {
        const candidates = [join(home, 'verapdf'), join(home, 'verapdf.bat'), join(home, 'bin', 'verapdf'), join(home, 'bin', 'verapdf.bat')];
        for (const c of candidates) {
            if (existsSync(c)) return c;
        }
    }
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['verapdf'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout) {
        return probe.stdout.trim().split(/\r?\n/)[0];
    }
    return null;
}

/** Run `verapdf --version`; returns the version line or an error string (never throws). */
function probeVeraPdf(verapdf) {
    const r = runVeraPdf(verapdf, ['--version']);
    if (r.error) return { ok: false, detail: r.error };
    const line = (r.stdout || '').split(/\r?\n/).find((l) => /verapdf/i.test(l));
    if (r.status !== 0 || !line) {
        return { ok: false, detail: `exit ${r.status}; stderr: ${(r.stderr || '').trim().slice(0, 400) || '(empty)'}` };
    }
    return { ok: true, detail: line.trim() };
}

function runVeraPdf(verapdf, args) {
    const isBatch = /\.(bat|cmd)$/i.test(verapdf);
    const quote = (s) => (isBatch ? `"${s}"` : s);
    const r = spawnSync(quote(verapdf), args.map(quote), {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isBatch,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ? String(r.error.message ?? r.error) : null };
}

// ── PDF/A claim detection (XMP) ─────────────────────────────────────

/** Returns `{ part, conformance, profile }` or null when the file does not claim PDF/A. */
function detectPdfAClaim(file) {
    const txt = readFileSync(file).toString('latin1');
    const part = txt.match(/<pdfaid:part>(\d)<\/pdfaid:part>/)?.[1];
    const conf = txt.match(/<pdfaid:conformance>([A-Z])<\/pdfaid:conformance>/)?.[1];
    if (!part || !conf) return null;
    return { part: Number.parseInt(part, 10), conformance: conf, profile: `${part}${conf.toLowerCase()}` };
}

// ── veraPDF invocation + report parsing ─────────────────────────────

/**
 * Parse ONE veraPDF XML report. We run veraPDF with exactly one input file, so
 * the report must contain exactly one <validationReport …> element; anything
 * else (none, several) is an INFRA outcome rather than a verdict. The
 * `isCompliant` attribute is read from that element only — never matched
 * globally across the document.
 */
function parseReport(xml) {
    const reports = Array.from(xml.matchAll(/<validationReport\b([^>]*)>/g));
    if (reports.length !== 1) {
        return { kind: 'infra', detail: `expected exactly one <validationReport>, found ${reports.length}` };
    }
    const attrs = reports[0][1];
    const compliant = /\bisCompliant="(true|false)"/.exec(attrs)?.[1];
    if (compliant === undefined) {
        return { kind: 'infra', detail: '<validationReport> has no isCompliant attribute' };
    }
    const flavour = /\bprofileName="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const failedRules = Array.from(
        xml.matchAll(/<rule\b[^>]*\bspecification="[^"]*"[^>]*\bclause="([^"]+)"[^>]*\btestNumber="([^"]+)"[^>]*\bstatus="failed"/gi),
    ).map((m) => `${m[1]} t${m[2]}`);
    return { kind: 'verdict', compliant: compliant === 'true', flavour, failedRules: Array.from(new Set(failedRules)) };
}

function validateFile(verapdf, file, profile, reportBase) {
    // veraPDF prints XML to stdout. Its exit code is NOT the verdict (a
    // non-compliant file may still exit 0 or 1 depending on the version), so
    // the XML is always parsed; a missing / unparseable report is INFRA.
    const r = runVeraPdf(verapdf, ['--format', 'xml', '--flavour', profile, file]);
    writeFileSync(`${reportBase}.xml`, r.stdout);
    if (r.stderr.trim().length > 0) writeFileSync(`${reportBase}.stderr.txt`, r.stderr);
    if (r.error) return { kind: 'infra', detail: `spawn failed: ${r.error}`, stderr: r.stderr };
    if (r.stdout.trim().length === 0) {
        return { kind: 'infra', detail: `empty stdout (exit ${r.status})`, stderr: r.stderr };
    }
    return { ...parseReport(r.stdout), stderr: r.stderr, exit: r.status };
}

// ── Main ─────────────────────────────────────────────────────────────

function printMissingVeraPdfHelp() {
    const lines = [
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
        '  See CONTRIBUTING.md.',
    ];
    for (const l of lines) log(l);
}

function infraExit(reason) {
    out(`  INFRA  ${reason}`);
    out('\nveraPDF infrastructure failure (VERAPDF_REQUIRED=1): nothing was validated.');
    return EXIT_INFRA;
}

function main() {
    if (!existsSync(CORPUS_DIR) || !existsSync(MANIFEST)) {
        log('No PDF/A corpus found in test-output/pdfa/. Run `npm run corpus:pdfa` first.');
        return EXIT_NO_CORPUS;
    }

    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    const listed = entries.map((f) => f.file);

    // Coverage canary: every manifest entry must exist on disk, and its XMP
    // claim must match the manifest's expectation. Either drifting means the
    // corpus generator or the engine changed behaviour — fail loudly, never
    // shrink silently.
    const claimed = [];
    const skipped = [];
    let canaryFailures = 0;
    for (const entry of entries) {
        const name = entry.file;
        const file = join(CORPUS_DIR, name);
        if (!existsSync(file)) {
            log(`Coverage canary: ${name} is listed in manifest.json but missing on disk.`);
            canaryFailures++;
            continue;
        }
        const claim = detectPdfAClaim(file);
        const expectClaim = entry.expectPdfAClaim !== false;
        if (expectClaim && claim === null) {
            log(`Coverage canary: ${name} does not claim PDF/A in its XMP metadata.`);
            canaryFailures++;
            continue;
        }
        if (!expectClaim && claim !== null) {
            log(`Coverage canary: ${name} now claims PDF/A-${claim.profile} but the manifest expects no claim.`);
            canaryFailures++;
            continue;
        }
        if (claim === null) skipped.push(file);
        else claimed.push({ file, name, claim, expectCompliant: entry.expectCompliant !== false });
    }
    const unlisted = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.pdf') && !listed.includes(f));
    if (unlisted.length > 0) {
        log(`Note: ${unlisted.length} PDF(s) in test-output/pdfa/ are not in manifest.json and are ignored: ${unlisted.join(', ')}`);
    }
    if (listed.length === 0) {
        log('manifest.json lists no files. Run `npm run corpus:pdfa` first.');
        return EXIT_CONFORMANCE;
    }
    if (canaryFailures > 0) {
        log(`\nCoverage canary failed for ${canaryFailures} of ${listed.length} file(s).`);
        return EXIT_CONFORMANCE;
    }
    const negatives = claimed.filter((c) => !c.expectCompliant);
    log(
        `Corpus: ${listed.length} file(s) in manifest.json — ${claimed.length} claim PDF/A (${negatives.length} negative canar${negatives.length === 1 ? 'y' : 'ies'}), ${skipped.length} file(s) without a claim (as expected).`,
    );
    if (negatives.length === 0) {
        // Without a file veraPDF must reject, a validator that accepts
        // everything would be indistinguishable from a fully compliant corpus.
        log('Negative canary missing: manifest.json has no claiming file with expectCompliant: false. Regenerate the corpus.');
        return EXIT_CONFORMANCE;
    }

    const verapdf = locateVeraPdf();
    if (!verapdf) {
        printMissingVeraPdfHelp();
        if (REQUIRED) return infraExit('veraPDF CLI not found (PATH / VERAPDF_HOME)');
        out('\nSKIPPED: veraPDF not installed — nothing was validated (exit 0 is a skip, not a pass; set VERAPDF_REQUIRED=1 to fail instead).');
        return EXIT_OK;
    }
    const probe = probeVeraPdf(verapdf);
    if (!probe.ok) {
        log(`veraPDF at ${verapdf} could not be executed (is Java installed?): ${probe.detail}`);
        if (REQUIRED) return infraExit(`veraPDF launcher unusable: ${probe.detail}`);
        out('\nSKIPPED: veraPDF launcher unusable — nothing was validated (exit 0 is a skip, not a pass; set VERAPDF_REQUIRED=1 to fail instead).');
        return EXIT_OK;
    }
    mkdirSync(REPORT_DIR, { recursive: true });
    log(`Using ${probe.detail} (${verapdf})${REQUIRED ? ' — VERAPDF_REQUIRED=1 (fail-closed)' : ''}`);
    log(`Raw reports → ${relative(ROOT, REPORT_DIR).split('\\').join('/')}/`);
    log(`Validating ${claimed.length} file(s)…`);

    const counts = { PASS: 0, FAIL: 0, XFAIL: 0, XPASS: 0, INFRA: 0 };
    const showRules = (rules) => {
        const shown = rules.slice(0, 5);
        for (const rule of shown) out(`        - ${rule}`);
        if (rules.length > shown.length) out(`        … (${rules.length - shown.length} more)`);
        if (rules.length === 0) out('        - (no failed <rule> elements in the report)');
    };
    for (const { file, name, claim, expectCompliant } of claimed) {
        const rel = relative(ROOT, file).split('\\').join('/');
        const result = validateFile(verapdf, file, claim.profile, join(REPORT_DIR, name.replace(/\.pdf$/i, '')));
        if (result.kind === 'infra') {
            counts.INFRA++;
            out(`  INFRA  [${claim.profile}]  ${rel}  (${result.detail})`);
            if (result.stderr.trim()) {
                for (const l of result.stderr.trim().split(/\r?\n/).slice(0, 6)) out(`        ! ${l}`);
            }
            continue;
        }
        if (result.stderr.trim()) {
            // veraPDF warnings (e.g. font parsing notes) are informational but must not vanish.
            for (const l of result.stderr.trim().split(/\r?\n/).slice(0, 3)) log(`  note  ${rel}: ${l}`);
        }
        if (result.compliant && expectCompliant) {
            counts.PASS++;
            out(`  PASS   [${claim.profile}]  ${rel}`);
        } else if (!result.compliant && !expectCompliant) {
            counts.XFAIL++;
            out(`  XFAIL  [${claim.profile}]  ${rel}  (negative canary rejected as expected)`);
            showRules(result.failedRules);
        } else if (!result.compliant) {
            counts.FAIL++;
            out(`  FAIL   [${claim.profile}]  ${rel}`);
            showRules(result.failedRules);
        } else {
            counts.XPASS++;
            out(`  XPASS  [${claim.profile}]  ${rel}  (negative canary ACCEPTED — the validator is not validating)`);
        }
    }

    for (const file of skipped) {
        out(`  SKIP   [none]  ${relative(ROOT, file).split('\\').join('/')}  (no PDF/A claim)`);
    }

    out('');
    out(`Summary: ${counts.PASS} PASS, ${counts.XFAIL} XFAIL, ${counts.FAIL} FAIL, ${counts.XPASS} XPASS, ${counts.INFRA} INFRA, ${skipped.length} SKIP (of ${claimed.length} validated).`);
    if (counts.INFRA > 0) {
        out('INFRA: veraPDF produced no usable report for some files — not a conformance verdict. See the raw reports.');
        return EXIT_INFRA;
    }
    if (counts.XPASS > 0) {
        out('XPASS: a file that must be rejected was accepted — the validator accepts everything; do not trust the PASS lines.');
        return EXIT_CONFORMANCE;
    }
    if (counts.FAIL > 0) return EXIT_CONFORMANCE;
    out('All expectations met.');
    return EXIT_OK;
}

process.exit(main());
