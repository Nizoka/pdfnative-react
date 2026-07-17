/**
 * Table styling sample — cell borders, vertical alignment, amount columns.
 *
 * Run with: npx tsx samples/table/cell-borders.tsx
 * Writes `cell-borders.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Paragraph, Table, renderToFile } from '../../src/index.js';

const rows = [
    { cells: ['Consulting', '3 days', '2,400.00'], type: 'default', pointed: false },
    { cells: ['Refund — overage', '1', '-150.00'], type: 'debit', pointed: false },
    { cells: ['Support retainer', '12 mo', '1,800.00'], type: 'credit', pointed: false },
];

const doc = (
    <Document title="Table styling">
        <Heading level={1}>Full grid, dashed</Heading>
        <Table
            headers={['Service', 'Qty', 'Amount']}
            rows={rows}
            cellBorders={{ all: true, color: '#94a3b8', width: 0.6, style: 'dashed' }}
            columns={[
                { f: 0.55, a: 'l', mx: 40, mxH: 40 },
                { f: 0.2, a: 'c', mx: 12, mxH: 12 },
                // `kind: 'amount'` opts into bold + credit/debit coloring.
                { f: 0.25, a: 'r', mx: 14, mxH: 14, kind: 'amount' },
            ]}
        />

        <Heading level={1}>Vertical alignment</Heading>
        <Paragraph>Cells center vertically; the last column bottom-aligns.</Paragraph>
        <Table
            headers={['Wrapped content', 'Middle', 'Bottom']}
            rows={[
                {
                    cells: [
                        'A long cell that wraps onto several lines to make the row tall.',
                        'centered',
                        'bottom',
                    ],
                    type: 'default',
                    pointed: false,
                },
            ]}
            cellVAlign="middle"
            cellBorders={{ bottom: true }}
            columns={[
                { f: 0.5, a: 'l', mx: 60, mxH: 60 },
                { f: 0.25, a: 'c', mx: 12, mxH: 12 },
                { f: 0.25, a: 'c', mx: 12, mxH: 12, vAlign: 'bottom' },
            ]}
        />
    </Document>
);

await renderToFile(doc, 'cell-borders.pdf');
console.log('Wrote cell-borders.pdf');
