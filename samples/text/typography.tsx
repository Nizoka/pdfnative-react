/**
 * Typography sample — headings, paragraphs, alignment, color, indent.
 *
 * Run with: npx tsx samples/text/typography.tsx
 * Writes `typography.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Paragraph, Spacer, renderToFile } from '../../src/index.js';

const doc = (
    <Document title="Typography">
        <Heading level={1}>Heading level 1</Heading>
        <Heading level={2}>Heading level 2</Heading>
        <Heading level={3} color="#2563eb">
            Heading level 3 (colored)
        </Heading>
        <Spacer height={8} />

        <Paragraph>Default left-aligned body text flows and wraps automatically.</Paragraph>
        <Paragraph align="center">Centered paragraph.</Paragraph>
        <Paragraph align="right">Right-aligned paragraph.</Paragraph>
        <Spacer height={6} />

        <Paragraph fontSize={13} lineHeight={1.6} indent={24} color="#374151">
            A larger paragraph with a custom font size, looser line height, a first-line indent
            and a custom color — every knob maps straight onto a pdfnative paragraph block.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'typography.pdf');
console.log('Wrote typography.pdf');
