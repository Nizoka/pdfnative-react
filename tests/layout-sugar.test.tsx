/**
 * `<Document>` layout sugar: watermark / header / footer / attachments / tagged.
 *
 * These props fold into `layout`, which makes the *absence* case the one that
 * really matters: a document that uses none of them must still serialize with
 * `layout: undefined`, or every existing document silently changes bytes.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Paragraph,
    compileDocument,
    compileSpec,
    renderToBytes,
} from '../src/index.js';
import type { DocSpec, PageTemplate, PdfAttachment } from '../src/index.js';

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
        });
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
});
