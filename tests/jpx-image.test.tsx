/**
 * JPEG 2000 images (engine ≥ 1.9.0) — `<Image data>` and `watermark.image`
 * accept a JP2 file or a raw J2K codestream, passed through as `/JPXDecode`
 * with a `%PDF-1.5` header. Under PDF/A the claim's rules apply: no JPX at
 * all under PDF/A-1, 1/3/4 colour channels and no opacity under PDF/A-2+.
 * `L_PDFA_JPX_IMAGE` mirrors the two engine diagnostics one tier earlier.
 */
import { describe, expect, it } from 'vitest';
import { Document, Image, Paragraph, lintDocument, renderToBytes, resolveFonts } from '../src/index.js';
import type { PdfDiagnostic } from '../src/index.js';
import { makeMinimalJ2K, makeMinimalJP2 } from './helpers/jpx-fixture.js';

const fontEntries = await resolveFonts({ latin: () => import('pdfnative/fonts/noto-sans-data.js') });
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

describe('JPEG 2000 pass-through', () => {
    it('embeds a JP2 file with /JPXDecode under a PDF 1.5 header', () => {
        const text = latin1(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Image data={makeMinimalJP2(3)} width={64} height={64} alt="Grey square" />
                </Document>,
            ),
        );
        expect(text.startsWith('%PDF-1.5')).toBe(true);
        expect(text).toContain('/JPXDecode');
    });

    it('embeds a raw J2K codestream the same way', () => {
        const text = latin1(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Image data={makeMinimalJ2K(1)} width={32} height={32} alt="Grey square" />
                </Document>,
            ),
        );
        expect(text).toContain('/JPXDecode');
    });

    it('takes a JPEG 2000 watermark image', () => {
        const text = latin1(
            renderToBytes(
                <Document layout={{ compress: false }} watermark={{ image: { data: makeMinimalJP2(1), width: 200, opacity: 0.2 } }}>
                    <Paragraph>Under the watermark.</Paragraph>
                </Document>,
            ),
        );
        expect(text).toContain('/JPXDecode');
    });
});

describe('L_PDFA_JPX_IMAGE — the engine diagnostics, one tier earlier', () => {
    const codes = (node: Parameters<typeof renderToBytes>[0]): string[] => {
        const out: PdfDiagnostic[] = [];
        renderToBytes(node, { layout: { onDiagnostic: (d) => out.push(d) } });
        return out.map((d) => d.code);
    };

    it("warns on any JPEG 2000 image under 'pdfa1b', and the engine reports PDFA1_JPX_IMAGE", () => {
        const node = (
            <Document tagged="pdfa1b" fontEntries={fontEntries}>
                <Image data={makeMinimalJP2(3)} width={32} height={32} alt="Grey" />
            </Document>
        );
        const report = lintDocument(node);
        const found = report.findings.find((f) => f.code === 'L_PDFA_JPX_IMAGE');
        expect(found).toMatchObject({ severity: 'warning', blockIndex: 0 });
        expect(found?.message).toContain('PDFA1_JPX_IMAGE');
        expect(report.ok).toBe(true);
        expect(codes(node)).toContain('PDFA1_JPX_IMAGE');
        expect(() => renderToBytes(node, { layout: { strict: true } })).toThrow(/PDFA1_JPX_IMAGE|JPEG 2000/);
    });

    it("is clean for a 1-, 3- or 4-channel image under 'pdfa2b'", () => {
        for (const channels of [1, 3, 4]) {
            const node = (
                <Document tagged="pdfa2b" fontEntries={fontEntries}>
                    <Image data={makeMinimalJP2(channels)} width={32} height={32} alt="Grey" />
                </Document>
            );
            expect(lintDocument(node).findings.map((f) => f.code), String(channels)).not.toContain('L_PDFA_JPX_IMAGE');
            expect(codes(node), String(channels)).not.toContain('PDFA_JPX_IMAGE');
        }
    });

    it("warns on an opacity channel under 'pdfa2b', as the engine's PDFA_JPX_IMAGE does", () => {
        const node = (
            <Document tagged="pdfa2b" fontEntries={fontEntries}>
                <Image data={makeMinimalJP2(4, { alpha: true })} width={32} height={32} alt="Grey with alpha" />
            </Document>
        );
        const found = lintDocument(node).findings.find((f) => f.code === 'L_PDFA_JPX_IMAGE');
        expect(found?.message).toContain('an opacity channel');
        expect(found?.message).toContain('PDFA_JPX_IMAGE');
        expect(codes(node)).toContain('PDFA_JPX_IMAGE');
    });

    it('reads a raw two-component codestream as grey plus opacity, as the engine does', () => {
        // No `colr` box: the engine derives the channels from the component
        // count, and the second component of a grey image is an opacity channel.
        const node = (
            <Document tagged="pdfa2b" fontEntries={fontEntries}>
                <Image data={makeMinimalJ2K(2)} width={32} height={32} alt="Grey plus alpha" />
            </Document>
        );
        expect(lintDocument(node).findings.find((f) => f.code === 'L_PDFA_JPX_IMAGE')?.message).toContain('an opacity channel');
        expect(codes(node)).toContain('PDFA_JPX_IMAGE');
    });

    it('covers the watermark image too, without a block index', () => {
        const found = lintDocument(
            <Document tagged="pdfa1b" fontEntries={fontEntries} watermark={{ image: { data: makeMinimalJ2K(1), width: 100 } }}>
                <Paragraph>x</Paragraph>
            </Document>,
        ).findings.find((f) => f.code === 'L_PDFA_JPX_IMAGE');
        expect(found?.message).toContain('watermark.image');
        expect(found).not.toHaveProperty('blockIndex');
    });

    it('ignores JPEG 2000 without a PDF/A claim, and PNG under one', () => {
        const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
        expect(
            lintDocument(
                <Document>
                    <Image data={makeMinimalJ2K(2)} width={32} height={32} alt="Grey plus alpha" />
                </Document>,
            ).findings.map((f) => f.code),
        ).not.toContain('L_PDFA_JPX_IMAGE');
        expect(
            lintDocument(
                <Document tagged="pdfa1b" fontEntries={fontEntries}>
                    <Image data={PNG} width={32} height={32} alt="Not JPX" />
                </Document>,
            ).findings.map((f) => f.code),
        ).not.toContain('L_PDFA_JPX_IMAGE');
    });
});
