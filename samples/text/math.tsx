/**
 * Math typesetting sample — Unicode math operators via the bundled
 * Noto Sans Math font (engine 1.5.0, lang key `'math'`).
 *
 * Run with: npx tsx samples/text/math.tsx
 * Writes `math.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    renderToBytes,
    resolveFonts,
} from '../../src/index.js';
import { writeFile } from 'node:fs/promises';

// Register + load the math font, and get concrete fontEntries back.
const fontEntries = await resolveFonts({
    math: () => import('pdfnative/fonts/noto-sans-math-data.js'),
});

const doc = (
    <Document title="Math">
        <Heading level={1}>Math operators</Heading>
        <Paragraph>∀x ∈ ℝ: x² ≥ 0 ∧ √(x²) = |x|</Paragraph>
        <Paragraph>∑ᵢ aᵢ ⊗ bᵢ ≠ ∅ ⇒ A ∩ B ⊆ C</Paragraph>
        <Paragraph>
            Math codepoints are detected automatically and routed to the math
            font; surrounding Latin text keeps the default font.
        </Paragraph>
    </Document>
);

const bytes = renderToBytes(doc, { fontEntries });
await writeFile('math.pdf', bytes);
console.log('Wrote math.pdf');
