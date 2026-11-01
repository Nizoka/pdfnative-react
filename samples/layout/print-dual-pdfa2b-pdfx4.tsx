/**
 * One file, both claims — PDF/A-2b and PDF/X-4 together (engine 1.9.0).
 *
 * Run with: npx tsx samples/layout/print-dual-pdfa2b-pdfx4.tsx
 * Writes `print-dual-pdfa2b-pdfx4.pdf` to the current directory, lints it
 * first, and checks the bytes with the engine's `validatePdfX()` afterwards.
 *
 * A print file that must also be archived used to be two documents. Since
 * engine 1.9.0 `tagged="pdfa2b"` (or `'pdfa2u'`) combines with
 * `pdfx="pdfx4"`: the XMP carries both identifications, the structure tree
 * and the TrimBox coexist, and the output intent serves both standards.
 * PDF/A-1 (PDF 1.4, no PDF/X-4) and PDF/A-3 (embedded files, which PDF/X
 * forbids) still refuse the pair — `L_PDFX_TAGGED_CONFLICT` says so with the
 * engine's own two messages, one tier before the throw.
 *
 * Everything PDF/X-4 needs still applies: embedded fonts, a `prtr` output
 * profile, a known trapping state, a TrimBox. The synthetic CMYK profile
 * characterises no press — NEVER use it for a real job. The repository's
 * conformance corpus runs the same combination through veraPDF.
 */

import React from 'react';
import { readFile } from 'node:fs/promises';
import { validatePdfX } from 'pdfnative';
import { Document, Heading, Paragraph, Table, lintDocument, renderToFile, resolveFonts } from '../../src/index.js';
import { buildSyntheticCmykProfile } from '../../scripts/lib/synthetic-icc.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

const BLEED = 9;
const TRIM_W = 595.28;
const TRIM_H = 841.89;

const doc = (
    <Document
        title="Archived press sheet"
        tagged="pdfa2b"
        pdfx="pdfx4"
        fontEntries={fontEntries}
        metadata={{ author: 'Acme Inc', subject: 'PDF/A-2b and PDF/X-4 in one file', trapped: 'False' }}
        outputIntent={{
            iccProfile: buildSyntheticCmykProfile(),
            outputConditionIdentifier: 'Synthetic CMYK (sample only — not a press condition)',
        }}
        print={{ bleed: BLEED, marks: true }}
        layout={{ pageWidth: TRIM_W + 2 * BLEED, pageHeight: TRIM_H + 2 * BLEED }}
    >
        <Heading level={1} color={[0, 0, 0, 100]}>
            Archived press sheet
        </Heading>
        <Paragraph>
            Tagged for accessibility and archival (PDF/A-2b), trimmed and intent-bound
            for the press (PDF/X-4). One set of bytes satisfies both validators.
        </Paragraph>
        <Table
            headers={['Standard', 'Guarantees']}
            rows={[
                { cells: ['PDF/A-2b', 'Embedded fonts, tagged structure, no encryption, device-independent colour'], type: 'default', pointed: false },
                { cells: ['PDF/X-4', 'Output intent, TrimBox, known trapping, no annotations in the bleed'], type: 'default', pointed: false },
            ]}
        />
    </Document>
);

const report = lintDocument(doc);
if (!report.ok) {
    for (const f of report.findings) console.error(`${f.severity} ${f.code}: ${f.message}`);
    process.exit(1);
}

await renderToFile(doc, 'print-dual-pdfa2b-pdfx4.pdf');
const bytes = new Uint8Array(await readFile('print-dual-pdfa2b-pdfx4.pdf'));
const result = validatePdfX(bytes);
const text = new TextDecoder('latin1').decode(bytes);
console.log(`validatePdfX: ${result.valid ? 'valid' : 'INVALID'}; pdfaid:part ${text.includes('pdfaid:part') ? 'present' : 'MISSING'}`);
console.log('Wrote print-dual-pdfa2b-pdfx4.pdf');
