/**
 * The PDF/UA round-trip deferred from the 1.1.0 review.
 *
 * Everything else in this suite checks our *intent* (the params we hand the
 * engine, the lint findings we compute). This file closes the loop on the
 * *output*: a representative PDF/A-2b document — headings in order, a table
 * with headers, an image with alt text, a chart with altText, a link with
 * descriptive text, and a real embedded font — is rendered to real bytes and
 * then handed to the engine's own `validatePdfUA`, which checks the
 * ISO 14289-1 structural prerequisites (/MarkInfo, /StructTreeRoot, XMP
 * metadata, /ParentTree, MCID uniqueness) on the actual file.
 *
 * The embedded-fonts configuration is the load-bearing one: PDF/UA in
 * practice requires every rendering font embedded, and this exact round trip
 * is what caught the `resolveFonts` fontRef bug fixed in 1.2.0 (a bare
 * `latin` where ISO 32000 requires the name `/latin` corrupted every
 * document produced through the documented font path — `validatePdfUA` was
 * the messenger, not the culprit).
 *
 * The same tree must also lint clean, tying the two quality gates together:
 * a document this package calls accessible must produce bytes the engine
 * calls structurally conformant.
 */
import { describe, expect, it } from 'vitest';
import { validatePdfUA } from 'pdfnative';
import {
    Chart,
    Document,
    Heading,
    Image,
    Link,
    Paragraph,
    Table,
    fromBase64,
    lintDocument,
    renderToBytes,
    resolveFonts,
} from '../src/index.js';

// A real 1×1 RGB PNG (no alpha channel — the engine's decoder rejects PNG
// colour type 6) so the image block round-trips through a real embed.
const ONE_PIXEL_PNG = fromBase64(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YWMDAAMQAUEiFmcFAAAAAElFTkSuQmCC',
);

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const ACCESSIBLE_DOC = (
    <Document title="Quarterly report" tagged="pdfa2b" fontEntries={fontEntries}>
        <Heading level={1}>Quarterly report</Heading>
        <Paragraph>Revenue grew in every region.</Paragraph>
        <Heading level={2}>Regional figures</Heading>
        <Table
            headers={['Region', 'Revenue']}
            rows={[
                { cells: ['North', '12k'], type: 'default', pointed: false },
                { cells: ['South', '31k'], type: 'default', pointed: false },
            ]}
        />
        <Image data={ONE_PIXEL_PNG} alt="Company logo" />
        <Chart
            chartType="bar"
            series={[{ label: 'Revenue', values: [12, 31] }]}
            categories={['North', 'South']}
            altText="Revenue per region, North 12k and South 31k"
        />
        <Link url="https://pdfnative.dev">Read the full methodology</Link>
    </Document>
);

describe('the PDF/UA round-trip', () => {
    const bytes = renderToBytes(ACCESSIBLE_DOC);

    it('renders the PDF/A-2b document, embedded font included, to real bytes', () => {
        const text = new TextDecoder('latin1').decode(bytes);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
        // The font really is embedded, not silently dropped — an unembedded
        // fallback would leave the file two orders of magnitude smaller.
        expect(bytes.byteLength).toBeGreaterThan(50_000);
    });

    it("passes the engine's own structural PDF/UA validation", () => {
        const result = validatePdfUA(bytes);
        // `errors` first: on a failure it names the violated clause, which
        // a bare `valid === false` would not.
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('also lints clean, tying the two quality gates together', () => {
        const report = lintDocument(ACCESSIBLE_DOC);
        expect(report.findings).toEqual([]);
        expect(report.ok).toBe(true);
    });
});
