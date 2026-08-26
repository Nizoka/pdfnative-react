/**
 * The PDF/UA round-trip deferred from the 1.1.0 review.
 *
 * Everything else in this suite checks our *intent* (the params we hand the
 * engine, the lint findings we compute). This file closes the loop on the
 * *output*: a representative tagged document — headings in order, a table
 * with headers, an image with alt text, a chart with altText, a link with
 * descriptive text — is rendered to real bytes and then handed to the
 * engine's own `validatePdfUA`, which checks the ISO 14289-1 structural
 * prerequisites (/MarkInfo, /StructTreeRoot, XMP metadata, /ParentTree,
 * MCID uniqueness) on the actual file.
 *
 * The same tree must also lint clean, tying the two quality gates together:
 * a document this package calls accessible must produce bytes the engine
 * calls structurally conformant.
 *
 * Why `tagged` (plain), not `tagged="pdfa2b"`: with embedded `fontEntries`
 * the validator's lightweight object parser currently fails to skip the raw
 * font stream ("parseDict: expected name key, got keyword"), an engine
 * limitation unrelated to this package's output. Plain tagging exercises the
 * identical structure-tree path and validates cleanly. The no-op
 * `onDiagnostic` keeps the engine's PDFA_NO_FONT_ENTRIES console.warn out of
 * the test output (it fires for any truthy `tagged` without fonts).
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
} from '../src/index.js';

// A real 1×1 RGB PNG (no alpha channel — the engine's decoder rejects PNG
// colour type 6) so the image block round-trips through a real embed.
const ONE_PIXEL_PNG = fromBase64(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YWMDAAMQAUEiFmcFAAAAAElFTkSuQmCC',
);

const ACCESSIBLE_DOC = (
    <Document title="Quarterly report" tagged layout={{ onDiagnostic: () => {} }}>
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

    it('renders the tagged document to real PDF bytes', () => {
        const text = new TextDecoder('latin1').decode(bytes);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
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
