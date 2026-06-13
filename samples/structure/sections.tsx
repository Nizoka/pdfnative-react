/**
 * Document structure sample — multi-page, TOC, page breaks, spacers.
 *
 * Run with: npx tsx samples/structure/sections.tsx
 * Writes `sections.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    PageBreak,
    Paragraph,
    Spacer,
    TableOfContents,
    renderToFile,
} from '../../src/index.js';

const doc = (
    <Document title="Structured document" footerText="Structure demo">
        <Heading level={1}>Front matter</Heading>
        <TableOfContents title="Contents" maxLevel={2} />
        <PageBreak />

        <Heading level={1}>1. Introduction</Heading>
        <Paragraph>Headings feed the auto-generated table of contents above.</Paragraph>
        <Heading level={2}>1.1 Background</Heading>
        <Paragraph>Sub-headings appear indented in the TOC.</Paragraph>
        <Spacer height={16} />
        <Heading level={2}>1.2 Scope</Heading>
        <Paragraph>A spacer adds deliberate vertical whitespace.</Paragraph>
        <PageBreak />

        <Heading level={1}>2. Conclusion</Heading>
        <Paragraph>A hard page break starts this section on a fresh page.</Paragraph>
    </Document>
);

await renderToFile(doc, 'sections.pdf');
console.log('Wrote sections.pdf');
