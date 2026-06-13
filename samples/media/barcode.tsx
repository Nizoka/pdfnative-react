/**
 * Barcode sample — every supported 1D/2D format.
 *
 * Run with: npx tsx samples/media/barcode.tsx
 * Writes `barcode.pdf` to the current directory.
 */

import React from 'react';
import { Barcode, Document, Heading, Spacer, renderToFile } from '../../src/index.js';

const doc = (
    <Document title="Barcodes">
        <Heading level={1}>Barcodes</Heading>
        <Spacer height={6} />

        <Heading level={3}>QR</Heading>
        <Barcode format="qr" data="https://pdfnative.dev" width={120} height={120} ecLevel="M" />

        <Heading level={3}>Code 128</Heading>
        <Barcode format="code128" data="PDFNATIVE-2026" width={220} height={64} />

        <Heading level={3}>EAN-13</Heading>
        <Barcode format="ean13" data="4006381333931" width={200} height={70} />

        <Heading level={3}>PDF417</Heading>
        <Barcode format="pdf417" data="pdfnative-react" width={220} height={70} pdf417ECLevel={2} />

        <Heading level={3}>Data Matrix</Heading>
        <Barcode format="datamatrix" data="DM-2026" width={96} height={96} />
    </Document>
);

await renderToFile(doc, 'barcode.pdf');
console.log('Wrote barcode.pdf');
