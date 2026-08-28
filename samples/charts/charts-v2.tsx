/**
 * Charts v2 — the 1.7.0 chart engine: stacked bars, area, scatter, time and
 * dual axes, log scale, data labels and label rotation.
 *
 * Run with: npx tsx samples/charts/charts-v2.tsx
 * Writes `charts-v2.pdf` to the current directory.
 *
 * Constraints worth knowing: `scale: 'log'` requires strictly positive values
 * and refuses stacked kinds; `xValues` is required for scatter (and for
 * `'linear'`/`'time'` x-axes) and must match `values` in length; `labelStride`
 * and `labelRotation` do not apply to scatter. `lintDocument` checks all of
 * this before you render (rules `L_CHART_LOG_SCALE`, `L_CHART_XVALUES`…).
 */

import React from 'react';
import { Chart, Document, Heading, Paragraph, Spacer, renderToFile } from '../../src/index.js';
import type { ChartSeries } from '../../src/index.js';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Revenue by product line, in k$ — stacked to show the composition of the total.
const PRODUCT_LINES: readonly ChartSeries[] = [
    { label: 'Licenses', values: [210, 232, 258, 291] },
    { label: 'Services', values: [96, 104, 122, 140] },
    { label: 'Support', values: [45, 48, 51, 55] },
];

// Monthly active users, in thousands.
const ACTIVE_USERS: readonly ChartSeries[] = [
    { label: 'Web', values: [31, 33, 36, 40, 44, 47, 49, 52, 57, 61, 66, 72] },
    { label: 'Mobile', values: [12, 14, 17, 21, 26, 30, 33, 37, 42, 48, 55, 63] },
];

// Load test: p95 latency (ms) at increasing request rates — per-point x positions.
const LATENCY: readonly ChartSeries[] = [
    {
        label: 'eu-west',
        xValues: [50, 120, 260, 400, 610, 800, 950],
        values: [38, 41, 47, 55, 71, 96, 142],
    },
    {
        label: 'us-east',
        xValues: [50, 140, 300, 450, 640, 820, 990],
        values: [44, 46, 51, 62, 84, 118, 177],
    },
];

// Weekly sign-ups through Q1 2026 — ISO-8601 dates on a time axis.
const SIGNUPS: readonly ChartSeries[] = [
    {
        label: 'Sign-ups',
        xValues: [
            '2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16',
            '2026-03-02', '2026-03-16', '2026-03-30',
        ],
        values: [140, 162, 155, 197, 224, 218, 261],
    },
];

// Dual axis: revenue in k$ on the left, gross margin in % on the right.
const REVENUE_VS_MARGIN: readonly ChartSeries[] = [
    { label: 'Revenue (k$)', values: [351, 384, 431, 486] },
    { label: 'Gross margin (%)', values: [38.2, 41.5, 44.1, 47.8], yAxis: 'right' },
];

// Requests per day by endpoint — four orders of magnitude apart.
const ENDPOINT_TRAFFIC: readonly ChartSeries[] = [
    { label: 'Requests/day', values: [420, 9_800, 187_000, 2_400_000] },
];
const ENDPOINTS = ['/admin', '/export', '/search', '/api/v1'];

// Quarterly revenue in M$ — labelled directly on the bars.
const REVENUE_M: readonly ChartSeries[] = [
    { label: '2026', values: [4.2, 4.9, 5.8, 6.7] },
];

// Average monthly temperature (°C) — twelve labels that need rotating.
const TEMPERATURE: readonly ChartSeries[] = [
    { label: 'Lyon 2026', values: [3.1, 4.8, 9.2, 12.6, 17.0, 21.3, 23.8, 23.1, 18.9, 13.4, 7.2, 3.9] },
];

const doc = (
    <Document
        title="Charts v2"
        footerText="Acme Inc · FY2026"
        metadata={{ author: 'Acme Inc', subject: 'Chart engine v2 showcase' }}
    >
        <Heading level={1}>Charts v2 showcase</Heading>

        <Heading level={2}>Stacked bar — composition of a total</Heading>
        <Chart
            chartType="stackedBar"
            series={PRODUCT_LINES}
            categories={QUARTERS}
            title="Revenue by product line (k$)"
            axis={{ yMin: 0, ticks: 5, grid: true }}
            legend="bottom"
            altText="Stacked quarterly revenue: licenses dominate every quarter; the total grows from 351k in Q1 to 486k in Q4."
        />

        <Spacer height={16} />

        <Heading level={2}>Area — cumulative feel for trends</Heading>
        <Paragraph>
            `area` fills under each line. `stackedBarH` also exists for the
            horizontal variant of the chart above.
        </Paragraph>
        <Chart
            chartType="area"
            series={ACTIVE_USERS}
            categories={MONTHS.map((m) => m.slice(0, 3))}
            title="Monthly active users (thousands)"
            axis={{ yMin: 0, grid: true }}
            legend="bottom"
            altText="Web and mobile active users both climb through the year; mobile grows faster, from 12k to 63k."
        />

        <Spacer height={16} />

        <Heading level={2}>Scatter — numeric x positions</Heading>
        <Paragraph>
            Scatter requires `xValues` per series, the same length as `values`.
            The x-axis defaults to `linear`.
        </Paragraph>
        <Chart
            chartType="scatter"
            series={LATENCY}
            title="p95 latency vs. request rate"
            xAxis={{ type: 'linear', min: 0, grid: true }}
            axis={{ yMin: 0, ticks: 5 }}
            legend="bottom"
            altText="Latency stays under 60 ms up to about 400 req/s in both regions, then climbs steeply; us-east degrades faster."
        />

        <Spacer height={16} />

        <Heading level={2}>Time axis — ISO-8601 x values</Heading>
        <Paragraph>
            A `time` x-axis parses ISO-8601 strings (or epoch milliseconds) and
            positions points proportionally — uneven sampling stays honest.
        </Paragraph>
        <Chart
            chartType="line"
            series={SIGNUPS}
            title="Weekly sign-ups, Q1 2026"
            markers
            xAxis={{ type: 'time', grid: true }}
            axis={{ yMin: 0 }}
            altText="Sign-ups rise from 140 in early January to 261 at the end of March, with a dip in mid-February."
        />

        <Spacer height={16} />

        <Heading level={2}>Dual axis — two units on one plot</Heading>
        <Paragraph>
            A series with `yAxis: 'right'` binds to the secondary axis; configure
            its range with `axis2`, otherwise the right scale is auto-fitted.
        </Paragraph>
        <Chart
            chartType="line"
            series={REVENUE_VS_MARGIN}
            categories={QUARTERS}
            title="Revenue vs. gross margin"
            markers
            axis={{ yMin: 0, grid: true }}
            axis2={{ yMin: 0, yMax: 60, ticks: 4 }}
            legend="bottom"
            altText="Revenue grows from 351k to 486k while gross margin improves from 38% to 48% on the right axis."
        />

        <Spacer height={16} />

        <Heading level={2}>Log scale — spanning orders of magnitude</Heading>
        <Paragraph>
            `axis.scale: 'log'` needs strictly positive values and is rejected
            on stacked kinds (stacking sums are meaningless in log space).
        </Paragraph>
        <Chart
            chartType="bar"
            series={ENDPOINT_TRAFFIC}
            categories={ENDPOINTS}
            title="Requests per day by endpoint (log scale)"
            axis={{ scale: 'log', grid: true }}
            altText="Daily requests per endpoint on a log scale: /admin 420, /export 9.8k, /search 187k, /api/v1 2.4M."
        />

        <Spacer height={16} />

        <Heading level={2}>Data labels — values on the marks</Heading>
        <Chart
            chartType="bar"
            series={REVENUE_M}
            categories={QUARTERS}
            title="Quarterly revenue (M$)"
            dataLabels={{ decimals: 1, prefix: '$' }}
            axis={{ yMin: 0 }}
            altText="Quarterly revenue labelled on each bar: $4.2M, $4.9M, $5.8M and $6.7M."
        />

        <Spacer height={16} />

        <Heading level={2}>Label rotation — many category labels</Heading>
        <Paragraph>
            Twelve full month names collide horizontally; `labelRotation` at 45°
            keeps every label (rotation disables the automatic `labelStride`
            thinning unless you also set a stride).
        </Paragraph>
        <Chart
            chartType="bar"
            series={TEMPERATURE}
            categories={MONTHS}
            title="Average temperature (°C)"
            labelRotation={45}
            axis={{ grid: true }}
            colors={['#e15759']}
            altText="Average monthly temperature in Lyon, peaking at 23.8 °C in July and bottoming at 3.1 °C in January."
        />
    </Document>
);

await renderToFile(doc, 'charts-v2.pdf');
console.log('Wrote charts-v2.pdf');
