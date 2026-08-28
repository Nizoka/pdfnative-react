/**
 * Layout & PDF/A sample — page size, margins, and archival compliance.
 *
 * Run with: npx tsx samples/layout/page-setup.tsx
 * Writes `page-setup.pdf` to the current directory.
 *
 * Layout overrides are passed via the `layout` render option (or the
 * `<Document layout>` prop). Here we set US Letter, custom margins, and enable
 * PDF/A-2b (tagged, archival).
 *
 * PDF/A requires EVERY rendering font to be embedded — without `fontEntries`
 * the engine falls back to unembedded standard-14 fonts while still writing
 * the pdfaid claim, and veraPDF rejects the file (ISO 19005-2 §6.2.11.4.1).
 * Note the lint blind spot this sample sits in: `L_TAGGED_NO_FONTS` reads the
 * `tagged` prop on `<Document>`, so a claim set through `RenderOptions.layout`
 * (as here — the teaching point of this sample) is invisible to
 * `lintDocument(doc)`. The corpus gate (`npm run validate:pdfa`) is what
 * proves files like this one conformant for real.
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile, resolveFonts } from '../../src/index.js';
import type { RenderOptions } from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const options: RenderOptions = {
    layout: {
        // US Letter, in points.
        pageWidth: 612,
        pageHeight: 792,
        margins: { t: 72, r: 54, b: 72, l: 54 },
        // Tagged PDF/A-2b — accessible + archivable.
        tagged: 'pdfa2b',
    },
    fontEntries,
};

const doc = (
    <Document title="Layout & PDF/A">
        <Heading level={1}>Custom layout</Heading>
        <Paragraph>
            This document is US Letter with custom margins and is tagged PDF/A-2b for archival.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'page-setup.pdf', options);
console.log('Wrote page-setup.pdf');
