/**
 * Outline / bookmarks + page labels sample.
 *
 * Writes two PDFs: an explicit nested bookmark tree with roman/decimal page
 * labels, and an `outline="auto"` document derived from its headings.
 *
 * Run with: npx tsx samples/structure/outline.tsx
 */

import React from 'react';
import {
    Document,
    Heading,
    PageBreak,
    Paragraph,
    renderToFile,
    type OutlineItem,
    type PageLabelRange,
} from '../../src/index.js';

// Explicit tree: nested children, styling, collapsed state.
const outline: readonly OutlineItem[] = [
    { title: 'Cover', pageIndex: 0, bold: true },
    {
        title: 'Part I — Findings',
        pageIndex: 1,
        color: '#1a4f8b',
        open: true,
        children: [
            { title: 'Summary', pageIndex: 1 },
            { title: 'Details', pageIndex: 2, italic: true },
        ],
    },
];

// Roman numerals for the front matter, decimals from the body onwards.
const pageLabels: readonly PageLabelRange[] = [
    { startPage: 0, style: 'roman' },
    { startPage: 1, style: 'decimal', start: 1 },
];

const explicit = (
    <Document title="Annual report" outline={outline} pageLabels={pageLabels}>
        <Heading level={1}>Cover</Heading>
        <Paragraph>The sidebar shows a styled, nested bookmark tree.</Paragraph>
        <PageBreak />
        <Heading level={1}>Part I — Findings</Heading>
        <Paragraph>This page is labeled "1" — the cover was "i".</Paragraph>
        <PageBreak />
        <Heading level={2}>Details</Heading>
        <Paragraph>Bookmarks jump straight to their target page.</Paragraph>
    </Document>
);

// `outline="auto"` derives a flat outline from every heading in order.
const auto = (
    <Document title="Auto outline" outline="auto">
        <Heading level={1}>Introduction</Heading>
        <Paragraph>Every heading becomes a bookmark automatically.</Paragraph>
        <Heading level={2}>Method</Heading>
        <Paragraph>No outline data to maintain by hand.</Paragraph>
    </Document>
);

await renderToFile(explicit, 'outline.pdf');
await renderToFile(auto, 'outline-auto.pdf');
console.log('Wrote outline.pdf and outline-auto.pdf');
