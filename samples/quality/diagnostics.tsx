/**
 * PDF/A conformance diagnostics — `layout.onDiagnostic` and `layout.strict`.
 *
 * Run with: npx tsx samples/quality/diagnostics.tsx
 * Writes `diagnostics.pdf` to the current directory and prints the channel.
 *
 * A PDF/A level claims that every rendering font is embedded; rendering
 * `tagged="pdfa2b"` without `fontEntries` falls back to the unembedded
 * standard-14 fonts, which silently invalidates the claim (ISO 19005
 * §6.2.11.4.1). The engine surfaces that as `PDFA_NO_FONT_ENTRIES` — by
 * default once via `console.warn`, or into your `onDiagnostic` sink, or as a
 * thrown error under `strict: true` (before any bytes are produced). The
 * pre-render tier of the same check is `lintDocument` rule `L_TAGGED_NO_FONTS`.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    lintDocument,
    renderToBytes,
    renderToFile,
} from '../../src/index.js';
import type { PdfDiagnostic } from '../../src/index.js';

const content = (
    <>
        <Heading level={1}>Archival report</Heading>
        <Paragraph>
            This document claims PDF/A-2b but embeds no fonts — deliberately, to
            exercise the diagnostics channel.
        </Paragraph>
    </>
);

// 1. Collect diagnostics instead of the default console.warn.
const diagnostics: PdfDiagnostic[] = [];

await renderToFile(
    <Document
        title="Diagnostics"
        tagged="pdfa2b"
        layout={{ onDiagnostic: (d) => diagnostics.push(d) }}
    >
        {content}
    </Document>,
    'diagnostics.pdf',
);

console.log(`Rendered with ${String(diagnostics.length)} diagnostic(s):`);
for (const d of diagnostics) {
    console.log(`  ${d.severity.toUpperCase()} ${d.code}`);
    console.log(`    ${d.message}`);
}

// 2. strict: true escalates the same diagnostics to thrown errors — nothing is
//    written. onDiagnostic is ignored in this mode.
try {
    await renderToBytes(
        <Document title="Diagnostics (strict)" tagged="pdfa2b" layout={{ strict: true }}>
            {content}
        </Document>,
    );
    console.log('\nstrict: true — unexpectedly rendered');
} catch (err) {
    console.log('\nstrict: true threw as expected:');
    console.log(`  ${err instanceof Error ? err.message : String(err)}`);
}

// 3. The pre-render tier: lintDocument reports the same problem as
//    L_TAGGED_NO_FONTS before you spend a render on it.
const report = lintDocument(
    <Document title="Diagnostics" tagged="pdfa2b">
        {content}
    </Document>,
);
const finding = report.findings.find((f) => f.code === 'L_TAGGED_NO_FONTS');
console.log(`\nlintDocument pre-render: ${finding ? finding.code : 'no finding'}`);

console.log('\nWrote diagnostics.pdf');
