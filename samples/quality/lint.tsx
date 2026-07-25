/**
 * Accessibility and layout linting.
 *
 * Run with: npx tsx samples/quality/lint.tsx
 * Prints a report; writes nothing.
 *
 * `lintDocument` runs on the compiled document model, so it covers JSX and
 * DocSpec identically. It is pure — it never logs on its own and never throws
 * for a finding; what you do with the report is your call. Wire it into CI, a
 * dev-mode warning, or an agent's self-check loop.
 *
 * Four rules pre-empt hard failures further down the pipeline: the three
 * `L_CHART_*` errors mirror the engine's own validation (which throws at render
 * time), and `L_TAGGED_NO_FONTS` catches the PDF/A file that veraPDF would
 * reject for a non-embedded font.
 */

import React from 'react';
import {
    Chart,
    Document,
    FormField,
    Heading,
    Image,
    Link,
    Paragraph,
    Table,
    lintDocument,
} from '../../src/index.js';
import type { LintReport } from '../../src/index.js';

const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A document with one instance of most problems the linter knows about. */
const problematic = (
    <Document tagged="pdfa2b">
        <Heading level={1}>Quarterly report</Heading>
        {/* Skips level 2 → L_HEADING_HIERARCHY */}
        <Heading level={3}>Revenue</Heading>
        {/* No alt → L_IMAGE_ALT */}
        <Image data={PIXEL} />
        {/* No headers → L_TABLE_HEADERS */}
        <Table rows={[{ cells: ['12000'], type: 'default', pointed: false }]} />
        {/* Link text is the bare URL → L_LINK_TEXT */}
        <Link url="https://acme.example/q4">https://acme.example/q4</Link>
        {/* No altText → L_CHART_ALT (info), and a pie with two series → L_CHART_SERIES */}
        <Chart
            chartType="pie"
            series={[
                { label: 'Direct', values: [46] },
                { label: 'Partners', values: [27] },
            ]}
        />
        {/* No label → L_FIELD_LABEL */}
        <FormField fieldType="text" name="email" />
        <Paragraph>…</Paragraph>
        {/* tagged="pdfa2b" with no fontEntries → L_TAGGED_NO_FONTS (error) */}
    </Document>
);

function print(title: string, report: LintReport): void {
    const { error, warning, info } = report.counts;
    console.log(`\n${title}`);
    console.log(
        `  ok=${String(report.ok)}  ${String(error)} error(s), ${String(warning)} warning(s), ${String(info)} info`,
    );
    for (const f of report.findings) {
        const where = f.blockIndex === undefined ? '' : ` [block ${String(f.blockIndex)}]`;
        console.log(`  ${f.severity.toUpperCase().padEnd(7)} ${f.code}${where}`);
        console.log(`          ${f.message}`);
        if (f.hint !== undefined) console.log(`          → ${f.hint}`);
    }
}

print('Full report', lintDocument(problematic));

// Filter to the rules you care about — useful when adopting the linter on an
// existing codebase and fixing one class of problem at a time.
print(
    'Accessibility only',
    lintDocument(problematic, { rules: ['L_IMAGE_ALT', 'L_TABLE_HEADERS', 'L_FIELD_LABEL'] }),
);

// The geometric check needs a full layout pass, so it is opt-in.
print(
    'With the overflow check',
    lintDocument(
        <Document>
            <Chart
                chartType="bar"
                series={[{ label: 'A', values: [1, 2, 3] }]}
                height={4000}
                altText="A chart far taller than the page."
            />
        </Document>,
        { overflow: true },
    ),
);

// A typical CI gate: fail the build on errors, surface warnings.
const gate = lintDocument(problematic);
if (!gate.ok) {
    console.log(
        `\nCI would fail here: ${String(gate.counts.error)} blocking finding(s).`,
    );
}
