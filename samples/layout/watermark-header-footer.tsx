/**
 * Document-level layout sugar: watermark, running header/footer, attachments.
 *
 * Run with: npx tsx samples/layout/watermark-header-footer.tsx
 * Writes `watermark-header-footer.pdf` to the current directory.
 *
 * These are props on `<Document>` rather than child components, because they are
 * page furniture, not blocks in the flow — they fold into `layout` under the
 * engine's own keys (`watermark`, `headerTemplate`, `footerTemplate`,
 * `attachments`, `tagged`). An explicit `layout` prop always wins, so you can
 * still drop down to the raw options when you need to.
 *
 * Header and footer templates understand four placeholders, resolved at render
 * time: {page}, {pages}, {date} and {title}.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    Section,
    Table,
    lintDocument,
    renderToFile,
    resolveFonts,
} from '../../src/index.js';
import type { PdfAttachment } from '../../src/index.js';

/**
 * PDF/A embeds every rendering font, so the base-14 fallback is not allowed.
 * `lintDocument` reports `L_TAGGED_NO_FONTS` if you forget this.
 */
const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

/** A machine-readable twin of the invoice, embedded in the PDF (PDF/A-3 style). */
const invoiceData: PdfAttachment = {
    filename: 'invoice-2048.xml',
    data: new TextEncoder().encode(
        '<invoice><number>2048</number><total currency="EUR">649.00</total></invoice>',
    ),
    mimeType: 'application/xml',
    description: 'Structured invoice data',
    relationship: 'Data',
};

const doc = (
    <Document
        title="Invoice #2048"
        metadata={{ author: 'Acme Inc', subject: 'Invoice #2048' }}
        fontEntries={fontEntries}
        // Shorthand: a plain string becomes { text: { text: … } } with engine defaults.
        watermark="DRAFT"
        header={{ left: 'Acme Inc', right: '{date}' }}
        footer={{
            left: 'Confidential',
            center: '{title}',
            right: 'Page {page} of {pages}',
        }}
        // Attachments are a PDF/A-3 feature: the engine rejects them under any
        // other conformance target, and `lintDocument` reports
        // `L_ATTACHMENTS_NEED_PDFA3` before you ever reach the render.
        attachments={[invoiceData]}
        tagged="pdfa3b"
    >
        <Heading level={1}>Invoice #2048</Heading>
        <Paragraph>Issued 2026-07-25 · Due 2026-08-24</Paragraph>

        <Section title="Line items">
            <Table
                headers={['Item', 'Qty', 'Unit', 'Total']}
                rows={[
                    { cells: ['Pro plan (annual)', '1', '€490.00', '€490.00'], type: 'default', pointed: false },
                    { cells: ['Extra seats', '5', '€12.00', '€60.00'], type: 'default', pointed: false },
                    { cells: ['Priority support', '1', '€99.00', '€99.00'], type: 'default', pointed: false },
                ]}
                zebra
            />
            <Paragraph align="right">Total due: €649.00</Paragraph>
        </Section>

        <Section title="Notes" break>
            <Paragraph>
                The watermark above is the string shorthand. For full control — image
                watermarks, opacity, angle, foreground placement — pass the
                WatermarkOptions object instead:
            </Paragraph>
            <Paragraph color="#555">
                {'watermark={{ text: { text: \'CONFIDENTIAL\', opacity: 0.12, angle: -30 }, position: \'foreground\' }}'}
            </Paragraph>
        </Section>
    </Document>
);

// Pre-flight: PDF/A has constraints the engine enforces by throwing. Linting
// first turns those into findings you can read.
const report = lintDocument(doc);
if (!report.ok) {
    for (const f of report.findings) console.error(`${f.code}: ${f.message}`);
    process.exit(1);
}

await renderToFile(doc, 'watermark-header-footer.pdf');
console.log('Wrote watermark-header-footer.pdf');
