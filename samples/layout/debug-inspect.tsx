/**
 * Layout debugging sample — visual overlay + programmatic inspection.
 *
 * `layout.debug` draws margin/content/cell boxes into the PDF;
 * `inspectDocument` reports the same geometry as data, without rendering.
 *
 * Run with: npx tsx samples/layout/debug-inspect.tsx
 * Writes `debug-overlay.pdf` and prints the layout report to stdout.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    Table,
    inspectDocument,
    renderToFile,
} from '../../src/index.js';

const doc = (
    <Document title="Layout debugging">
        <Heading level={1}>Debug overlay</Heading>
        <Paragraph>
            Margin, content, and table-cell boxes are outlined in this build.
            Remove `layout.debug` and the output is byte-identical to a normal
            render.
        </Paragraph>
        <Table
            headers={['Feature', 'Purpose']}
            rows={[
                { cells: ['debug overlay', 'see the boxes'], type: 'default', pointed: false },
                { cells: ['inspectDocument', 'assert the boxes'], type: 'default', pointed: false },
            ]}
        />
    </Document>
);

await renderToFile(doc, 'debug-overlay.pdf', { layout: { debug: true } });
console.log('Wrote debug-overlay.pdf');

// Same geometry as data — deterministic, ideal for tests and tooling.
const report = inspectDocument(doc);
console.log(`Pages: ${report.totalPages} (${report.pageWidth}x${report.pageHeight}pt)`);
for (const page of report.pages) {
    for (const block of page.blocks) {
        console.log(
            `  p${page.index} ${block.type.padEnd(10)} x=${block.x} top=${block.top} `
            + `w=${Math.round(block.width)} h=${Math.round(block.height)}`,
        );
    }
}
