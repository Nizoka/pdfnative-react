/**
 * PDF/X-4 (ISO 15930-7) — a press-ready sheet: a CMYK output intent, CMYK
 * colours, crop marks and colour bars in a 5 mm bleed, a known trapping state.
 *
 * Run with: npx tsx samples/layout/print-pdfx4.tsx
 * Writes `print-pdfx4.pdf` to the current directory, lints it first, and
 * checks the bytes with the engine's `validatePdfX()` afterwards.
 *
 * `pdfx="pdfx4"` writes a PDF 1.6 header, the PDF/X-4 XMP identification, a
 * /GTS_PDFX output intent, a TrimBox on every page and /Trapped. It needs an
 * `outputIntent` carrying the printer's output profile (ICC device class
 * `prtr`) — the profile of the printing condition your printer names (ISO
 * Coated v2, GRACoL, …). pdfnative ships none; the synthetic CMYK profile
 * below is structurally valid but characterises no press. NEVER use it for a
 * real job. Fonts must be embedded, `metadata.trapped` must be 'True' or
 * 'False', and the claim cannot be combined with `tagged` or encryption —
 * each constraint is an `L_PDFX_*` lint rule before it is an engine throw.
 *
 * `validatePdfX()` is the engine's structural validator (docs/RECIPES.md); a
 * `valid` verdict means the ISO 15930-7 prerequisites hold. It is not a
 * certified preflight: before sending a file to press, confirm it with a
 * certified tool (callas pdfToolbox, Acrobat Preflight).
 */

import React from 'react';
import { readFile } from 'node:fs/promises';
import { validatePdfX } from 'pdfnative';
import { Document, Heading, Paragraph, Table, lintDocument, renderToFile, resolveFonts } from '../../src/index.js';
import { buildSyntheticCmykProfile } from '../../scripts/lib/synthetic-icc.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const BLEED = 14.17; // 5 mm — enough for the colour bars' 12 pt patches
const TRIM_W = 595.28; // A4 trim size…
const TRIM_H = 841.89;

const doc = (
    <Document
        title="Press sheet"
        pdfx="pdfx4"
        fontEntries={fontEntries}
        metadata={{ author: 'Acme Inc', trapped: 'False' }} // pdfnative never traps
        outputIntent={{
            iccProfile: buildSyntheticCmykProfile(), // your press profile goes here
            outputConditionIdentifier: 'Synthetic CMYK (sample only — not a press condition)',
        }}
        print={{
            bleed: BLEED,
            marks: { crop: true, registration: true, colourBars: true }, // C, M, Y, K at 100 % and 50 %
        }}
        layout={{ pageWidth: TRIM_W + 2 * BLEED, pageHeight: TRIM_H + 2 * BLEED }}
    >
        <Heading level={1} color={[0, 0, 0, 100]}>
            Press sheet
        </Heading>
        <Paragraph color="0 1 1 0">
            Rich red body text, set in DeviceCMYK. Under a CMYK output intent every
            colour here is a plate value, not a screen colour.
        </Paragraph>
        <Table
            headers={['Plate', 'Coverage']}
            rows={[
                { cells: ['Cyan', '100 %'], type: 'default', pointed: false },
                { cells: ['Magenta', '100 %'], type: 'default', pointed: false },
                { cells: ['Black', '100 %'], type: 'default', pointed: false },
            ]}
            zebra={[0, 0, 0, 6]}
        />
        <Paragraph>
            Crop marks and registration targets are stroked in the registration
            colour (the All separation) outside the trim; the colour bars sit in
            the bottom bleed strip.
        </Paragraph>
    </Document>
);

// Tier 3 first: every PDF/X coherence rule is a lint finding before it is a throw.
const report = lintDocument(doc);
if (!report.ok) {
    for (const f of report.findings) console.error(`${f.code}: ${f.message}`);
    process.exit(1);
}

await renderToFile(doc, 'print-pdfx4.pdf');
console.log('Wrote print-pdfx4.pdf');

// Tier 5: the engine's own structural check on the bytes that were written.
const result = validatePdfX(await readFile('print-pdfx4.pdf'));
console.log(`validatePdfX: ${result.valid ? 'valid' : 'INVALID'} (${String(result.errors.length)} errors, ${String(result.warnings.length)} warnings)`);
for (const e of result.errors) console.log(`  - ${e}`);
