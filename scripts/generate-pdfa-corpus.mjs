/**
 * pdfnative-react — PDF/A validation corpus generator
 * ===================================================
 * Renders 10 documents through the BUILT package (`dist/index.js` — the same
 * artefact npm ships, matching the ecosystem's "validate what ships"
 * principle) into `test-output/pdfa/`, and writes `manifest.json` describing
 * each file's expectations for `scripts/validate-pdfa.mjs`.
 *
 * Usage:  npm run corpus:pdfa   (runs after `npm run build` via validate:pdfa)
 *
 * Corpus design:
 *   - 8 positive entries covering all four engine conformance targets
 *     (pdfa1b / pdfa2b / pdfa2u / pdfa3b) through BOTH authoring doors —
 *     JSX (createElement, no transform needed) and DocSpec (renderSpecToFile)
 *     — including this release's headline features (Charts v2 dual axis,
 *     print production) under a PDF/A claim.
 *   - 2 NEGATIVE canaries, files veraPDF must REJECT:
 *       nofonts-pdfa2b.pdf — a PDF/A claim with no embedded fonts
 *         (ISO 19005-2 §6.2.11.4.1); mirrors lint rule L_TAGGED_NO_FONTS and
 *         the engine diagnostic PDFA_NO_FONT_ENTRIES.
 *       form-pdfa2b.pdf — a form field under PDF/A: the engine still writes a
 *         non-embedded /Helv for widget appearances even when fontEntries are
 *         supplied (the documented engine gap behind L_TAGGED_FORM_FONTS /
 *         PDFA_UNEMBEDDED_FORM_FONT). expectCompliant: false is self-expiring:
 *         the day the engine embeds /DR fonts, this flips to XPASS — which the
 *         validator treats as fatal — and the manifest gets updated on purpose.
 *   - Positive entries render with `layout.strict: true`, so any conformance
 *     diagnostic aborts generation instead of shipping a doomed corpus entry.
 *     Negative entries must NOT set strict (it would throw before bytes);
 *     their diagnostics are collected via `onDiagnostic` and printed as notes.
 *
 * The corpus is self-contained by design — it does not reuse `samples/`
 * (those are teaching material that imports `src/` via tsx; editing a sample
 * must never be able to break a release gate).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-output', 'pdfa');
const DIST = join(ROOT, 'dist', 'index.js');

const log = (s) => process.stderr.write(`${s}\n`);

if (!existsSync(DIST)) {
    log('dist/index.js not found — run `npm run build` first (or use `npm run validate:pdfa`, which builds).');
    process.exit(2);
}

// `pathToFileURL`, never string concatenation: a git-bash-style
// `file:///d/...` path throws ERR_INVALID_FILE_URL_PATH on Windows.
const lib = await import(pathToFileURL(DIST).href);
const {
    Chart,
    Document,
    FormField,
    Heading,
    Paragraph,
    Section,
    Table,
    renderToFile,
    renderSpecToFile,
    resolveFonts,
} = lib;
const { createElement: h } = await import('react');

// One resolved font set for every entry that embeds fonts. PDF/A requires
// every rendering font embedded; Noto Sans ships with the engine peer.
const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const STRICT = { strict: true };

/** JSX-door document builders (plain createElement — no JSX transform). */
const jsxDocs = {
    'jsx-pdfa2b-report.pdf': () =>
        h(
            Document,
            { title: 'Corpus report', tagged: 'pdfa2b', fontEntries, layout: STRICT },
            h(Heading, { level: 1 }, 'Quarterly report'),
            h(Paragraph, null, 'Revenue grew in every region this quarter.'),
            h(
                Section,
                { title: 'Regional figures' },
                h(Table, {
                    headers: ['Region', 'Revenue'],
                    rows: [
                        { cells: ['North', '12k'], type: 'default', pointed: false },
                        { cells: ['South', '31k'], type: 'default', pointed: false },
                    ],
                    zebra: true,
                    repeatHeader: true,
                }),
            ),
        ),
    'jsx-pdfa2b-chart-axis2.pdf': () =>
        h(
            Document,
            { title: 'Corpus chart', tagged: 'pdfa2b', fontEntries, layout: STRICT },
            h(Heading, { level: 1 }, 'Revenue and margin'),
            h(Chart, {
                chartType: 'line',
                categories: ['Q1', 'Q2', 'Q3', 'Q4'],
                series: [
                    { label: 'Revenue (k)', values: [210, 245, 262, 300] },
                    { label: 'Margin (%)', values: [12.1, 13.4, 15.2, 16.0], yAxis: 'right' },
                ],
                axis2: { yMin: 0, yMax: 20 },
                dataLabels: { decimals: 1 },
                altText: 'Revenue and margin both rise across the year.',
            }),
        ),
    'jsx-pdfa3b-attachment.pdf': () =>
        h(
            Document,
            {
                title: 'Corpus attachment',
                tagged: 'pdfa3b',
                fontEntries,
                watermark: 'ARCHIVE',
                header: { left: 'pdfnative-react corpus', right: '{date}' },
                footer: { center: 'Page {page} of {pages}' },
                attachments: [
                    {
                        filename: 'invoice.xml',
                        data: new TextEncoder().encode('<invoice><total>42.00</total></invoice>'),
                        mimeType: 'application/xml',
                        description: 'Machine-readable source data',
                        relationship: 'Data',
                    },
                ],
                layout: STRICT,
            },
            h(Heading, { level: 1 }, 'Invoice with embedded source'),
            h(Paragraph, null, 'PDF/A-3 permits embedded files; the XML source rides along.'),
        ),
    'jsx-pdfa1b-minimal.pdf': () =>
        h(
            Document,
            { title: 'Corpus minimal', tagged: 'pdfa1b', fontEntries, layout: STRICT },
            h(Heading, { level: 1 }, 'Archival minimal'),
            h(Paragraph, null, 'The oldest, strictest target: PDF 1.4, no transparency.'),
            h(Table, {
                headers: ['Key', 'Value'],
                rows: [{ cells: ['Target', 'PDF/A-1b'], type: 'default', pointed: false }],
            }),
        ),
    'jsx-pdfa2b-print.pdf': () =>
        h(
            Document,
            {
                title: 'Corpus print production',
                tagged: 'pdfa2b',
                fontEntries,
                print: { bleed: 9, marks: true },
                metadata: { trapped: 'False' },
                layout: STRICT,
            },
            h(Heading, { level: 1 }, 'Print-ready archival'),
            h(Paragraph, null, 'Bleed, printer’s marks and /Trapped coexist with the claim.'),
        ),
    'nofonts-pdfa2b.pdf': () =>
        h(
            Document,
            // NEGATIVE canary: same shape as the report entry but with no
            // fontEntries and no strict (strict would throw before bytes).
            // The engine falls back to unembedded base-14 fonts while still
            // stamping the pdfaid claim — exactly what veraPDF must reject.
            { title: 'Corpus negative: no fonts', tagged: 'pdfa2b', layout: { onDiagnostic: noteDiagnostic } },
            h(Heading, { level: 1 }, 'Deliberately non-conformant'),
            h(Paragraph, null, 'A PDF/A claim with no embedded fonts fails ISO 19005-2 6.2.11.4.1.'),
        ),
};

/** DocSpec-door specs (the second authoring surface — pure JSON tuples). */
const specDocs = {
    'spec-pdfa2b-blocks.pdf': {
        title: 'Corpus spec blocks',
        tagged: 'pdfa2b',
        fontEntries,
        outline: 'auto',
        layout: STRICT,
        blocks: [
            ['toc', { title: 'Contents' }],
            ['h1', 'Spec-authored document'],
            ['p', 'This file was authored as a DocSpec, the token-frugal agent grammar.'],
            ['h2', 'Details'],
            ['ul', ['Tagged output', 'Auto outline', 'Table of contents']],
            ['table', { h: ['Door', 'Status'], r: [['DocSpec', 'covered']] }],
        ],
    },
    'spec-pdfa2u-unicode.pdf': {
        title: 'Corpus spec unicode',
        tagged: 'pdfa2u',
        fontEntries,
        layout: STRICT,
        blocks: [
            ['h1', 'Unicode mapping'],
            ['p', 'Accented Latin — déjà vu, façade, naïve — and punctuation: “quotes”, …, –, —.'],
            ['p', 'PDF/A-2u additionally requires every glyph to map to Unicode.'],
        ],
    },
    'spec-pdfa2b-barcode.pdf': {
        title: 'Corpus spec barcode',
        tagged: 'pdfa2b',
        fontEntries,
        layout: STRICT,
        blocks: [
            ['h1', 'Vector barcodes'],
            ['qr', 'https://pdfnative.dev', { width: 120 }],
            ['code128', 'CORPUS-1200', { height: 48 }],
            ['p', 'Barcodes are drawn as pure vector operators — PDF/A-safe.'],
        ],
    },
    'form-pdfa2b.pdf': {
        title: 'Corpus negative: form field',
        tagged: 'pdfa2b',
        fontEntries,
        // NEGATIVE canary — no strict: the engine renders the widget through
        // a non-embedded /Helv (its documented gap) and warns via the
        // diagnostics channel; veraPDF must reject the file.
        layout: { onDiagnostic: noteDiagnostic },
        blocks: [
            ['h1', 'Form under PDF/A'],
            ['field', { fieldType: 'text', name: 'fullName', label: 'Full name' }],
            ['field', { fieldType: 'checkbox', name: 'consent', label: 'I agree', checked: false }],
        ],
    },
};

const diagnostics = [];
function noteDiagnostic(d) {
    diagnostics.push(d.code);
}

/** entry-description + expectations per file (validator reads the last three). */
const EXPECTATIONS = {
    'jsx-pdfa2b-report.pdf': { entry: 'renderToFile(createElement) — pdfa2b, fonts latin, strict', expectCompliant: true },
    'jsx-pdfa2b-chart-axis2.pdf': { entry: 'renderToFile(createElement) — Charts v2 dual axis under pdfa2b, strict', expectCompliant: true },
    'jsx-pdfa3b-attachment.pdf': { entry: 'renderToFile(createElement) — pdfa3b attachment + page furniture, strict', expectCompliant: true },
    'jsx-pdfa1b-minimal.pdf': { entry: 'renderToFile(createElement) — pdfa1b minimal, strict', expectCompliant: true },
    'jsx-pdfa2b-print.pdf': { entry: 'renderToFile(createElement) — print production (bleed + marks) under pdfa2b, strict', expectCompliant: true },
    'nofonts-pdfa2b.pdf': { entry: 'renderToFile(createElement) — NEGATIVE: pdfa2b claim, no embedded fonts (ISO 19005-2 6.2.11.4.1)', expectCompliant: false },
    'spec-pdfa2b-blocks.pdf': { entry: 'renderSpecToFile — toc/outline/list/table under pdfa2b, strict', expectCompliant: true },
    'spec-pdfa2u-unicode.pdf': { entry: 'renderSpecToFile — pdfa2u Unicode mapping, strict', expectCompliant: true },
    'spec-pdfa2b-barcode.pdf': { entry: 'renderSpecToFile — qr + code128 under pdfa2b, strict', expectCompliant: true },
    'form-pdfa2b.pdf': { entry: "renderSpecToFile — ['field'] under pdfa2b (KNOWN engine /Helv gap, negative canary)", expectCompliant: false },
};

// ── Generate ─────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

// Prune PDFs from previous runs so a renamed entry cannot linger as an
// unlisted stray the validator would merely note.
for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.pdf')) rmSync(join(OUT_DIR, f));
}

const files = [];
const allNames = [...Object.keys(jsxDocs), ...Object.keys(specDocs)];

for (const name of allNames) {
    const outPath = join(OUT_DIR, name);
    diagnostics.length = 0;
    try {
        if (name in jsxDocs) {
            await renderToFile(jsxDocs[name](), outPath);
        } else {
            await renderSpecToFile(specDocs[name], outPath);
        }
    } catch (err) {
        log(`Corpus entry ${name} failed to render: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
    if (!existsSync(outPath)) {
        log(`Corpus entry ${name} produced no file.`);
        process.exit(1);
    }
    const bytes = readFileSync(outPath);
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        log(`Corpus entry ${name} is not a PDF (bad magic).`);
        process.exit(1);
    }
    if (diagnostics.length > 0) {
        log(`  note ${name}: engine diagnostics ${[...new Set(diagnostics)].join(', ')} (expected on negative canaries)`);
    }
    const exp = EXPECTATIONS[name];
    files.push({ file: name, entry: exp.entry, bytes: bytes.byteLength, expectPdfAClaim: true, expectCompliant: exp.expectCompliant });
    log(`  wrote ${name} (${bytes.byteLength} bytes)`);
}

const negatives = files.filter((f) => !f.expectCompliant).length;
writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify({ generatedBy: 'scripts/generate-pdfa-corpus.mjs', files }, null, 2)}\n`,
);
log(`Corpus complete: ${files.length} file(s), ${negatives} negative canar${negatives === 1 ? 'y' : 'ies'} → test-output/pdfa/`);
