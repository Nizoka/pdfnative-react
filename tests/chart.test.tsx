/**
 * `<Chart>` — the one authoring capability pdfnative 1.6.0 unlocks, extended
 * by the 1.7.0 "Charts v2" surface (secondary/positional axes, data labels,
 * label thinning/rotation, and four new chart kinds).
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

/** Two series on different value axes — the Charts-v2 dual-axis fixture. */
const DUAL_SERIES: readonly ChartSeries[] = [
    { label: 'Revenue', values: [12, 18, 24, 31], xValues: [1, 2, 3, 4] },
    { label: 'Margin %', values: [40, 42, 45, 47], yAxis: 'right' },
];

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

    it('maps the v2 axis and label props onto the ChartBlock one-for-one', () => {
        const model = compileDocument(
            <Document>
                <Chart
                    chartType="line"
                    series={DUAL_SERIES}
                    categories={QUARTERS}
                    axis={{ yMin: 0, grid: true }}
                    axis2={{ yMin: 0, yMax: 100, ticks: 5, scale: 'linear' }}
                    xAxis={{ type: 'category', grid: false }}
                    dataLabels={{ decimals: 1, prefix: '€', suffix: 'k' }}
                    labelStride={2}
                    labelRotation={45}
                />
            </Document>,
        );

        expect(model.blocks).toEqual([
            {
                type: 'chart',
                chartType: 'line',
                series: DUAL_SERIES,
                categories: QUARTERS,
                axis: { yMin: 0, grid: true },
                axis2: { yMin: 0, yMax: 100, ticks: 5, scale: 'linear' },
                xAxis: { type: 'category', grid: false },
                dataLabels: { decimals: 1, prefix: '€', suffix: 'k' },
                labelStride: 2,
                labelRotation: 45,
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
        // Pins the exact key set: none of the v2 props (axis2, xAxis,
        // dataLabels, labelStride, labelRotation) may leak in when unset.
        expect(Object.keys(model.blocks[0])).toEqual(['type', 'chartType', 'series']);
    });

    it.each<ChartType>(['bar', 'barH', 'line', 'pie', 'donut', 'stackedBar', 'stackedBarH', 'area'])(
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

    it('supports chartType "scatter" with per-series xValues', () => {
        const model = compileDocument(
            <Document>
                <Chart
                    chartType="scatter"
                    series={[{ label: 'Samples', values: [3, 7, 4, 9], xValues: [1, 2, 3, 5] }]}
                />
            </Document>,
        );
        expect(model.blocks[0]).toMatchObject({
            type: 'chart',
            chartType: 'scatter',
            series: [{ label: 'Samples', values: [3, 7, 4, 9], xValues: [1, 2, 3, 5] }],
        });
    });
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

    it('carries the 1.7.0 chart fields through a spec unchanged', () => {
        const spec: DocSpec = {
            blocks: [
                [
                    'chart',
                    {
                        chartType: 'line',
                        series: DUAL_SERIES,
                        categories: QUARTERS,
                        axis: { yMin: 0, grid: true },
                        axis2: { yMin: 0, yMax: 100, ticks: 5, scale: 'linear' },
                        xAxis: { type: 'category', grid: false },
                        dataLabels: { decimals: 1, prefix: '€', suffix: 'k' },
                        labelStride: 2,
                        labelRotation: 45,
                    },
                ],
            ],
        };

        const jsx = (
            <Document>
                <Chart
                    chartType="line"
                    series={DUAL_SERIES}
                    categories={QUARTERS}
                    axis={{ yMin: 0, grid: true }}
                    axis2={{ yMin: 0, yMax: 100, ticks: 5, scale: 'linear' }}
                    xAxis={{ type: 'category', grid: false }}
                    dataLabels={{ decimals: 1, prefix: '€', suffix: 'k' }}
                    labelStride={2}
                    labelRotation={45}
                />
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
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

    it.each<ChartType>(['stackedBar', 'stackedBarH', 'area'])(
        'renders a real PDF for the 1.7.0 chartType "%s"',
        (chartType) => {
            const pdf = decode(
                renderToBytes(
                    <Document>
                        <Chart
                            chartType={chartType}
                            series={[
                                { label: '2025', values: [12, 18, 24, 31] },
                                { label: '2026', values: [15, 21, 29, 38] },
                            ]}
                            categories={QUARTERS}
                        />
                    </Document>,
                ),
            );
            expect(pdf.startsWith('%PDF-')).toBe(true);
            expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
        },
    );

    it('renders a scatter chart on its default linear x axis', () => {
        const pdf = decode(
            renderToBytes(
                <Document>
                    <Chart
                        chartType="scatter"
                        series={[
                            { label: 'Samples', values: [3, 7, 4, 9], xValues: [1, 2, 3, 5] },
                        ]}
                    />
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('renders a time-axis line chart from ISO-8601 xValues', () => {
        const pdf = decode(
            renderToBytes(
                <Document>
                    <Chart
                        chartType="line"
                        series={[
                            {
                                label: 'Signups',
                                values: [40, 55, 47, 80],
                                xValues: ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'],
                            },
                        ]}
                        xAxis={{ type: 'time', ticks: 4, grid: true }}
                        markers
                    />
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('renders a log-scale value axis over strictly positive values', () => {
        const pdf = decode(
            renderToBytes(
                <Document>
                    <Chart
                        chartType="line"
                        series={[{ label: 'Growth', values: [1, 10, 100, 1_000] }]}
                        categories={QUARTERS}
                        axis={{ scale: 'log', grid: true }}
                    />
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('renders a dual-axis chart with a right-hand series', () => {
        const pdf = decode(
            renderToBytes(
                <Document>
                    <Chart
                        chartType="line"
                        series={DUAL_SERIES}
                        categories={QUARTERS}
                        axis={{ yMin: 0, grid: true }}
                        axis2={{ yMin: 0, yMax: 100, ticks: 5 }}
                    />
                </Document>,
            ),
        );
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});
