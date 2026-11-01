/**
 * Spot colours — named inks through `print.spotColours`, `{ spot }` and
 * `{ inks }` colour values (engine 1.9.0), on a PDF/X-4 sheet.
 *
 * Run with: npx tsx samples/layout/print-spot-colours.tsx
 * Writes `print-spot-colours.pdf` to the current directory, lints it first,
 * and checks the bytes with the engine's `validatePdfX()` afterwards.
 *
 * A spot colour is an ink the press mixes beforehand — a brand blue, a
 * varnish, a metallic — rather than a CMYK build. The document declares each
 * ink once with a process *alternate* (what a CMYK or RGB device shows in its
 * place), then paints with `{ spot: name, tint? }` (a `/Separation` colour
 * space) or `{ inks: { name: tint, … } }` (a `/DeviceN` mix) on any colour
 * position: headings, paragraphs, table zebra and borders, chart palettes and
 * — new in 1.9.0 — one colour per bar through `ChartSeries.colors`.
 *
 * Two rules keep the file printable before the engine throws: every named
 * ink must be declared (`L_SPOT_UNDECLARED`) and the inks of a mix must
 * share an alternate space (`L_SPOT_INK_MIX`); an invalid declaration is
 * `L_PRINT_BOXES`. Colour bars paint the process inks only. The synthetic
 * CMYK output profile characterises no press — NEVER use it for a real job.
 */

import React from 'react';
import { readFile } from 'node:fs/promises';
import { validatePdfX } from 'pdfnative';
import { Chart, Document, Heading, Paragraph, Table, lintDocument, renderToFile, resolveFonts } from '../../src/index.js';
import type { PrintOptions } from '../../src/index.js';
import { buildSyntheticCmykProfile } from '../../scripts/lib/synthetic-icc.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const BLEED = 14.17; // 5 mm
const TRIM_W = 595.28;
const TRIM_H = 841.89;

const print: PrintOptions = {
    bleed: BLEED,
    marks: { crop: true, registration: true, colourBars: true },
    spotColours: [
        { name: 'Brand Blue', alternate: [100, 44, 0, 0] }, // a CMYK alternate
        { name: 'Warm Grey', alternate: [0, 5, 10, 45] },
        { name: 'Varnish', alternate: [0, 0, 0, 8] },
    ],
};

const doc = (
    <Document
        title="Spot colours"
        pdfx="pdfx4"
        fontEntries={fontEntries}
        metadata={{ author: 'Acme Inc', trapped: 'False' }}
        outputIntent={{
            iccProfile: buildSyntheticCmykProfile(), // your press profile goes here
            outputConditionIdentifier: 'Synthetic CMYK (sample only — not a press condition)',
        }}
        print={print}
        layout={{ pageWidth: TRIM_W + 2 * BLEED, pageHeight: TRIM_H + 2 * BLEED }}
    >
        <Heading level={1} color={{ spot: 'Brand Blue' }}>
            Brand blue, as a plate of its own
        </Heading>
        <Paragraph color={{ spot: 'Brand Blue', tint: 0.5 }}>
            A 50 % tint of the same ink — one /Separation space, one plate, screened by the RIP.
        </Paragraph>
        <Paragraph color={{ inks: { 'Brand Blue': 1, Varnish: 0.6 } }}>
            An ink mix: full Brand Blue under 60 % varnish, through a /DeviceN space over the two inks.
        </Paragraph>
        <Table
            headers={['Plate', 'Alternate', 'Use']}
            rows={[
                { cells: ['Brand Blue', 'C100 M44', 'Headings, chart'], type: 'default', pointed: false },
                { cells: ['Warm Grey', 'K45 + warm', 'Rules, zebra'], type: 'default', pointed: false },
                { cells: ['Varnish', 'K8 (preview only)', 'Spot varnish'], type: 'default', pointed: false },
            ]}
            zebra={{ spot: 'Warm Grey', tint: 0.15 }}
            cellBorders={{ all: true, color: { spot: 'Warm Grey' } }}
        />
        <Heading level={2} color={{ spot: 'Warm Grey' }}>
            Ink coverage per plate
        </Heading>
        <Chart
            chartType="bar"
            categories={['Brand Blue', 'Warm Grey', 'Varnish']}
            series={[
                {
                    label: 'Coverage (%)',
                    values: [38, 22, 61],
                    // One colour per bar: each plate drawn in its own ink (engine 1.9.0).
                    colors: [{ spot: 'Brand Blue' }, { spot: 'Warm Grey' }, { spot: 'Varnish' }],
                },
            ]}
            axis={{ yMin: 0, yMax: 100 }}
            dataLabels={{ suffix: ' %' }}
            altText="Ink coverage per plate: Brand Blue 38 %, Warm Grey 22 %, Varnish 61 %."
        />
    </Document>
);

const report = lintDocument(doc);
if (!report.ok) {
    for (const f of report.findings) console.error(`${f.severity} ${f.code}: ${f.message}`);
    process.exit(1);
}

await renderToFile(doc, 'print-spot-colours.pdf');
const result = validatePdfX(new Uint8Array(await readFile('print-spot-colours.pdf')));
console.log(`validatePdfX: ${result.valid ? 'valid' : 'INVALID'} (${String(result.errors.length)} error(s), ${String(result.warnings.length)} warning(s))`);
console.log('Wrote print-spot-colours.pdf');
