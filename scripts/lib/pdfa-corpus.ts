/**
 * pdfnative-react — the conformance corpus (PDF/A + PDF/X)
 * =========================================================
 * One table drives scripts/generate-pdfa-corpus.ts; `derived.corpusFiles` in
 * docs/assets/ecosystem.json is its length, `declared.pdfaSamples` and
 * `declared.pdfxSamples` the number of claiming files per standard.
 *
 * Every entry renders through the BUILT package (`dist/index.js` — the same
 * artefact npm ships, matching the ecosystem's "validate what ships"
 * principle) through one of the two authoring doors: `jsx` (createElement, no
 * transform needed) or `spec` (a DocSpec). `scripts/validate-pdfa.ts` then
 * runs the PDF/A files through veraPDF and `scripts/validate-pdfx.ts` runs the
 * PDF/X files through pdfnative's validatePdfX().
 *
 * Corpus design:
 *   - Positive PDF/A entries cover all four engine conformance targets
 *     (pdfa1b / pdfa2b / pdfa2u / pdfa3b) through both doors — Charts v2, print
 *     production, attachments, barcodes, Unicode, forms, and (1.3.0) CMYK
 *     content under a CMYK output intent, and the typography engine.
 *     form-pdfa2b.pdf (form fields WITH embedded fontEntries, no field values)
 *     is a deliberate positive: the engine's PDFA_UNEMBEDDED_FORM_FONT
 *     diagnostic fires conservatively because the AcroForm /DA references
 *     /Helv, but veraPDF 1.30.2 accepts the file — established by this repo's
 *     first blocking CI run, where the original expectCompliant:false tripped
 *     the fatal XPASS guard exactly as designed.
 *   - NEGATIVE PDF/A canaries, files veraPDF must REJECT (ISO 19005-2
 *     §6.2.11.4.1 — text rendered through unembedded fonts — via two content
 *     paths): nofonts-pdfa2b.pdf (plain text, mirrors L_TAGGED_NO_FONTS and
 *     PDFA_NO_FONT_ENTRIES) and form-nofonts-pdfa2b.pdf (form fields and page
 *     text, the AcroForm path).
 *   - PDF/X-4 entries (1.3.0): a CMYK press sheet through the JSX door, a Gray
 *     output intent through the DocSpec door, and one NEGATIVE canary with no
 *     embedded fonts (PDFX_NO_FONT_ENTRIES) that validatePdfX() must reject.
 *   - Positive entries render with `layout.strict: true`, so any conformance
 *     diagnostic aborts generation instead of shipping a doomed corpus entry.
 *     Negative entries must NOT set strict (it would throw before bytes);
 *     their diagnostics are collected via `onDiagnostic` and printed as notes.
 *
 * Reproducibility: every entry pins `creationDate` to the instant in
 * scripts/helpers/io.ts, so the manifest's sha256 column is diffable.
 *
 * The corpus is self-contained by design — it does not reuse `samples/`
 * (those are teaching material that imports `src/` via tsx; editing a sample
 * must never be able to break a release gate).
 */

import { join } from 'node:path';
import type { ReactElement } from 'react';

import { SAMPLE_CREATION_DATE, TEST_OUTPUT_DIR } from '../helpers/io.js';
import { buildSyntheticCmykProfile, buildSyntheticGrayProfile } from './synthetic-icc.js';

/** The built package, as `scripts/generate-pdfa-corpus.ts` imports it. */
export type BuiltPackage = typeof import('../../src/index.js');
export type DocSpec = import('../../src/index.js').DocSpec;

export const OUT_DIR = join(TEST_OUTPUT_DIR, 'pdfa');

export type Claim = 'pdfa' | 'pdfx' | 'none';
export type Door = 'jsx' | 'spec';

export interface CorpusContext {
    /** The built package (`dist/index.js`). */
    readonly lib: BuiltPackage;
    /** `React.createElement`, for the JSX door without a transform. */
    readonly h: typeof import('react').createElement;
    /** Noto Sans, resolved once through the built package. */
    readonly fontEntries: BuiltPackage extends { resolveFonts: (m: never) => Promise<infer T> } ? T : never;
    /** Collects engine diagnostics on the negative canaries (printed as notes). */
    readonly noteDiagnostic: import('../../src/index.js').PdfDiagnosticHandler;
}

export interface CorpusEntry {
    readonly file: string;
    /** The authoring door the file is rendered through. */
    readonly door: Door;
    /** Which standard the output claims in its XMP. */
    readonly claims: Claim;
    /** Default true; false marks a negative canary. */
    readonly expectCompliant?: boolean;
    /** One line for the manifest and the validator's report. */
    readonly entry: string;
    /** The document: a React element (jsx door) or a DocSpec (spec door). */
    readonly produce: (ctx: CorpusContext) => ReactElement | DocSpec;
}

/** The standard an entry claims. */
export function claimOf(entry: CorpusEntry): Claim {
    return entry.claims;
}

const STRICT = { strict: true, creationDate: SAMPLE_CREATION_DATE };
const LENIENT = (ctx: CorpusContext) => ({ onDiagnostic: ctx.noteDiagnostic, creationDate: SAMPLE_CREATION_DATE });

/** Synthetic output ('prtr') intents: no press profile is bundled, and these characterise no device. */
const CMYK_INTENT = { iccProfile: buildSyntheticCmykProfile(), outputConditionIdentifier: 'Synthetic CMYK (pdfnative-react test profile)' } as const;
const GRAY_INTENT = { iccProfile: buildSyntheticGrayProfile(), outputConditionIdentifier: 'Synthetic Gray (pdfnative-react test profile)' } as const;

const BLEED = 14.17; // 5 mm — enough for colour bars

export const CORPUS: readonly CorpusEntry[] = [
    // ── PDF/A, JSX door ────────────────────────────────────────────
    {
        file: 'jsx-pdfa2b-report.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — pdfa2b, fonts latin, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                { title: 'Corpus report', tagged: 'pdfa2b', fontEntries, layout: STRICT },
                h(lib.Heading, { level: 1 }, 'Quarterly report'),
                h(lib.Paragraph, null, 'Revenue grew in every region this quarter.'),
                h(
                    lib.Section,
                    { title: 'Regional figures' },
                    h(lib.Table, {
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
    },
    {
        file: 'jsx-pdfa2b-chart-axis2.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — Charts v2 dual axis under pdfa2b, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                { title: 'Corpus chart', tagged: 'pdfa2b', fontEntries, layout: STRICT },
                h(lib.Heading, { level: 1 }, 'Revenue and margin'),
                h(lib.Chart, {
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
    },
    {
        file: 'jsx-pdfa3b-attachment.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — pdfa3b attachment + page furniture, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
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
                h(lib.Heading, { level: 1 }, 'Invoice with embedded source'),
                h(lib.Paragraph, null, 'PDF/A-3 permits embedded files; the XML source rides along.'),
            ),
    },
    {
        file: 'jsx-pdfa1b-minimal.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — pdfa1b minimal, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                { title: 'Corpus minimal', tagged: 'pdfa1b', fontEntries, layout: STRICT },
                h(lib.Heading, { level: 1 }, 'Archival minimal'),
                h(lib.Paragraph, null, 'The oldest, strictest target: PDF 1.4, no transparency.'),
                h(lib.Table, {
                    headers: ['Key', 'Value'],
                    rows: [{ cells: ['Target', 'PDF/A-1b'], type: 'default', pointed: false }],
                }),
            ),
    },
    {
        file: 'jsx-pdfa2b-print.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — print production (bleed + marks) under pdfa2b, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                {
                    title: 'Corpus print production',
                    tagged: 'pdfa2b',
                    fontEntries,
                    print: { bleed: 9, marks: true },
                    metadata: { trapped: 'False' },
                    layout: STRICT,
                },
                h(lib.Heading, { level: 1 }, 'Print-ready archival'),
                h(lib.Paragraph, null, 'Bleed, printer’s marks and /Trapped coexist with the claim.'),
            ),
    },
    {
        file: 'jsx-pdfa2b-cmyk.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — CMYK colours under a CMYK output intent, pdfa2b, strict (1.8.0)',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                {
                    title: 'Corpus CMYK archival',
                    tagged: 'pdfa2b',
                    fontEntries,
                    outputIntent: CMYK_INTENT,
                    layout: STRICT,
                },
                h(lib.Heading, { level: 1, color: [0, 0, 0, 100] }, 'Ink on paper'),
                h(lib.Paragraph, { color: '0 1 1 0' }, 'DeviceCMYK content under a CMYK OutputIntent is archival-safe.'),
                h(lib.Table, {
                    headers: ['Plate', 'Coverage'],
                    rows: [{ cells: ['Cyan', '100 %'], type: 'default', pointed: false }],
                    zebra: [0, 0, 0, 8],
                }),
            ),
    },
    {
        file: 'jsx-pdfa2b-typography.pdf',
        door: 'jsx',
        claims: 'pdfa',
        entry: 'renderToFile(createElement) — the typography engine (split paragraphs, justify, kerning, features) under pdfa2b, strict (1.8.0)',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                {
                    title: 'Corpus typography',
                    tagged: 'pdfa2b',
                    fontEntries,
                    typography: {
                        splitParagraphs: true,
                        keepHeadingsWithNext: true,
                        unitBinding: true,
                        opticalMargins: true,
                        kerning: true,
                        fontFeatures: ['smcp'],
                    },
                    layout: STRICT,
                },
                h(lib.Heading, { level: 1 }, 'Typography under PDF/A'),
                h(
                    lib.Paragraph,
                    { align: 'justify' },
                    'Typography is the craft of endowing human language with a durable visual form, and thereby with an independent existence. '.repeat(20),
                ),
                h(lib.Paragraph, null, 'A 12 kg parcel costs 150 € to ship 30 % of the way.'),
            ),
    },
    {
        file: 'nofonts-pdfa2b.pdf',
        door: 'jsx',
        claims: 'pdfa',
        expectCompliant: false,
        entry: 'renderToFile(createElement) — NEGATIVE: pdfa2b claim, no embedded fonts (ISO 19005-2 6.2.11.4.1)',
        produce: (ctx) =>
            ctx.h(
                ctx.lib.Document,
                // NEGATIVE canary: no fontEntries and no strict (strict would
                // throw before bytes). The engine falls back to unembedded
                // base-14 fonts while still stamping the pdfaid claim —
                // exactly what veraPDF must reject.
                { title: 'Corpus negative: no fonts', tagged: 'pdfa2b', layout: LENIENT(ctx) },
                ctx.h(ctx.lib.Heading, { level: 1 }, 'Deliberately non-conformant'),
                ctx.h(ctx.lib.Paragraph, null, 'A PDF/A claim with no embedded fonts fails ISO 19005-2 6.2.11.4.1.'),
            ),
    },

    // ── PDF/A, DocSpec door ────────────────────────────────────────
    {
        file: 'spec-pdfa2b-blocks.pdf',
        door: 'spec',
        claims: 'pdfa',
        entry: 'renderSpecToFile — toc/outline/list/table under pdfa2b, strict',
        produce: ({ fontEntries }) => ({
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
        }),
    },
    {
        file: 'spec-pdfa2u-unicode.pdf',
        door: 'spec',
        claims: 'pdfa',
        entry: 'renderSpecToFile — pdfa2u Unicode mapping, strict',
        produce: ({ fontEntries }) => ({
            title: 'Corpus spec unicode',
            tagged: 'pdfa2u',
            fontEntries,
            layout: STRICT,
            blocks: [
                ['h1', 'Unicode mapping'],
                ['p', 'Accented Latin — déjà vu, façade, naïve — and punctuation: “quotes”, …, –, —.'],
                ['p', 'PDF/A-2u additionally requires every glyph to map to Unicode.'],
            ],
        }),
    },
    {
        file: 'spec-pdfa2b-barcode.pdf',
        door: 'spec',
        claims: 'pdfa',
        entry: 'renderSpecToFile — qr + code128 under pdfa2b, strict',
        produce: ({ fontEntries }) => ({
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
        }),
    },
    {
        file: 'form-pdfa2b.pdf',
        door: 'spec',
        claims: 'pdfa',
        entry: "renderSpecToFile — ['field'] under pdfa2b with embedded fonts (engine diagnostic is conservative; veraPDF accepts — CI-proven; engine 1.8.0 embeds the /DR font, #74)",
        produce: (ctx) => ({
            title: 'Corpus form (embedded fonts)',
            tagged: 'pdfa2b',
            fontEntries: ctx.fontEntries,
            // POSITIVE, deliberately not strict: the conservative
            // PDFA_UNEMBEDDED_FORM_FONT diagnostic may fire and strict would
            // abort — with embedded fontEntries veraPDF accepts the file. The
            // diagnostic is collected and printed as an informational note.
            layout: LENIENT(ctx),
            blocks: [
                ['h1', 'Form under PDF/A'],
                ['field', { fieldType: 'text', name: 'fullName', label: 'Full name' }],
                ['field', { fieldType: 'checkbox', name: 'consent', label: 'I agree', checked: false }],
            ],
        }),
    },
    {
        file: 'form-nofonts-pdfa2b.pdf',
        door: 'spec',
        claims: 'pdfa',
        expectCompliant: false,
        entry: "renderSpecToFile — NEGATIVE: ['field'] + text under pdfa2b, no embedded fonts (ISO 19005-2 6.2.11.4.1, AcroForm path)",
        produce: (ctx) => ({
            title: 'Corpus negative: form without fonts',
            tagged: 'pdfa2b',
            // NEGATIVE canary — no fontEntries and no strict: heading and field
            // labels render through unembedded base-14 fonts under a PDF/A
            // claim. veraPDF must reject the file.
            layout: LENIENT(ctx),
            blocks: [
                ['h1', 'Form under PDF/A, no embedded fonts'],
                ['field', { fieldType: 'text', name: 'fullName', label: 'Full name' }],
                ['field', { fieldType: 'checkbox', name: 'consent', label: 'I agree', checked: false }],
            ],
        }),
    },

    // ── PDF/X-4 (1.8.0) ────────────────────────────────────────────
    {
        file: 'print-cmyk-pdfx4.pdf',
        door: 'jsx',
        claims: 'pdfx',
        entry: 'renderToFile(createElement) — PDF/X-4 press sheet: CMYK output intent, CMYK colours, 5 mm bleed with crop marks and colour bars, trapped False, strict',
        produce: ({ lib, h, fontEntries }) =>
            h(
                lib.Document,
                {
                    title: 'Corpus PDF/X-4 press sheet',
                    pdfx: 'pdfx4',
                    fontEntries,
                    outputIntent: CMYK_INTENT,
                    metadata: { author: 'pdfnative-react corpus', trapped: 'False' },
                    print: { bleed: BLEED, marks: { crop: true, registration: true, colourBars: true } },
                    layout: { ...STRICT, pageWidth: 595.28 + 2 * BLEED, pageHeight: 841.89 + 2 * BLEED },
                },
                h(lib.Heading, { level: 1, color: [0, 0, 0, 100] }, 'Press sheet'),
                h(lib.Paragraph, { color: '0 1 1 0' }, 'Rich red body text, set in DeviceCMYK, inside the trim box.'),
                h(lib.Table, {
                    headers: ['Plate', 'Ink'],
                    rows: [
                        { cells: ['Cyan', '100 %'], type: 'default', pointed: false },
                        { cells: ['Black', '100 %'], type: 'default', pointed: false },
                    ],
                }),
            ),
    },
    {
        file: 'spec-pdfx4-gray.pdf',
        door: 'spec',
        claims: 'pdfx',
        entry: 'renderSpecToFile — PDF/X-4 with a Gray output intent (/N 1) through the DocSpec door, strict',
        produce: ({ fontEntries }) => ({
            title: 'Corpus PDF/X-4 grayscale',
            pdfx: 'pdfx4',
            fontEntries,
            outputIntent: GRAY_INTENT,
            metadata: { trapped: 'False' },
            print: { bleed: 9, marks: true },
            layout: STRICT,
            blocks: [
                ['h1', 'Monochrome press sheet'],
                ['p', 'A Gray output profile is an output (prtr) profile too; the OutputIntent carries /N 1.'],
                ['ul', ['One ink', 'Two boxes: TrimBox and BleedBox', 'Zero annotations']],
            ],
        }),
    },
    {
        file: 'pdfx4-nofonts.pdf',
        door: 'spec',
        claims: 'pdfx',
        expectCompliant: false,
        entry: 'renderSpecToFile — NEGATIVE: PDF/X-4 claim with no embedded fonts (PDFX_NO_FONT_ENTRIES, ISO 15930-7) — validatePdfX() must reject',
        produce: (ctx) => ({
            title: 'Corpus negative: PDF/X-4 without fonts',
            pdfx: 'pdfx4',
            outputIntent: CMYK_INTENT,
            metadata: { trapped: 'False' },
            // NEGATIVE canary — no fontEntries and no strict (strict would
            // throw on PDFX_NO_FONT_ENTRIES before any byte is written).
            layout: LENIENT(ctx),
            blocks: [
                ['h1', 'Deliberately non-conformant'],
                ['p', 'PDF/X-4 requires every font to be embedded; base-14 Helvetica is not.'],
            ],
        }),
    },
];
