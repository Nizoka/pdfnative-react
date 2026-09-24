/**
 * `<Document>` layout sugar: watermark / header / footer / attachments /
 * tagged / print.
 *
 * These props fold into `layout`, which makes the *absence* case the one that
 * really matters: a document that uses none of them must still serialize with
 * `layout: undefined`, or every existing document silently changes bytes.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Paragraph,
    PdfReactError,
    compileDocument,
    compileSpec,
    renderToBytes,
} from '../src/index.js';
import type { DocSpec, PageTemplate, PdfAttachment, TypographyOptions } from '../src/index.js';

const TYPOGRAPHY: TypographyOptions = { splitParagraphs: true, kerning: true };
const ICC = new Uint8Array([0x61, 0x63, 0x73, 0x70]);
const INTENT = { iccProfile: ICC, outputConditionIdentifier: 'x' };

const FOOTER: PageTemplate = {
    left: 'Confidential',
    center: '{title}',
    right: 'Page {page} of {pages}',
};

const ATTACHMENT: PdfAttachment = {
    filename: 'invoice.xml',
    data: new TextEncoder().encode('<invoice/>'),
    mimeType: 'application/xml',
    relationship: 'Data',
};

describe('the layout === undefined invariant', () => {
    it('leaves layout undefined when no sugar and no layout prop are used', () => {
        const model = compileDocument(
            <Document title="Plain">
                <Paragraph>Nothing fancy.</Paragraph>
            </Document>,
        );
        expect(model.layout).toBeUndefined();
        expect('layout' in model).toBe(false);
    });

    it('still leaves layout undefined for a spec that uses no sugar', () => {
        expect(compileSpec({ blocks: [['p', 'Nothing fancy.']] }).layout).toBeUndefined();
    });

    it('passes an explicit layout through untouched when no sugar is used', () => {
        const model = compileDocument(
            <Document layout={{ pageWidth: 595 }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ pageWidth: 595 });
    });
});

describe('layout sugar folding', () => {
    it('folds every sugar prop into layout under its engine key', () => {
        const model = compileDocument(
            <Document
                watermark={{ text: { text: 'DRAFT', opacity: 0.2 }, position: 'foreground' }}
                header={{ center: 'Acme' }}
                footer={FOOTER}
                attachments={[ATTACHMENT]}
                tagged="pdfa2b"
                print={{ bleed: 9 }}
                outputIntent={INTENT}
                typography={TYPOGRAPHY}
                creationDate={new Date('2026-01-01T00:00:00Z')}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );

        expect(model.layout).toEqual({
            watermark: { text: { text: 'DRAFT', opacity: 0.2 }, position: 'foreground' },
            headerTemplate: { center: 'Acme' },
            footerTemplate: FOOTER,
            attachments: [ATTACHMENT],
            tagged: 'pdfa2b',
            print: { bleed: 9 },
            outputIntent: INTENT,
            typography: TYPOGRAPHY,
            creationDate: new Date('2026-01-01T00:00:00Z'),
        });
    });

    it('folds pdfx on its own (it is exclusive with tagged, so it gets its own case)', () => {
        const model = compileDocument(
            <Document pdfx="pdfx4">
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ pdfx: 'pdfx4' });
    });

    it('replaces typography whole when an explicit layout.typography is set — no deep merge', () => {
        const model = compileDocument(
            <Document typography={TYPOGRAPHY} layout={{ typography: { opticalMargins: true } }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ typography: { opticalMargins: true } });
    });

    it('parses an ISO 8601 creationDate string into a Date', () => {
        const model = compileDocument(
            <Document creationDate="2026-01-01T00:00:00Z">
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout?.creationDate).toBeInstanceOf(Date);
        expect(model.layout?.creationDate?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('rejects an unparseable creationDate with E_INPUT — never a silent wall-clock fallback', () => {
        try {
            compileDocument(
                <Document creationDate="yesterday">
                    <Paragraph>x</Paragraph>
                </Document>,
            );
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(PdfReactError);
            expect((err as PdfReactError).code).toBe('E_INPUT');
            expect((err as PdfReactError).message).toContain('creationDate');
        }
    });

    it('folds the print prop into layout.print on its own', () => {
        const model = compileDocument(
            <Document print={{ bleed: 9 }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ print: { bleed: 9 } });
    });

    it('lets an explicit layout.print win over the print prop', () => {
        const model = compileDocument(
            <Document print={{ bleed: 9 }} layout={{ print: { trimBox: [20, 20, 575, 822] } }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ print: { trimBox: [20, 20, 575, 822] } });
    });

    it('expands the watermark string shorthand', () => {
        const model = compileDocument(
            <Document watermark="CONFIDENTIAL">
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ watermark: { text: { text: 'CONFIDENTIAL' } } });
    });

    it('lets an explicit layout win over the sugar', () => {
        const model = compileDocument(
            <Document tagged="pdfa2b" layout={{ tagged: true, pageWidth: 595 }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ tagged: true, pageWidth: 595 });
    });

    it('merges sugar and layout when they touch different keys', () => {
        const model = compileDocument(
            <Document watermark="DRAFT" layout={{ pageWidth: 595 }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({
            watermark: { text: { text: 'DRAFT' } },
            pageWidth: 595,
        });
    });

    it('renders a watermarked, tagged document end to end', () => {
        const pdf = new TextDecoder('latin1').decode(
            renderToBytes(
                <Document title="Report" watermark="DRAFT" footer={FOOTER} tagged>
                    <Paragraph>Body text.</Paragraph>
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});

describe('layout sugar DocSpec parity', () => {
    it('produces the same model from a spec as from JSX', () => {
        const spec: DocSpec = {
            title: 'Report',
            watermark: 'DRAFT',
            header: { center: 'Acme' },
            footer: FOOTER,
            attachments: [ATTACHMENT],
            tagged: 'pdfa3b',
            blocks: [['p', 'Body text.']],
        };

        const jsx = (
            <Document
                title="Report"
                watermark="DRAFT"
                header={{ center: 'Acme' }}
                footer={FOOTER}
                attachments={[ATTACHMENT]}
                tagged="pdfa3b"
            >
                <Paragraph>Body text.</Paragraph>
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
    });

    it('folds a spec-level print field identically to the JSX prop', () => {
        const spec: DocSpec = {
            print: { trimBox: [20, 20, 575, 822], marks: true },
            blocks: [['p', 'Body text.']],
        };

        const jsx = (
            <Document print={{ trimBox: [20, 20, 575, 822], marks: true }}>
                <Paragraph>Body text.</Paragraph>
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
        expect(compileSpec(spec).layout).toEqual({
            print: { trimBox: [20, 20, 575, 822], marks: true },
        });
    });

    it('folds the 1.3.0 fields (pdfx, outputIntent, typography, creationDate) identically', () => {
        const spec: DocSpec = {
            pdfx: 'pdfx4',
            outputIntent: INTENT,
            typography: TYPOGRAPHY,
            creationDate: '2026-01-01T00:00:00Z',
            blocks: [['p', 'Body text.']],
        };
        const jsx = (
            <Document
                pdfx="pdfx4"
                outputIntent={INTENT}
                typography={TYPOGRAPHY}
                creationDate={new Date('2026-01-01T00:00:00Z')}
            >
                <Paragraph>Body text.</Paragraph>
            </Document>
        );
        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
        expect(compileSpec(spec).layout).toEqual({
            pdfx: 'pdfx4',
            outputIntent: INTENT,
            typography: TYPOGRAPHY,
            creationDate: new Date('2026-01-01T00:00:00Z'),
        });
    });
});
