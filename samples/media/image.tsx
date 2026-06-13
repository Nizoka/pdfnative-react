/**
 * Image sample — embed a raster (PNG) image.
 *
 * Run with: npx tsx samples/media/image.tsx
 * Writes `image.pdf` to the current directory.
 *
 * `<Image>` takes raw JPEG/PNG bytes (`Uint8Array`). Here we decode a tiny 1×1
 * PNG; in a real app you would read bytes from disk, a fetch response, or an
 * upload.
 */

import React from 'react';
import { Document, Heading, Image, Paragraph, renderToFile } from '../../src/index.js';

// A 1×1 RGB PNG (no alpha channel — pdfnative embeds JPEG/PNG without alpha),
// decoded from base64. In a real app you would read bytes from disk, a fetch
// response, or an upload.
const PNG_1x1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQTX4NAAIkAXSaGkHUAAAAAElFTkSuQmCC';
const pngBytes = new Uint8Array(Buffer.from(PNG_1x1, 'base64'));

const doc = (
    <Document title="Image">
        <Heading level={1}>Embedded image</Heading>
        <Paragraph>The logo below is a PNG embedded straight from bytes.</Paragraph>
        <Image data={pngBytes} width={96} height={96} align="center" alt="Placeholder logo" />
    </Document>
);

await renderToFile(doc, 'image.pdf');
console.log('Wrote image.pdf');
