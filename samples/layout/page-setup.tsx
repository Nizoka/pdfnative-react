/**
 * Layout & PDF/A sample — page size, margins, and archival compliance.
 *
 * Run with: npx tsx samples/layout/page-setup.tsx
 * Writes `page-setup.pdf` to the current directory.
 *
 * Layout overrides are passed via the `layout` render option (or the
 * `<Document layout>` prop). Here we set US Letter, custom margins, and enable
 * PDF/A-2b (tagged, archival).
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile } from '../../src/index.js';
import type { RenderOptions } from '../../src/index.js';

const options: RenderOptions = {
    layout: {
        // US Letter, in points.
        pageWidth: 612,
        pageHeight: 792,
        margins: { t: 72, r: 54, b: 72, l: 54 },
        // Tagged PDF/A-2b — accessible + archivable.
        tagged: 'pdfa2b',
    },
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
