/**
 * `<Chart>` — the one authoring capability pdfnative 1.6.0 unlocks.
 *
 * Covers the JSX → `ChartBlock` mapping, DocSpec parity (golden rule 6), every
 * chart type, and a real end-to-end render.
 */
import { describe, expect, it } from 'vitest';
import {
    Chart,
    Document,
    Heading,
    compileDocument,
    compileSpec,
    renderSpecToBytes,
    renderToBytes,
} from '../src/index.js';
import type { ChartSeries, ChartType, DocSpec } from '../src/index.js';

function decode(bytes: Uint8Array): string {
    return new TextDecoder('latin1').decode(bytes);
}

const REVENUE: readonly ChartSeries[] = [
    { label: 'Revenue', values: [12_000, 18_500, 24_100, 31_000] },
];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

describe('<Chart> serialization', () => {
    it('maps props onto a ChartBlock one-for-one', () => {
        const model = compileDocument(
            <Document>
                <Chart
                    chartType="bar"
                    series={REVENUE}
                    categories={QUARTERS}
                    title="Revenue per quarter"
                    width={420}
                    height={220}
                    legend="bottom"
                    axis={{ yMin: 0, ticks: 5, grid: true }}
                    markers
                    colors={['#4e79a7']}
                    align="center"
                    altText="Revenue rising from 12k in Q1 to 31k in Q4"
                />
            </Document>,
        );

        expect(model.blocks).toEqual([
            {
                type: 'chart',
                chartType: 'bar',
                series: REVENUE,
                categories: QUARTERS,
                title: 'Revenue per quarter',
                width: 420,
                height: 220,
                legend: 'bottom',
                axis: { yMin: 0, ticks: 5, grid: true },
                markers: true,
                colors: ['#4e79a7'],
                align: 'center',
                altText: 'Revenue rising from 12k in Q1 to 31k in Q4',
            },
        ]);
    });

    it('omits absent optional props rather than emitting undefined', () => {
        const model = compileDocument(
            <Document>
                <Chart chartType="line" series={REVENUE} />
            </Document>,
        );

        expect(model.blocks).toEqual([{ type: 'chart', chartType: 'line', series: REVENUE }]);
        expect(Object.keys(model.blocks[0])).toEqual(['type', 'chartType', 'series']);
    });

    it.each<ChartType>(['bar', 'barH', 'line', 'pie', 'donut'])(
        'supports chartType "%s"',
        (chartType) => {
            const model = compileDocument(
                <Document>
                    <Chart chartType={chartType} series={REVENUE} categories={QUARTERS} />
                </Document>,
            );
            expect(model.blocks[0]).toMatchObject({ type: 'chart', chartType });
        },
    );
});

describe('chart DocSpec parity', () => {
    it("['chart', body] compiles to the same model as <Chart>", () => {
        const spec: DocSpec = {
            title: 'Q4 report',
            blocks: [
                ['h1', 'Q4 report'],
                [
                    'chart',
                    {
                        chartType: 'bar',
                        series: REVENUE,
                        categories: QUARTERS,
                        title: 'Revenue',
                        altText: 'Revenue per quarter',
                    },
                ],
            ],
        };

        const jsx = (
            <Document title="Q4 report">
                <Heading level={1}>Q4 report</Heading>
                <Chart
                    chartType="bar"
                    series={REVENUE}
                    categories={QUARTERS}
                    title="Revenue"
                    altText="Revenue per quarter"
                />
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
    });

    it('accepts a multi-series chart with a palette override', () => {
        const model = compileSpec({
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'line',
                        series: [
                            { label: '2025', values: [1, 2, 3] },
                            { label: '2026', values: [2, 4, 6] },
                        ],
                        categories: ['Jan', 'Feb', 'Mar'],
                        colors: ['#4e79a7', '#f28e2b'],
                        markers: true,
                    },
                ],
            ],
        });

        expect(model.blocks[0]).toMatchObject({
            type: 'chart',
            chartType: 'line',
            markers: true,
            colors: ['#4e79a7', '#f28e2b'],
        });
    });
});

describe('chart rendering', () => {
    it('renders a real PDF from JSX', () => {
        const pdf = decode(
            renderToBytes(
                <Document title="Charts">
                    <Chart
                        chartType="bar"
                        series={REVENUE}
                        categories={QUARTERS}
                        altText="Revenue per quarter"
                    />
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('renders a real PDF from a DocSpec', () => {
        const pdf = decode(
            renderSpecToBytes({
                blocks: [
                    ['chart', { chartType: 'donut', series: REVENUE, categories: QUARTERS }],
                ],
            }),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});
