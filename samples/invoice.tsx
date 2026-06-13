/**
 * Invoice sample.
 *
 * Run with: npx tsx samples/invoice.tsx
 * Writes `invoice.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    Spacer,
    Table,
    renderToFile,
} from '../src/index.js';

const invoice = (
    <Document
        title="Invoice #1024"
        footerText="Acme Inc · hello@acme.example"
        metadata={{ author: 'Acme Inc', subject: 'Invoice #1024' }}
    >
        <Heading level={1}>Invoice #1024</Heading>
        <Paragraph color="#555">Issued 2026-01-15 · Due 2026-02-15</Paragraph>
        <Spacer height={12} />

        <Paragraph>
            Billed to: Globex Corporation, 500 Terminal Road, Springfield.
        </Paragraph>
        <Spacer height={8} />

        <Table
            headers={['Item', 'Qty', 'Unit', 'Total']}
            rows={[
                { cells: ['Pro plan (annual)', '1', '$490.00', '$490.00'], type: 'default', pointed: false },
                { cells: ['Extra seats', '5', '$12.00', '$60.00'], type: 'default', pointed: false },
                { cells: ['Priority support', '1', '$99.00', '$99.00'], type: 'default', pointed: false },
            ]}
            zebra
        />
        <Spacer height={8} />

        <Paragraph align="right">Total due: $649.00</Paragraph>
    </Document>
);

await renderToFile(invoice, 'invoice.pdf');
// eslint-disable-next-line no-console
console.log('Wrote invoice.pdf');
