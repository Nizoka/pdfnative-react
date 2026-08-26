# Charts

Native vector charts, drawn with PDF path operators. No rasterisation, no chart
library, no new runtime dependency — and the output is real vector art that
stays sharp at any zoom and passes PDF/A.

Requires the `pdfnative` engine ≥ 1.7.0, which is the peer floor as of
pdfnative-react 1.2.0.

Runnable: [`samples/charts/charts.tsx`](../samples/charts/charts.tsx) (the
basics) and [`samples/charts/charts-v2.tsx`](../samples/charts/charts-v2.tsx)
(stacked/area/scatter, dual axes, log/time scales, data labels).

## Quick start

```tsx
import { Document, Chart } from 'pdfnative-react';

<Document title="Q4 report">
    <Chart
        chartType="bar"
        series={[{ label: '2026', values: [15400, 21200, 29800, 38600] }]}
        categories={['Q1', 'Q2', 'Q3', 'Q4']}
        title="Revenue by quarter"
        altText="Revenue rises each quarter from 15.4k to 38.6k."
    />
</Document>
```

The `DocSpec` twin:

```json
["chart", {
  "chartType": "bar",
  "series": [{ "label": "2026", "values": [15400, 21200, 29800, 38600] }],
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "title": "Revenue by quarter",
  "altText": "Revenue rises each quarter from 15.4k to 38.6k."
}]
```

## Chart types

| `chartType` | Shape | Series | Negative values |
|---|---|---|---|
| `'bar'` | Vertical bars | Many | Yes |
| `'barH'` | Horizontal bars | Many | Yes |
| `'stackedBar'` | Vertical bars, series stacked | Many | No log scale |
| `'stackedBarH'` | Horizontal bars, series stacked | Many | No log scale |
| `'line'` | Lines, optional markers | Many | Yes |
| `'area'` | Filled lines | Many | Yes |
| `'scatter'` | Points positioned by `xValues` | Many | Yes |
| `'pie'` | Filled circle | **Exactly one** | No |
| `'donut'` | Ring | **Exactly one** | No |

`barH` is the right choice when category labels are long — under a vertical axis
they get cramped or clipped. Scatter charts position every point by its series'
`xValues` and default to a linear x-axis.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `chartType` | `ChartType` | — | Required |
| `series` | `ChartSeries[]` | — | Required. `{ label, values, color?, xValues?, yAxis? }` |
| `categories` | `string[]` | 1-based indices | Category axes: every series supplies one value per category |
| `title` | `string` | — | Drawn above the plot |
| `width` | `number` | `460` | Points; clamped to the content width |
| `height` | `number` | `240` | Points; the title and legend add measured height on top |
| `legend` | `'bottom' \| 'none'` | `'bottom'` for multi-series and pie/donut, else `'none'` | |
| `axis` | `{ yMin?, yMax?, ticks?, grid?, scale? }` | `scale: 'linear'` | Primary (left) value axis. `'log'` needs strictly positive values |
| `axis2` | `{ yMin?, yMax?, ticks?, scale? }` | — | Secondary right axis; rendered when a series binds with `yAxis: 'right'` |
| `xAxis` | `{ type?, min?, max?, ticks?, grid? }` | `'category'` (`'linear'` for scatter) | `'linear'`/`'time'` position points by `xValues`; `'time'` parses ISO-8601 / epoch ms, UTC ticks |
| `dataLabels` | `boolean \| { decimals?, prefix?, suffix? }` | off | Per-point value labels |
| `labelStride` | `number` | automatic | Draw every Nth x-label; `1` forces all. Category axes only |
| `labelRotation` | `number` | `0` | Rotate x-labels 0–90° CCW (typically `45`). Category axes only |
| `markers` | `boolean` | `false` | Point markers on line series |
| `colors` | `PdfColor[]` | Built-in 8-colour palette | Per series (bar/line) or per slice (pie/donut) |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | |
| `altText` | `string` | Auto-generated | See below — write your own |

### Dual axes, time series, data labels

```tsx
<Chart
    chartType="line"
    xAxis={{ type: 'time' }}
    series={[
        { label: 'Revenue (k€)', values: [210, 245, 262], xValues: ['2026-01-01', '2026-02-01', '2026-03-01'] },
        { label: 'Margin (%)', values: [12.1, 13.4, 15.2], xValues: ['2026-01-01', '2026-02-01', '2026-03-01'], yAxis: 'right' },
    ]}
    axis2={{ yMin: 0, yMax: 20 }}
    dataLabels={{ decimals: 1 }}
    altText="Revenue and margin both rise across Q1 2026."
/>
```

On a positional axis (`'linear'` or `'time'`, and every scatter chart), each
series must carry `xValues` with the same length as `values`; date strings
require `xAxis.type: 'time'`. Crowded category labels are strided automatically
since engine 1.7.0 — `labelStride={1}` restores draw-everything, and
`labelRotation={45}` is the usual fix for long labels.

## Accessibility

Charts emit a tagged-PDF `/Figure` with an `/Alt` entry. When you omit
`altText`, the engine synthesises something generic —
`"bar chart: 2 series, 4 categories"` — which satisfies PDF/A but tells a reader
relying on it nothing about the data.

Write the sentence you would say out loud:

```tsx
altText="Revenue by quarter: 2026 outperforms 2025 throughout, ending at 38.6k versus 31k."
```

`lintDocument` reports `L_CHART_ALT` (severity `info`) when it is missing.

## Validation

The engine enforces its constraints by **throwing at render time**. `lintDocument`
turns each of them into a finding you can read first:

| Rule | Constraint |
|---|---|
| `L_CHART_EMPTY` | At least one series, and every series needs at least one value |
| `L_CHART_SERIES` | Pie and donut take exactly one series |
| `L_CHART_CATEGORIES` | On a category axis, every series length must equal `categories.length` |
| `L_CHART_VALUES` | All values finite; no negatives in a pie/donut |
| `L_CHART_POINTS` | 10 000 data points per chart, hard ceiling |
| `L_CHART_LOG_SCALE` | No log scale on stacked kinds; log bounds and log-bound series values strictly positive |
| `L_CHART_X_AXIS` | Positional axes only on line/area/scatter; scatter is never `'category'`; `xValues` present and matching on positional axes; date strings need `'time'`; no `yAxis: 'right'` on pie/donut |
| `L_CHART_LABELS` | `labelStride` an integer ≥ 1, `labelRotation` within 0–90, neither on scatter |

```ts
const report = lintDocument(doc);
if (!report.ok) { /* fix the data, do not render */ }
```

## Sizing and overflow

`height` is the plot area; the title and legend are measured and added on top,
so the block is taller than `height` alone. A chart taller than the page content
box cannot be placed on any page — `lintDocument(doc, { overflow: true })`
reports `L_OVERFLOW` for exactly that case.

For a full-width chart on A4 portrait with default margins, `width` around 460
and `height` around 240–300 is a comfortable range.

## Colours

The default palette is an eight-colour categorical set. Override per chart:

```tsx
<Chart chartType="donut" colors={['#4e79a7', '#59a14f', '#edc949', '#af7aa1']} … />
```

…or per series, which wins over the palette:

```tsx
series={[{ label: 'Net margin', values: [-4.2, 1.8, 6.5, 11.3], color: '#e15759' }]}
```

Colours accept any `PdfColor`: a hex string, an RGB tuple, or a PDF operator
string. They are injection-safe — the engine validates them before emitting
operators.

## PDF/A

Charts use solid fills and no transparency, so they are safe in every PDF/A
conformance target. Remember that PDF/A additionally requires **every rendering
font to be embedded** — a chart's axis and legend labels are text. Pair
`tagged="pdfa2b"` with `fontEntries`, or `lintDocument` will report
`L_TAGGED_NO_FONTS` and veraPDF will reject the file (rule 6.2.11.4.1).

```tsx
const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

<Document tagged="pdfa2b" fontEntries={fontEntries}>
    <Chart … />
</Document>
```

## Charts v2 — a promise kept

Until 1.1.0 this page tracked stacked bars, area, scatter, secondary/log/time
axes and per-point data labels as "Charts v2" on the engine's roadmap, and
promised that "when they land there, they reach this package as new
`ChartProps` fields". Engine 1.7.0 shipped them; pdfnative-react 1.2.0 exposes
every one of them, with full `DocSpec` and schema parity — and the
compile-time `ChartPropsCoversChartBlock` lock is what enforced it: the peer
bump was a build error until the surfaces matched.
