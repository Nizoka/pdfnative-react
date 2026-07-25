/**
 * `lintDocument` / `lintSpec` — one assertion per rule.
 *
 * The linter runs on the compiled `DocumentParams`, so JSX and DocSpec share
 * one implementation; the parity test at the bottom is what holds that claim.
 */
import { describe, expect, it } from 'vitest';
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
    lintSpec,
    LINT_RULE_CODES,
} from '../src/index.js';
import { EMITTED_LINT_RULES } from '../src/lint.js';
import type { ChartSeries, LintReport, LintRuleCode } from '../src/index.js';

const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const SERIES: readonly ChartSeries[] = [{ label: 'Revenue', values: [1, 2, 3] }];

function codes(report: LintReport): LintRuleCode[] {
    return report.findings.map((f) => f.code);
}

describe('a clean document', () => {
    it('produces no findings at all', () => {
        const report = lintDocument(
            <Document title="Clean">
                <Heading level={1}>Title</Heading>
                <Heading level={2}>Section</Heading>
                <Paragraph>Body text.</Paragraph>
                <Image data={PIXEL} alt="A single pixel" />
                <Table headers={['Item', 'Total']} rows={[]} />
                <Link url="https://pdfnative.dev">Read the docs</Link>
                <Chart chartType="bar" series={SERIES} altText="Revenue trend" />
                <FormField fieldType="text" name="email" label="Email" />
            </Document>,
        );

        expect(report.findings).toEqual([]);
        expect(report.ok).toBe(true);
        expect(report.counts).toEqual({ error: 0, warning: 0, info: 0 });
    });
});

describe('document-level rules', () => {
    it('L_EMPTY_DOCUMENT — flags a document with no blocks', () => {
        const report = lintDocument(<Document title="Nothing" />);
        expect(codes(report)).toContain('L_EMPTY_DOCUMENT');
        expect(report.ok).toBe(false);
    });

    it('L_TAGGED_NO_FONTS — PDF/A without embedded fonts is an error', () => {
        const report = lintDocument(
            <Document tagged="pdfa2b">
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_TAGGED_NO_FONTS');
        expect(report.ok).toBe(false);
    });

    it('L_TAGGED_NO_FONTS — is satisfied by fontEntries', () => {
        const report = lintDocument(
            <Document tagged="pdfa2b" fontEntries={[{ lang: 'latin' } as never]}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).not.toContain('L_TAGGED_NO_FONTS');
    });

    it('L_TAGGED_ENCRYPTED — PDF/A and encryption cannot be combined', () => {
        const report = lintDocument(
            <Document tagged layout={{ encryption: { ownerPassword: 'secret' } }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_TAGGED_ENCRYPTED');
    });

    it('L_ATTACHMENTS_NEED_PDFA3 — attachments outside PDF/A-3 are an error', () => {
        const attachment = {
            filename: 'data.xml',
            data: new Uint8Array([1]),
            mimeType: 'application/xml',
        };
        const report = lintDocument(
            <Document attachments={[attachment]}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_ATTACHMENTS_NEED_PDFA3');
        expect(report.ok).toBe(false);
    });

    it('L_ATTACHMENTS_NEED_PDFA3 — is satisfied by tagged="pdfa3b"', () => {
        const attachment = {
            filename: 'data.xml',
            data: new Uint8Array([1]),
            mimeType: 'application/xml',
        };
        const report = lintDocument(
            <Document
                attachments={[attachment]}
                tagged="pdfa3b"
                fontEntries={[{ lang: 'latin' } as never]}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).not.toContain('L_ATTACHMENTS_NEED_PDFA3');
    });

    it('L_MAX_BLOCKS — warns near the maxBlocks ceiling', () => {
        const report = lintSpec({
            layout: { maxBlocks: 10 },
            blocks: Array.from({ length: 10 }, (_, i) => ['p', `line ${String(i)}`] as const),
        });
        expect(codes(report)).toContain('L_MAX_BLOCKS');
        expect(report.ok).toBe(true);
    });

    it('L_MAX_BLOCKS_EXCEEDED — past the ceiling is an error, not an "approaching" warning', () => {
        const report = lintSpec({
            layout: { maxBlocks: 10 },
            blocks: Array.from({ length: 50 }, (_, i) => ['p', `line ${String(i)}`] as const),
        });
        expect(codes(report)).toContain('L_MAX_BLOCKS_EXCEEDED');
        expect(codes(report)).not.toContain('L_MAX_BLOCKS');
        expect(report.ok).toBe(false);
        expect(report.findings[0].message).toContain('exceeds');
    });
});

describe('accessibility rules', () => {
    it('L_IMAGE_ALT — flags an image with no alt text', () => {
        const report = lintDocument(
            <Document>
                <Image data={PIXEL} />
            </Document>,
        );
        expect(codes(report)).toContain('L_IMAGE_ALT');
        expect(report.findings[0].blockIndex).toBe(0);
        expect(report.findings[0].hint).toBeDefined();
    });

    it('L_TABLE_HEADERS — flags a table with no header row', () => {
        const report = lintDocument(
            <Document>
                <Table rows={[{ cells: ['a'], type: 'default', pointed: false }]} />
            </Document>,
        );
        expect(codes(report)).toContain('L_TABLE_HEADERS');
    });

    it('L_HEADING_HIERARCHY — flags a skipped heading level', () => {
        const report = lintSpec({ blocks: [['h1', 'Title'], ['h3', 'Too deep']] });
        expect(codes(report)).toContain('L_HEADING_HIERARCHY');
    });

    it('L_HEADING_HIERARCHY — flags a document whose first heading is too deep', () => {
        expect(codes(lintSpec({ blocks: [['h3', 'Deep']] }))).toContain('L_HEADING_HIERARCHY');
        expect(codes(lintSpec({ blocks: [['h2', 'Deep']] }))).toContain('L_HEADING_HIERARCHY');
        expect(codes(lintSpec({ blocks: [['h1', 'Fine']] }))).not.toContain(
            'L_HEADING_HIERARCHY',
        );
    });

    it('L_HEADING_HIERARCHY — accepts descending back to a shallower level', () => {
        const report = lintSpec({
            blocks: [['h1', 'A'], ['h2', 'B'], ['h3', 'C'], ['h1', 'D'], ['h2', 'E']],
        });
        expect(codes(report)).not.toContain('L_HEADING_HIERARCHY');
    });

    it('L_FIELD_LABEL — flags an unlabelled form field', () => {
        const report = lintDocument(
            <Document>
                <FormField fieldType="text" name="email" />
            </Document>,
        );
        expect(codes(report)).toContain('L_FIELD_LABEL');
    });

    it('L_LINK_TEXT — flags a link whose text is the raw URL', () => {
        const report = lintSpec({
            blocks: [['link', 'https://pdfnative.dev', { url: 'https://pdfnative.dev' }]],
        });
        expect(codes(report)).toContain('L_LINK_TEXT');
    });

    it('L_LINK_TEXT — flags a link with empty text', () => {
        const report = lintSpec({ blocks: [['link', '', { url: 'https://pdfnative.dev' }]] });
        expect(codes(report)).toContain('L_LINK_TEXT');
    });
});

describe('chart rules — pre-empting engine failures', () => {
    it('L_CHART_ALT — is informational, so it does not clear ok', () => {
        const report = lintDocument(
            <Document>
                <Chart chartType="bar" series={SERIES} />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_ALT');
        expect(report.ok).toBe(true);
        expect(report.counts.info).toBe(1);
    });

    it('L_CHART_SERIES — a pie chart must have exactly one series', () => {
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'pie',
                        series: [
                            { label: 'A', values: [1] },
                            { label: 'B', values: [2] },
                        ],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_SERIES');
        expect(report.ok).toBe(false);
    });

    it('L_CHART_CATEGORIES — series length must match the categories', () => {
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'bar',
                        series: [{ label: 'A', values: [1, 2] }],
                        categories: ['Q1', 'Q2', 'Q3'],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_CATEGORIES');
    });

    it('L_CHART_EMPTY — rejects a chart with no series, or a series with no values', () => {
        // Both throw inside the engine at render time.
        expect(
            codes(lintSpec({ blocks: [['chart', { chartType: 'bar', series: [], altText: 'x' }]] })),
        ).toContain('L_CHART_EMPTY');

        expect(
            codes(
                lintSpec({
                    blocks: [
                        [
                            'chart',
                            { chartType: 'bar', series: [{ label: 'A', values: [] }], altText: 'x' },
                        ],
                    ],
                }),
            ),
        ).toContain('L_CHART_EMPTY');
    });

    it('L_CHART_VALUES — catches an undefined value, not just null', () => {
        // `.find()` returns undefined for a *found* undefined, so an
        // `!== undefined` guard silently passed this.
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'bar',
                        series: [{ label: 'A', values: [1, undefined as unknown as number] }],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_VALUES');
    });

    it('L_CHART_VALUES — rejects non-finite values', () => {
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'bar',
                        series: [{ label: 'A', values: [1, Number.NaN] }],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_VALUES');
    });

    it('L_CHART_VALUES — rejects negative values in a donut', () => {
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'donut',
                        series: [{ label: 'A', values: [1, -2] }],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_VALUES');
    });

    it('L_CHART_POINTS — rejects a chart past the 10 000-point ceiling', () => {
        const report = lintSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'line',
                        series: [{ label: 'A', values: Array.from({ length: 10_001 }, () => 1) }],
                        altText: 'x',
                    },
                ],
            ],
        });
        expect(codes(report)).toContain('L_CHART_POINTS');
    });
});

describe('geometry rules', () => {
    it('L_OVERFLOW — is off unless explicitly requested', () => {
        const spec = {
            blocks: [['chart', { chartType: 'bar', series: SERIES, height: 4000, altText: 'x' }]],
        } as const;
        expect(codes(lintSpec(spec))).not.toContain('L_OVERFLOW');
    });

    it('L_OVERFLOW — flags a block that runs past the bottom margin', () => {
        // Exercises the `belowFloor` arm, which is the y-axis-sign-sensitive one:
        // pdfnative's y increases upward, so a block occupies [top - height, top].
        // Invert that comparison and this test fails.
        const report = lintSpec(
            {
                layout: { pageHeight: 400, margins: { t: 40, r: 40, b: 40, l: 40 } },
                blocks: [
                    ['p', 'filler'],
                    ['chart', { chartType: 'bar', series: SERIES, height: 300, altText: 'x' }],
                ],
            },
            { overflow: true },
        );
        expect(codes(report)).toContain('L_OVERFLOW');
    });

    it('L_OVERFLOW — flags a block taller than the content box', () => {
        const report = lintSpec(
            {
                blocks: [
                    ['chart', { chartType: 'bar', series: SERIES, height: 4000, altText: 'x' }],
                ],
            },
            { overflow: true },
        );
        expect(codes(report)).toContain('L_OVERFLOW');
    });
});

describe('report shape', () => {
    it('filters to the requested rules only', () => {
        const report = lintDocument(
            <Document>
                <Image data={PIXEL} />
                <Chart chartType="bar" series={SERIES} />
            </Document>,
            { rules: ['L_IMAGE_ALT'] },
        );
        expect(codes(report)).toEqual(['L_IMAGE_ALT']);
    });

    it('every registered rule is actually implemented', () => {
        // The registry cannot catch a rule that is declared but never emitted:
        // such a code ships into schema('lint-report') and the capability
        // manifest, and an agent branches on a finding that can never arrive.
        expect([...EMITTED_LINT_RULES].sort()).toEqual([...LINT_RULE_CODES].sort());
    });

    it('only reports codes that exist in the registry', () => {
        const report = lintDocument(
            <Document>
                <Image data={PIXEL} />
            </Document>,
        );
        for (const f of report.findings) expect(LINT_RULE_CODES).toContain(f.code);
    });

    it('lintSpec and lintDocument agree on the same document', () => {
        const viaSpec = lintSpec({ blocks: [['h1', 'A'], ['h3', 'B']] });
        const viaJsx = lintDocument(
            <Document>
                <Heading level={1}>A</Heading>
                <Heading level={3}>B</Heading>
            </Document>,
        );
        expect(viaSpec).toEqual(viaJsx);
    });
});
