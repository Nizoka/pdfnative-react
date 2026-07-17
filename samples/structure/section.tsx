/**
 * Section sample — `<Section>` pairs a heading with grouped content.
 *
 * Run with: npx tsx samples/structure/section.tsx
 * Writes `section.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    List,
    Paragraph,
    Section,
    TableOfContents,
    renderToFile,
} from '../../src/index.js';

const doc = (
    <Document title="Quarterly review" outline="auto">
        <TableOfContents title="Contents" />

        <Section title="Highlights" level={1}>
            <Paragraph>Revenue grew 14% quarter over quarter.</Paragraph>
            <List items={['New enterprise tier', 'Two platform launches']} />
        </Section>

        <Section title="Risks" level={1} color="#8b1a1a">
            <Paragraph>Supply constraints may push Q3 deliveries.</Paragraph>
        </Section>

        {/* `break` starts the section on a fresh page. */}
        <Section title="Appendix" level={2} break>
            <Paragraph>
                A Section is pure sugar — it compiles to a Heading followed by
                its children, so it feeds the TOC and `outline="auto"` like any
                hand-written heading.
            </Paragraph>
        </Section>
    </Document>
);

await renderToFile(doc, 'section.pdf');
console.log('Wrote section.pdf');
