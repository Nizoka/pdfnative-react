/**
 * Multi-page report sample with a table of contents.
 *
 * Run with: npx tsx samples/report.tsx
 * Writes `report.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    List,
    Page,
    Paragraph,
    Spacer,
    TableOfContents,
    renderToFile,
} from '../src/index.js';

const report = (
    <Document title="Quarterly Report" footerText="Confidential — Q1 2026">
        <Page>
            <Heading level={1}>Quarterly Report</Heading>
            <Paragraph color="#555">Q1 2026 · Prepared by the Platform team</Paragraph>
            <Spacer height={12} />
            <TableOfContents title="Contents" maxLevel={2} />
        </Page>

        <Page>
            <Heading level={1}>1. Summary</Heading>
            <Paragraph>
                Adoption of the document pipeline grew steadily across the quarter,
                with on-device rendering eliminating SaaS round-trips entirely.
            </Paragraph>
            <Spacer height={8} />
            <Heading level={2}>1.1 Highlights</Heading>
            <List
                items={[
                    'Zero external rendering services',
                    'Deterministic, byte-stable output',
                    'Streaming export for large documents',
                ]}
            />
        </Page>

        <Page>
            <Heading level={1}>2. Next steps</Heading>
            <List
                ordered
                items={['Ship React 18 support', 'Add font auto-registration', 'Publish docs site']}
            />
        </Page>
    </Document>
);

await renderToFile(report, 'report.pdf');
// eslint-disable-next-line no-console
console.log('Wrote report.pdf');
