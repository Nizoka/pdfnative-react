/**
 * Data table sample — JSX rows/cells, header row, typed rows, zebra, caption.
 *
 * Run with: npx tsx samples/table/data-table.tsx
 * Writes `data-table.pdf` to the current directory.
 *
 * Shows both authoring styles:
 *   1. Declarative <Row>/<Cell> children (this file).
 *   2. Data-driven `headers`/`rows` props (see samples/invoice.tsx).
 */

import React from 'react';
import { Cell, Document, Heading, Row, Spacer, Table, renderToFile } from '../../src/index.js';

const doc = (
    <Document title="Account statement">
        <Heading level={1}>Account statement</Heading>
        <Spacer height={8} />

        <Table caption="Transactions — June 2026" zebra repeatHeader>
            <Row header>
                <Cell>Date</Cell>
                <Cell>Description</Cell>
                <Cell>Amount</Cell>
            </Row>
            <Row variant="credit">
                <Cell>2026-06-01</Cell>
                <Cell>Salary</Cell>
                <Cell>+$4,200.00</Cell>
            </Row>
            <Row variant="debit">
                <Cell>2026-06-03</Cell>
                <Cell>Groceries</Cell>
                <Cell>-$86.40</Cell>
            </Row>
            <Row variant="debit" pointed>
                <Cell>2026-06-09</Cell>
                <Cell>Rent</Cell>
                <Cell>-$1,500.00</Cell>
            </Row>
        </Table>
    </Document>
);

await renderToFile(doc, 'data-table.pdf');
console.log('Wrote data-table.pdf');
