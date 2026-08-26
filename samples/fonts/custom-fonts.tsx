/**
 * Custom fonts sample — register a font for non-Latin scripts.
 *
 * Run with: NOTO_FONT=/path/to/NotoSansArabic-Regular.ttf npx tsx samples/fonts/custom-fonts.tsx
 * Writes `custom-fonts.pdf` to the current directory.
 *
 * pdfnative ships Latin coverage out of the box. For other scripts (Arabic,
 * Devanagari, CJK, …) register a TTF and pass it as a `FontEntry` via the
 * `fontEntries` render option. This sample is a no-op unless `NOTO_FONT` points
 * at a real TTF, so it stays runnable everywhere.
 */

import React from 'react';
import { Document, Heading, Paragraph, loadFontData, renderToFile } from '../../src/index.js';
import type { FontEntry } from '../../src/index.js';

const fontPath = process.env.NOTO_FONT;
const fontEntries: FontEntry[] = [];

if (fontPath) {
    const fontData = await loadFontData(fontPath);
    // fontRef is a PDF *name* written verbatim into content streams — the
    // leading slash is mandatory (a bare `noto` would corrupt the file).
    if (fontData) fontEntries.push({ fontData, fontRef: '/noto', lang: 'ar' });
}

const doc = (
    <Document title="Custom fonts">
        <Heading level={1}>Custom fonts</Heading>
        <Paragraph>
            {fontPath
                ? 'A custom font was registered for non-Latin coverage.'
                : 'Set NOTO_FONT to a .ttf path to embed a non-Latin font.'}
        </Paragraph>
        {fontPath ? <Paragraph>مرحبا بالعالم</Paragraph> : null}
    </Document>
);

await renderToFile(doc, 'custom-fonts.pdf', { fontEntries });
console.log('Wrote custom-fonts.pdf');
