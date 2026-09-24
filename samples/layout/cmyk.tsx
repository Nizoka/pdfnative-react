/**
 * CMYK colour on every colour position (pdfnative 1.8.0).
 *
 * Run with: npx tsx samples/layout/cmyk.tsx
 * Writes `cmyk.pdf` to the current directory.
 *
 * The engine reads the colour space from the component count: three values
 * are DeviceRGB, four are DeviceCMYK. A CMYK colour is a tuple in percent
 * (`[c, m, y, k]`, 0–100) or a four-operand string (`'c m y k'`, 0.0–1.0),
 * and it is accepted wherever a colour is: headings, paragraphs, links, table
 * zebra stripes and borders, chart palettes and series, the document palette
 * (`layout.colors`), watermarks, headers and footers.
 *
 * Under a PDF/A or PDF/X claim whose output intent is not CMYK the engine
 * reports `PDFA_DEVICE_CMYK_CONTENT` / `PDFX_DEVICE_CMYK` — the linter's
 * `L_CMYK_INTENT_MISMATCH` says so first. This document makes no claim, so
 * DeviceCMYK is simply what a print workflow expects.
 */

import React from 'react';
import { Chart, Document, Heading, Link, Paragraph, Table, renderToFile } from '../../src/index.js';

const INK = [0, 0, 0, 100] as const; // rich black: 100 % K
const RED = '0 1 1 0'; // C M Y K operands: magenta + yellow

const doc = (
    <Document
        title="CMYK colours"
        header={{ left: 'Acme Inc', right: 'Plates: C M Y K', color: [0, 0, 0, 60] }}
        footer={{ center: 'Page {page} of {pages}', color: [0, 0, 0, 60] }}
        watermark={{ text: { text: 'PROOF', color: '0 0 0 0.15', opacity: 0.5 } }}
        layout={{ colors: { title: INK } as never }}
    >
        <Heading level={1} color={INK}>
            CMYK on every colour position
        </Heading>
        <Paragraph color={RED}>Body text in a two-plate red (magenta + yellow).</Paragraph>
        <Paragraph color={[100, 0, 0, 0]}>A cyan paragraph, as a percent tuple.</Paragraph>
        <Link url="https://pdfnative.dev" color={[0, 60, 100, 0]}>
            A link in an orange built from magenta and yellow
        </Link>
        <Table
            headers={['Plate', 'Tuple', 'Operands']}
            rows={[
                { cells: ['Cyan', '[100, 0, 0, 0]', "'1 0 0 0'"], type: 'default', pointed: false },
                { cells: ['Magenta', '[0, 100, 0, 0]', "'0 1 0 0'"], type: 'default', pointed: false },
                { cells: ['Yellow', '[0, 0, 100, 0]', "'0 0 1 0'"], type: 'default', pointed: false },
                { cells: ['Black', '[0, 0, 0, 100]', "'0 0 0 1'"], type: 'default', pointed: false },
            ]}
            zebra={[0, 0, 0, 8]}
            cellBorders={{ all: true, color: '0 0 0 0.4', width: 0.5 }}
        />
        <Chart
            chartType="bar"
            categories={['C', 'M', 'Y', 'K']}
            series={[{ label: 'Coverage', values: [100, 100, 100, 100], color: INK }]}
            colors={['1 0 0 0', [0, 100, 0, 0], [0, 0, 100, 0], INK]}
            title="One bar per plate"
            altText="Four bars of equal height, one per process colour."
        />
    </Document>
);

await renderToFile(doc, 'cmyk.pdf');
console.log('Wrote cmyk.pdf');
