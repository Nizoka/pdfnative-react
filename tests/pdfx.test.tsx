/**
 * The PDF/X-4 round-trip — the print twin of `tests/pdfua.test.tsx`.
 *
 * A press-ready document (CMYK colours, a synthetic CMYK output profile,
 * colour bars in a 5 mm bleed, a known trapping state, an embedded font) is
 * rendered through both authoring doors, held to the same bytes, and handed to
 * the engine's own `validatePdfX()` — the one sanctioned direct engine import
 * in the test suite beside `validatePdfUA`; the package itself never
 * re-exports the byte-level validators (golden rule 7).
 *
 * The negatives prove the lint rules are the engine's own throws, one level
 * earlier: for each incoherent request the `L_PDFX_*` finding carries the
 * sentence the engine then throws, and `toErrorEnvelope` classifies that throw
 * as `E_INPUT`.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { validatePdfX } from 'pdfnative';
import {
    Document,
    Heading,
    Paragraph,
    Spacer,
    lintDocument,
    renderSpecToBytes,
    renderToBytes,
    resolveFonts,
    setDefaultCreationDate,
    toErrorEnvelope,
} from '../src/index.js';
import type { CustomOutputIntent, DocSpec, PrintOptions } from '../src/index.js';
import { buildMinimalRgbIccProfile, buildSyntheticCmykProfile } from './helpers/synthetic-icc.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const CMYK: CustomOutputIntent = {
    iccProfile: buildSyntheticCmykProfile(),
    outputConditionIdentifier: 'pdfnative-react synthetic CMYK',
    info: 'Test profile — characterises no press',
};
const BLEED = 14.17; // 5 mm
const PRINT: PrintOptions = { bleed: BLEED, marks: { crop: true, registration: true, colourBars: true } };
const PAGE = { pageWidth: 595.28 + 2 * BLEED, pageHeight: 841.89 + 2 * BLEED };
const PINNED = new Date('2026-01-01T00:00:00Z');

const pressDoc = (
    <Document
        title="Press sheet"
        pdfx="pdfx4"
        fontEntries={fontEntries}
        metadata={{ author: 'Acme Inc', trapped: 'False' }}
        outputIntent={CMYK}
        print={PRINT}
        creationDate={PINNED}
        layout={PAGE}
    >
        <Heading level={1} color={[0, 0, 0, 100]}>
            Press sheet
        </Heading>
        <Paragraph color="0 1 1 0">Rich red body text, set in DeviceCMYK.</Paragraph>
        <Spacer height={6} />
        <Paragraph>Crop marks, registration targets and colour bars sit in the 5 mm bleed.</Paragraph>
    </Document>
);

const pressSpec: DocSpec = {
    title: 'Press sheet',
    pdfx: 'pdfx4',
    fontEntries,
    metadata: { author: 'Acme Inc', trapped: 'False' },
    outputIntent: CMYK,
    print: PRINT,
    creationDate: '2026-01-01T00:00:00Z',
    layout: PAGE,
    blocks: [
        ['h1', 'Press sheet', { color: [0, 0, 0, 100] }],
        ['p', 'Rich red body text, set in DeviceCMYK.', { color: '0 1 1 0' }],
        ['sp', 6],
        ['p', 'Crop marks, registration targets and colour bars sit in the 5 mm bleed.'],
    ],
};

const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

describe('the PDF/X-4 round-trip', () => {
    const bytes = renderToBytes(pressDoc);

    it('lints clean before rendering', () => {
        expect(lintDocument(pressDoc).findings).toEqual([]);
    });

    it('writes a PDF 1.6 file with the PDF/X output intent and a known trapping state', () => {
        const text = latin1(bytes);
        expect(text.startsWith('%PDF-1.6')).toBe(true);
        expect(text).toContain('/GTS_PDFX');
        expect(text).toMatch(/\/Trapped\s*\/False/);
        expect(bytes.byteLength).toBeGreaterThan(50_000); // the font really is embedded
    });

    it("passes the engine's own structural PDF/X-4 validation", () => {
        const result = validatePdfX(bytes);
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('renders to the same bytes through the DocSpec door', () => {
        // Both are pinned to the same creation instant, so the two doors
        // must agree byte for byte — the strongest parity statement possible.
        expect(latin1(renderSpecToBytes(pressSpec))).toBe(latin1(bytes));
    });
});

describe('every PDF/X coherence rule is the engine throw, one tier earlier', () => {
    afterAll(() => setDefaultCreationDate(null));

    /** Render, expecting the engine to reject; returns the thrown message. */
    function thrownMessage(node: Parameters<typeof renderToBytes>[0]): { message: string; code: string } {
        try {
            renderToBytes(node);
        } catch (err) {
            return { message: err instanceof Error ? err.message : String(err), code: toErrorEnvelope(err).error.code };
        }
        throw new Error('the engine accepted an incoherent PDF/X request');
    }

    const cases: [string, string, React.ReactElement][] = [
        [
            'L_PDFX_TAGGED_CONFLICT',
            'tagged + pdfx',
            <Document pdfx="pdfx4" tagged="pdfa2b" fontEntries={fontEntries} outputIntent={CMYK} metadata={{ trapped: 'False' }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
        [
            'L_PDFX_ENCRYPTED',
            'encryption + pdfx',
            <Document pdfx="pdfx4" fontEntries={fontEntries} outputIntent={CMYK} metadata={{ trapped: 'False' }} layout={{ encryption: { ownerPassword: 'secret' } }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
        [
            'L_PDFX_OUTPUT_INTENT',
            'no output intent',
            <Document pdfx="pdfx4" fontEntries={fontEntries} metadata={{ trapped: 'False' }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
        [
            'L_PDFX_OUTPUT_INTENT',
            'a monitor profile',
            <Document pdfx="pdfx4" fontEntries={fontEntries} metadata={{ trapped: 'False' }} outputIntent={{ iccProfile: buildMinimalRgbIccProfile(), outputConditionIdentifier: 'sRGB' }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
        [
            'L_PDFX_TRAPPED_UNKNOWN',
            "trapped 'Unknown'",
            <Document pdfx="pdfx4" fontEntries={fontEntries} outputIntent={CMYK} metadata={{ trapped: 'Unknown' }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
        [
            'L_PDFX_BOXES',
            'ArtBox + bleed',
            <Document pdfx="pdfx4" fontEntries={fontEntries} outputIntent={CMYK} metadata={{ trapped: 'False' }} print={{ bleed: 9, artBox: [30, 30, 560, 800] }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ],
    ];

    it.each(cases)('%s — %s', (code, _label, node) => {
        const report = lintDocument(node);
        const found = report.findings.find((f) => f.code === code);
        expect(found, `lint did not report ${code}`).toBeDefined();
        expect(report.ok).toBe(false);

        const thrown = thrownMessage(node);
        expect(thrown.message).toBe(found?.message);
        expect(thrown.code).toBe('E_INPUT');
    });

    it('L_PDFX_NO_FONTS — the engine reports PDFX_NO_FONT_ENTRIES, and throws under strict', () => {
        const node = (
            <Document pdfx="pdfx4" outputIntent={CMYK} metadata={{ trapped: 'False' }}>
                <Paragraph>x</Paragraph>
            </Document>
        );
        expect(lintDocument(node).findings.map((f) => f.code)).toContain('L_PDFX_NO_FONTS');

        const codes: string[] = [];
        renderToBytes(node, { layout: { onDiagnostic: (d) => codes.push(d.code) } });
        expect(codes).toContain('PDFX_NO_FONT_ENTRIES');

        expect(() => renderToBytes(node, { layout: { strict: true } })).toThrow(/PDFX_NO_FONT_ENTRIES|font/i);
    });
});
