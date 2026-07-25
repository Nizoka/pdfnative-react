# Charts

Native vector charts, drawn with PDF path operators. No rasterisation, no chart
library, no new runtime dependency — and the output is real vector art that
stays sharp at any zoom and passes PDF/A.

Requires the `pdfnative` engine ≥ 1.6.0, which is the peer floor as of
pdfnative-react 1.1.0.

Runnable: [`samples/charts/charts.tsx`](../samples/charts/charts.tsx).

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
| `'line'` | Lines, optional markers | Many | Yes |
| `'pie'` | Filled circle | **Exactly one** | No |
| `'donut'` | Ring | **Exactly one** | No |

`barH` is the right choice when category labels are long — under a vertical axis
they get cramped or clipped.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `chartType` | `ChartType` | — | Required |
| `series` | `ChartSeries[]` | — | Required. `{ label, values, color? }` |
| `categories` | `string[]` | 1-based indices | Every series must supply one value per category |
| `title` | `string` | — | Drawn above the plot |
| `width` | `number` | `460` | Points; clamped to the content width |
| `height` | `number` | `240` | Points; the title and legend add measured height on top |
| `legend` | `'bottom' \| 'none'` | `'bottom'` for multi-series and pie/donut, else `'none'` | |
| `axis` | `{ yMin?, yMax?, ticks?, grid? }` | — | Bar and line only |
| `markers` | `boolean` | `false` | Point markers on line series |
| `colors` | `PdfColor[]` | Built-in 8-colour palette | Per series (bar/line) or per slice (pie/donut) |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | |
| `altText` | `string` | Auto-generated | See below — write your own |

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
| `L_CHART_SERIES` | Pie and donut take exactly one series |
| `L_CHART_CATEGORIES` | Every series length must equal `categories.length` |
| `L_CHART_VALUES` | All values finite; no negatives in a pie/donut |
| `L_CHART_POINTS` | 10 000 data points per chart, hard ceiling |

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

## What is not here

pdfnative 1.6.0 ships bar, barH, line, pie and donut on a linear axis. Stacked
bars, area, scatter, secondary/log/time axes and per-point data labels are
tracked as "Charts v2" on the [engine's roadmap](https://github.com/Nizoka/pdfnative/blob/main/ROADMAP.md)
— when they land there, they reach this package as new `ChartProps` fields.
