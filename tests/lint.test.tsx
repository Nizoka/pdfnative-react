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

    it(
        'L_MAX_BLOCKS_EXCEEDED — applies the engine default when no maxBlocks is set',
        // Reconciling 100 001 blocks is genuinely expensive — that is the point
        // of the rule. The default 5 s budget is not enough under coverage
        // instrumentation, so this one test gets a bigger one rather than a
        // smaller document that would not exercise the ceiling.
        { timeout: 60_000 },
        () => {
            // The engine applies DEFAULT_MAX_BLOCKS = 100_000 unconditionally and
            // throws past it. Checking only an explicit layout.maxBlocks left the
            // common case — no layout at all — completely unguarded.
            const report = lintSpec({
                blocks: Array.from({ length: 100_001 }, () => ['br'] as const),
            });
            expect(codes(report)).toContain('L_MAX_BLOCKS_EXCEEDED');
            expect(report.ok).toBe(false);
            expect(report.findings[0].message).toContain('engine default');
        },
    );

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

describe('chart rules — 1.7.0 axes, scales and labels', () => {
    it('L_CHART_LOG_SCALE — stacked charts cannot use a log scale', () => {
        for (const chartType of ['stackedBar', 'stackedBarH'] as const) {
            const report = lintDocument(
                <Document>
                    <Chart chartType={chartType} series={SERIES} axis={{ scale: 'log' }} altText="x" />
                </Document>,
            );
            expect(codes(report), chartType).toContain('L_CHART_LOG_SCALE');
            expect(report.ok).toBe(false);
        }
    });

    it('L_CHART_LOG_SCALE — log axis bounds must be strictly positive', () => {
        const report = lintDocument(
            <Document>
                <Chart chartType="line" series={SERIES} axis={{ scale: 'log', yMin: 0 }} altText="x" />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_LOG_SCALE');
    });

    it('L_CHART_LOG_SCALE — flags non-positive values on the series bound to the log axis', () => {
        const left = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    series={[{ label: 'A', values: [1, 0, 3] }]}
                    axis={{ scale: 'log' }}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(left)).toContain('L_CHART_LOG_SCALE');

        // The binding matters: only the series on the log axis is checked.
        const right = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    series={[
                        { label: 'A', values: [-5, 2, 3] },
                        { label: 'B', values: [1, 2, -3], yAxis: 'right' },
                    ]}
                    axis2={{ scale: 'log' }}
                    altText="x"
                />
            </Document>,
        );
        const logFindings = right.findings.filter((f) => f.code === 'L_CHART_LOG_SCALE');
        expect(logFindings).toHaveLength(1);
        expect(logFindings[0].message).toContain('"B"');
    });

    it('L_CHART_LOG_SCALE — a positive-valued log-scale line chart is clean', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    series={SERIES}
                    axis={{ scale: 'log', yMin: 1, yMax: 10 }}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).not.toContain('L_CHART_LOG_SCALE');
    });

    it('L_CHART_X_AXIS — a positional axis applies only to line/area/scatter', () => {
        const report = lintDocument(
            <Document>
                <Chart chartType="bar" series={SERIES} xAxis={{ type: 'linear' }} altText="x" />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
        expect(report.ok).toBe(false);
    });

    it("L_CHART_X_AXIS — scatter rejects an explicit 'category' axis", () => {
        const report = lintDocument(
            <Document>
                <Chart chartType="scatter" series={SERIES} xAxis={{ type: 'category' }} altText="x" />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
    });

    it('L_CHART_X_AXIS — a right-axis binding is meaningless on a pie', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="pie"
                    series={[{ label: 'A', values: [1, 2], yAxis: 'right' }]}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
    });

    it('L_CHART_X_AXIS — scatter is positional by default, so xValues are required', () => {
        // No xAxis prop at all: the engine still resolves scatter to a linear
        // axis, so the missing-xValues check must fire.
        const report = lintDocument(
            <Document>
                <Chart chartType="scatter" series={[{ label: 'A', values: [1, 2, 3] }]} altText="x" />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
    });

    it('L_CHART_X_AXIS — xValues must be one per value', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    xAxis={{ type: 'linear' }}
                    series={[{ label: 'A', values: [1, 2, 3], xValues: [1, 2] }]}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
    });

    it("L_CHART_X_AXIS — date strings on a non-'time' axis are flagged", () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    xAxis={{ type: 'linear' }}
                    series={[{ label: 'A', values: [1, 2], xValues: ['2026-01-01', '2026-02-01'] }]}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_X_AXIS');
        expect(
            report.findings.find((f) => f.code === 'L_CHART_X_AXIS')?.message,
        ).toContain("'time'");
    });

    it('L_CHART_X_AXIS — a scatter with proper xValues is clean', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="scatter"
                    series={[{ label: 'A', values: [1, 2, 3], xValues: [10, 20, 30] }]}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).not.toContain('L_CHART_X_AXIS');
        expect(report.ok).toBe(true);
    });

    it('L_CHART_LABELS — labelStride/labelRotation do not apply to scatter', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="scatter"
                    series={[{ label: 'A', values: [1, 2], xValues: [1, 2] }]}
                    labelRotation={45}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).toContain('L_CHART_LABELS');
        expect(report.ok).toBe(false);
    });

    it('L_CHART_LABELS — labelStride must be an integer >= 1', () => {
        for (const labelStride of [0, 1.5]) {
            const report = lintDocument(
                <Document>
                    <Chart chartType="bar" series={SERIES} labelStride={labelStride} altText="x" />
                </Document>,
            );
            expect(codes(report), `labelStride ${String(labelStride)}`).toContain('L_CHART_LABELS');
        }
    });

    it('L_CHART_LABELS — labelRotation must stay within 0–90 degrees', () => {
        for (const labelRotation of [-10, 91]) {
            const report = lintDocument(
                <Document>
                    <Chart chartType="bar" series={SERIES} labelRotation={labelRotation} altText="x" />
                </Document>,
            );
            expect(codes(report), `labelRotation ${String(labelRotation)}`).toContain(
                'L_CHART_LABELS',
            );
        }
    });

    it('L_CHART_LABELS — sensible label options on a category chart are clean', () => {
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="bar"
                    series={SERIES}
                    categories={['Q1', 'Q2', 'Q3']}
                    labelStride={2}
                    labelRotation={45}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).not.toContain('L_CHART_LABELS');
        expect(report.ok).toBe(true);
    });

    it('L_CHART_CATEGORIES — skips charts on a positional x-axis (engine 1.7.0 parity)', () => {
        // On a category axis this categories/values mismatch fires the rule;
        // on a positional axis the engine ignores `categories`, so the lint
        // must too — before the 1.7.0 alignment this was a false positive.
        const report = lintDocument(
            <Document>
                <Chart
                    chartType="line"
                    xAxis={{ type: 'linear' }}
                    series={[{ label: 'A', values: [1, 2, 3], xValues: [1, 2, 3] }]}
                    categories={['Q1', 'Q2']}
                    altText="x"
                />
            </Document>,
        );
        expect(codes(report)).not.toContain('L_CHART_CATEGORIES');
        expect(report.ok).toBe(true);
    });
});

describe('print-production and viewer rules', () => {
    const FONTS = [{ lang: 'latin' } as never];

    it('L_PRINT_BOXES — bleed and an explicit trimBox are mutually exclusive', () => {
        const report = lintDocument(
            <Document print={{ bleed: 9, trimBox: [0, 0, 100, 100] }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_PRINT_BOXES');
        expect(report.ok).toBe(false);
    });

    it('L_PRINT_BOXES — printer marks need a TrimBox to stay outside of', () => {
        const report = lintDocument(
            <Document print={{ marks: true }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_PRINT_BOXES');
    });

    it('L_PRINT_BOXES — userUnit must be within 1–75000', () => {
        const report = lintDocument(
            <Document print={{ userUnit: 0 }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_PRINT_BOXES');
    });

    it('L_PRINT_BOXES — userUnit is forbidden under PDF/A-1', () => {
        const report = lintDocument(
            <Document print={{ userUnit: 2 }} tagged="pdfa1b" fontEntries={FONTS}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_PRINT_BOXES');
    });

    it('L_PRINT_BOXES — valid print geometry is clean, via bleed or an explicit box', () => {
        for (const print of [{ bleed: 8.5 }, { trimBox: [20, 20, 400, 600] as const }]) {
            const report = lintDocument(
                <Document print={print}>
                    <Paragraph>x</Paragraph>
                </Document>,
            );
            expect(codes(report), JSON.stringify(print)).not.toContain('L_PRINT_BOXES');
            expect(report.ok).toBe(true);
        }
    });

    it('L_PRINT_BOXES — lintSpec and lintDocument agree on the print prop', () => {
        const print = { bleed: 9, trimBox: [0, 0, 100, 100] } as const;
        const viaSpec = lintSpec({ print, blocks: [['p', 'x']] });
        const viaJsx = lintDocument(
            <Document print={print}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(viaSpec).toEqual(viaJsx);
        expect(codes(viaSpec)).toContain('L_PRINT_BOXES');
    });

    it('L_VIEWER_PRINT_RANGE — entries must be 1-based [first, last] pairs', () => {
        for (const range of [[0, 2], [3, 1], [1.5, 2]] as const) {
            const report = lintDocument(
                <Document layout={{ viewerPreferences: { printPageRange: [range] } }}>
                    <Paragraph>x</Paragraph>
                </Document>,
            );
            expect(codes(report), JSON.stringify(range)).toContain('L_VIEWER_PRINT_RANGE');
            expect(report.ok).toBe(false);
        }
    });

    it('L_VIEWER_PRINT_RANGE — numCopies must be a positive integer', () => {
        for (const numCopies of [0, 2.5]) {
            const report = lintDocument(
                <Document layout={{ viewerPreferences: { numCopies } }}>
                    <Paragraph>x</Paragraph>
                </Document>,
            );
            expect(codes(report), String(numCopies)).toContain('L_VIEWER_PRINT_RANGE');
        }
    });

    it('L_VIEWER_PRINT_RANGE — well-formed print preferences are clean', () => {
        const report = lintDocument(
            <Document
                layout={{
                    viewerPreferences: { printPageRange: [[1, 3], [5, 5]], numCopies: 2 },
                }}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).not.toContain('L_VIEWER_PRINT_RANGE');
        expect(report.ok).toBe(true);
    });

    it('L_OUTPUT_INTENT_IGNORED — an outputIntent without tagged is silently dropped', () => {
        const report = lintDocument(
            <Document
                layout={{
                    outputIntent: {
                        iccProfile: new Uint8Array([1, 2, 3]),
                        outputConditionIdentifier: 'sRGB IEC61966-2.1',
                    },
                }}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).toContain('L_OUTPUT_INTENT_IGNORED');
        // A warning, not an error: the document still renders fine.
        expect(report.ok).toBe(true);
        expect(report.counts.warning).toBeGreaterThan(0);
    });

    it('L_OUTPUT_INTENT_IGNORED — an outputIntent WITH tagged is honoured, not flagged', () => {
        const report = lintDocument(
            <Document
                tagged="pdfa2b"
                fontEntries={FONTS}
                layout={{
                    outputIntent: {
                        iccProfile: new Uint8Array([1, 2, 3]),
                        outputConditionIdentifier: 'sRGB IEC61966-2.1',
                    },
                }}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(codes(report)).not.toContain('L_OUTPUT_INTENT_IGNORED');
    });

    it('L_TAGGED_FORM_FONTS — PDF/A with form fields warns about the AcroForm font', () => {
        const report = lintDocument(
            <Document tagged="pdfa2b" fontEntries={FONTS}>
                <FormField fieldType="text" name="email" label="Email" />
            </Document>,
        );
        expect(codes(report)).toContain('L_TAGGED_FORM_FONTS');
        // Warning severity: the engine renders (and diagnoses), it does not throw.
        expect(report.ok).toBe(true);
    });

    it('L_TAGGED_FORM_FONTS — plain tagging (no PDF/A claim) with form fields is clean', () => {
        const report = lintDocument(
            <Document tagged>
                <FormField fieldType="text" name="email" label="Email" />
            </Document>,
        );
        expect(codes(report)).not.toContain('L_TAGGED_FORM_FONTS');
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
