/**
 * Link sample — clickable hyperlinks.
 *
 * Run with: npx tsx samples/media/link.tsx
 * Writes `link.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Link, Paragraph, Spacer, renderToFile } from '../../src/index.js';

const doc = (
    <Document title="Links">
        <Heading level={1}>Links</Heading>
        <Paragraph>Hyperlinks are first-class annotation blocks.</Paragraph>
        <Spacer height={6} />

        <Link url="https://pdfnative.dev">pdfnative.dev</Link>
        <Link url="https://www.npmjs.com/package/pdfnative-react" color="#2563eb">
            pdfnative-react on npm
        </Link>
    </Document>
);

await renderToFile(doc, 'link.pdf');
console.log('Wrote link.pdf');
