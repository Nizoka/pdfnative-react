/**
 * The 1.9.0 diagnostic codes — `TEXT_GLYPH_NOT_COVERED` above all: a
 * character that no registered font covers used to render as a box or a
 * `?` in silence; it now reaches `layout.onDiagnostic` and throws under
 * `layout.strict`. The bytes of a document that is merely *observed* through
 * the sink do not change. (The two JPEG 2000 codes are held in
 * `tests/jpx-image.test.tsx`; `PDFA_GLYPH_WITHOUT_UNICODE` is the engine's
 * PDF/A-2u check of its own ToUnicode output and has no authoring trigger.)
 */
import { describe, expect, it } from 'vitest';
import { Document, Paragraph, renderToBytes, resolveFonts } from '../src/index.js';
import type { PdfDiagnostic } from '../src/index.js';

const fontEntries = await resolveFonts({ latin: () => import('pdfnative/fonts/noto-sans-data.js') });
const PINNED = new Date('2026-01-01T00:00:00Z');

describe('TEXT_GLYPH_NOT_COVERED (engine >= 1.9.0)', () => {
    // An arrow no bundled Latin face covers; Noto Sans has no U+2192.
    const node = (
        <Document title="Uncovered" fontEntries={fontEntries} creationDate={PINNED}>
            <Paragraph>Input → output</Paragraph>
        </Document>
    );

    it('reaches onDiagnostic as a warning, once per uncovered character', () => {
        const out: PdfDiagnostic[] = [];
        renderToBytes(node, { layout: { onDiagnostic: (d) => out.push(d) } });
        const hits = out.filter((d) => d.code === 'TEXT_GLYPH_NOT_COVERED');
        expect(hits.length).toBeGreaterThanOrEqual(1);
        expect(hits[0].severity).toBe('warning');
        expect(hits[0].message).toMatch(/U\+2192|→/);
    });

    it('does not change the bytes — observing is free', () => {
        const silent = renderToBytes(node);
        const observed = renderToBytes(node, { layout: { onDiagnostic: () => undefined } });
        expect(Buffer.from(observed).equals(Buffer.from(silent))).toBe(true);
    });

    it('throws under layout.strict, naming the character', () => {
        expect(() => renderToBytes(node, { layout: { strict: true } })).toThrow(/U\+2192/);
    });

    it('stays silent when the character is covered', () => {
        const out: PdfDiagnostic[] = [];
        renderToBytes(
            <Document title="Covered" fontEntries={fontEntries} creationDate={PINNED}>
                <Paragraph>Input to output</Paragraph>
            </Document>,
            { layout: { onDiagnostic: (d) => out.push(d) } },
        );
        expect(out.map((d) => d.code)).not.toContain('TEXT_GLYPH_NOT_COVERED');
    });
});
