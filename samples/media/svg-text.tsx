/**
 * SVG text sample — `<text>`/`<tspan>` inside SVG markup renders as native,
 * selectable PDF text (engine 1.5.0). No new wrapper API: the markup simply
 * flows through `<Svg data>`.
 *
 * Run with: npx tsx samples/media/svg-text.tsx
 * Writes `svg-text.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Paragraph, Svg, renderToFile } from '../../src/index.js';

const badge = `
<svg viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="236" height="76" rx="10" fill="#eef2ff" stroke="#1a4f8b"/>
    <text x="120" y="34" text-anchor="middle" font-size="18" fill="#1a4f8b">pdfnative</text>
    <text x="120" y="58" text-anchor="middle" font-size="12" fill="#334155">
        <tspan>vector labels, </tspan><tspan dx="2" fill="#0a7d33">searchable</tspan>
    </text>
</svg>`;

const doc = (
    <Document title="SVG text">
        <Heading level={1}>Labels inside vector art</Heading>
        <Svg data={badge} width={240} height={80} alt="pdfnative badge" />
        <Paragraph>
            The badge text above is real PDF text — try selecting or searching
            it in a viewer. text-anchor, font-size, fill, and tspan offsets are
            honored.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'svg-text.pdf');
console.log('Wrote svg-text.pdf');
