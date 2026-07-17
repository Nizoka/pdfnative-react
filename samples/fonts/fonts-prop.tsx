/**
 * Font convenience sample — `resolveFonts` and the `options.fonts` shortcut.
 *
 * The async render entry points (`renderToFile`, `renderToFileStream`,
 * `usePdf`, `usePdfStream`) accept a `fonts` loader map directly and resolve
 * it for you. The synchronous entries take pre-resolved `fontEntries`.
 *
 * Run with: npx tsx samples/fonts/fonts-prop.tsx
 * Writes `fonts-prop.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    renderToBytes,
    renderToFile,
    resolveFonts,
} from '../../src/index.js';
import { writeFile } from 'node:fs/promises';

const doc = (
    <Document title="Fonts convenience">
        <Heading level={1}>Multi-script text</Heading>
        <Paragraph>Latin stays default; العربية routes to the Arabic font.</Paragraph>
    </Document>
);

// 1. Async entry point: pass `fonts` and let the renderer resolve it.
await renderToFile(doc, 'fonts-prop.pdf', {
    fonts: { ar: () => import('pdfnative/fonts/noto-arabic-data.js') },
});
console.log('Wrote fonts-prop.pdf (via options.fonts)');

// 2. Synchronous entry point: resolve first, then pass `fontEntries`.
const fontEntries = await resolveFonts({
    ar: () => import('pdfnative/fonts/noto-arabic-data.js'),
});
const bytes = renderToBytes(doc, { fontEntries });
await writeFile('fonts-prop-sync.pdf', bytes);
console.log('Wrote fonts-prop-sync.pdf (via resolveFonts + fontEntries)');
