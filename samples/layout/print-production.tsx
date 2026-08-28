/**
 * Print production — bleed, printer's marks, trapped metadata, and the
 * duplex/copies defaults a commercial printer expects.
 *
 * Run with: npx tsx samples/layout/print-production.tsx
 * Writes `print-production.pdf` to the current directory.
 *
 * Marks need a TrimBox source: pass either the `bleed` shorthand (as here) or
 * an explicit `trimBox` — `marks: true` alone is rejected, because crop marks
 * are drawn relative to the trim edge. Design the page at trim size + 2×bleed
 * (9 pt ≈ 3.2 mm here) and let backgrounds run to the page edge; the marks are
 * stroked strictly outside the TrimBox. For banners and plans wider than the
 * 14 400 pt PDF limit, `print.userUnit` (1–75 000) scales user space instead —
 * not available under `tagged: 'pdfa1b'` (PDF/A-1 is PDF 1.4).
 */

import React from 'react';
import { Document, Heading, Paragraph, Spacer, renderToFile } from '../../src/index.js';

const BLEED = 9; // points on every side
const TRIM_W = 595.28; // A4 trim size…
const TRIM_H = 841.89;

const doc = (
    <Document
        title="Print production"
        print={{
            bleed: BLEED, // TrimBox = MediaBox inset by 9 pt; BleedBox = MediaBox
            marks: true, // crop + registration marks with professional defaults
        }}
        metadata={{
            author: 'Acme Inc',
            subject: 'Print-ready one-pager',
            trapped: 'False', // /Info /Trapped, mirrored to XMP pdf:Trapped
        }}
        layout={{
            // …so the MediaBox is trim + 2×bleed on each axis.
            pageWidth: TRIM_W + 2 * BLEED,
            pageHeight: TRIM_H + 2 * BLEED,
            viewerPreferences: {
                duplex: 'duplexFlipLongEdge', // double-sided, bound on the long edge
                pickTrayByPDFSize: true,
                printPageRange: [[1, 1]], // 1-based, inclusive pairs
                numCopies: 2,
            },
        }}
    >
        <Heading level={1}>Print-ready one-pager</Heading>
        <Paragraph>
            This page carries a 9 pt bleed: the TrimBox — the finished page after
            cutting — is inset from the MediaBox on every side, and crop plus
            registration marks are drawn outside it. Open the PDF in a viewer
            that shows page boxes (or a preflight tool) to see the geometry.
        </Paragraph>
        <Spacer height={8} />
        <Paragraph>
            The metadata declares the document as not trapped, and the viewer
            preferences pre-fill the Print dialog: long-edge duplex, tray picked
            by page size, page 1 only, two copies. Viewers treat all of these as
            defaults the operator can still override.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'print-production.pdf');
console.log('Wrote print-production.pdf');
