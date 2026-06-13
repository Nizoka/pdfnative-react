/**
 * SVG sample — inline vector graphics rendered with PDF path operators.
 *
 * Run with: npx tsx samples/media/svg.tsx
 * Writes `svg.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Svg, renderToFile } from '../../src/index.js';

const star =
    'M50 5 L61 39 L97 39 L68 61 L79 95 L50 73 L21 95 L32 61 L3 39 L39 39 Z';

const doc = (
    <Document title="SVG">
        <Heading level={1}>Vector graphics</Heading>
        <Svg
            data={star}
            width={160}
            height={160}
            viewBox={[0, 0, 100, 100]}
            fill="#f59e0b"
            stroke="#b45309"
            strokeWidth={2}
            align="center"
            alt="Gold star"
        />
    </Document>
);

await renderToFile(doc, 'svg.pdf');
console.log('Wrote svg.pdf');
