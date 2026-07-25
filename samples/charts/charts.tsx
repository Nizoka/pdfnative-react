/**
 * Native vector charts — every chart type in one document.
 *
 * Run with: npx tsx samples/charts/charts.tsx
 * Writes `charts.pdf` to the current directory.
 *
 * Charts are drawn with PDF path operators: no rasterisation, no chart library,
 * no runtime dependency. Requires the pdfnative engine >= 1.6.0.
 *
 * Always give a chart `altText` — the engine synthesises a generic description
 * ("bar chart: 2 series, 4 categories") when you omit it, which is enough for
 * PDF/A but useless to a reader relying on it. `lintDocument` flags the omission.
 */

import React from 'react';
import { Chart, Document, Heading, Paragraph, Spacer, renderToFile } from '../../src/index.js';
import type { ChartSeries } from '../../src/index.js';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const REVENUE: readonly ChartSeries[] = [
    { label: '2025', values: [12_000, 18_500, 24_100, 31_000] },
    { label: '2026', values: [15_400, 21_200, 29_800, 38_600] },
];

const CHANNELS: readonly ChartSeries[] = [
    { label: 'Share', values: [46, 27, 18, 9] },
];
const CHANNEL_NAMES = ['Direct', 'Partners', 'Marketplace', 'Referral'];

const MARGIN: readonly ChartSeries[] = [
    { label: 'Net margin', values: [-4.2, 1.8, 6.5, 11.3] },
];

const doc = (
    <Document
        title="Charts"
        footerText="Acme Inc · FY2026"
        metadata={{ author: 'Acme Inc', subject: 'Chart showcase' }}
    >
        <Heading level={1}>Chart showcase</Heading>

        <Heading level={2}>Bar — multi-series with a value axis</Heading>
        <Chart
            chartType="bar"
            series={REVENUE}
            categories={QUARTERS}
            title="Revenue by quarter"
            axis={{ yMin: 0, ticks: 5, grid: true }}
            legend="bottom"
            altText="Revenue by quarter: 2026 outperforms 2025 in every quarter, ending at 38.6k versus 31k."
        />

        <Spacer height={16} />

        <Heading level={2}>Horizontal bar</Heading>
        <Paragraph>
            `barH` suits long category labels, which would otherwise be cramped under a
            vertical axis.
        </Paragraph>
        <Chart
            chartType="barH"
            series={CHANNELS}
            categories={CHANNEL_NAMES}
            title="Revenue share by channel"
            altText="Revenue share: Direct 46%, Partners 27%, Marketplace 18%, Referral 9%."
        />

        <Spacer height={16} />

        <Heading level={2}>Line — with point markers</Heading>
        <Chart
            chartType="line"
            series={REVENUE}
            categories={QUARTERS}
            title="Revenue trend"
            markers
            axis={{ grid: true }}
            altText="Both years trend upward; the 2026 line stays above 2025 throughout."
        />

        <Spacer height={16} />

        <Heading level={2}>Line — negative values</Heading>
        <Paragraph>
            Bar and line charts plot below zero. Pie and donut cannot, and `lintDocument`
            reports `L_CHART_VALUES` if you try.
        </Paragraph>
        <Chart
            chartType="line"
            series={MARGIN}
            categories={QUARTERS}
            title="Net margin (%)"
            markers
            axis={{ grid: true }}
            colors={['#e15759']}
            altText="Net margin crosses from -4.2% in Q1 to +11.3% in Q4."
        />

        <Spacer height={16} />

        <Heading level={2}>Pie and donut — one series only</Heading>
        <Chart
            chartType="pie"
            series={CHANNELS}
            categories={CHANNEL_NAMES}
            title="Channel mix (pie)"
            width={280}
            height={200}
            altText="Channel mix: Direct 46%, Partners 27%, Marketplace 18%, Referral 9%."
        />
        <Chart
            chartType="donut"
            series={CHANNELS}
            categories={CHANNEL_NAMES}
            title="Channel mix (donut)"
            width={280}
            height={200}
            align="right"
            colors={['#4e79a7', '#59a14f', '#edc949', '#af7aa1']}
            altText="Same channel mix, drawn as a donut with a custom palette."
        />
    </Document>
);

await renderToFile(doc, 'charts.pdf');
console.log('Wrote charts.pdf');
