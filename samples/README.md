# Samples

Runnable, type-checked examples for **pdfnative-react**. Every sample under this
folder is compiled in CI (`npm run typecheck:samples`), so they never drift from
the API.

## Run

From the repository root (after `npm install`):

```bash
npx tsx samples/invoice.tsx          # writes invoice.pdf
npx tsx samples/agent/compact-spec.ts # writes compact-spec.pdf
```

> Samples import from the local source (`../src/index.js`) for convenience, and
> add `import React from 'react'` so they run under `tsx`'s classic JSX runtime.
> In your own React 19 app you import from the `pdfnative-react` package and omit
> the React import (the automatic runtime needs no import).

## Document samples (write a PDF)

| Sample | Shows |
|---|---|
| [invoice.tsx](invoice.tsx) | Headings, paragraphs, a data-driven table, a total, footer + metadata. |
| [report.tsx](report.tsx) | Multi-page report with an auto table of contents and page breaks. |
| [text/typography.tsx](text/typography.tsx) | Heading levels, alignment, color, font size, line height, indent. |
| [text/typography-engine.tsx](text/typography-engine.tsx) | The typography engine (engine 1.8.0): every key, `align="justify"`, `keepWithNext` / `splittable`, soft hyphens, a hyphenation provider. |
| [text/typography-french.tsx](text/typography-french.tsx) | The `punctuationSpacing` presets (`'fr'`, `'fr-CA'`) and explicit rules; the one sample with a `demo-language: fr` line. |
| [table/data-table.tsx](table/data-table.tsx) | `<Row>`/`<Cell>` authoring, header row, typed rows, zebra, caption. |
| [media/image.tsx](media/image.tsx) | Embedding raw PNG/JPEG bytes with `<Image>`. |
| [media/link.tsx](media/link.tsx) | Clickable hyperlinks. |
| [media/barcode.tsx](media/barcode.tsx) | All formats: QR, Code 128, EAN-13, PDF417, Data Matrix. |
| [media/svg.tsx](media/svg.tsx) | Inline vector graphics with fill/stroke/viewBox. |
| [media/svg-text.tsx](media/svg-text.tsx) | SVG `<text>`/`<tspan>` rendered as native, selectable PDF text. |
| [media/image-helpers.tsx](media/image-helpers.tsx) | `fromBase64` / `fromUrl` producing bytes for `<Image>`. |
| [forms/form-fields.tsx](forms/form-fields.tsx) | Interactive AcroForm widgets (text, checkbox, dropdown, listbox…). |
| [structure/sections.tsx](structure/sections.tsx) | TOC, multi-page, hard page breaks, spacers. |
| [structure/section.tsx](structure/section.tsx) | `<Section>` — a heading grouped with its content (with `break`). |
| [structure/outline.tsx](structure/outline.tsx) | Bookmarks: explicit nested `outline` + `outline="auto"` + `pageLabels`. |
| [structure/stream-to-file.tsx](structure/stream-to-file.tsx) | `renderToFileStream` — constant-memory output for large documents. |
| [text/nested-lists.tsx](text/nested-lists.tsx) | Nested lists in all three authoring forms. |
| [text/math.tsx](text/math.tsx) | Unicode math via the bundled Noto Sans Math font (`resolveFonts`). |
| [table/cell-borders.tsx](table/cell-borders.tsx) | Cell borders, vertical alignment, and `kind: 'amount'` columns. |
| [fonts/custom-fonts.tsx](fonts/custom-fonts.tsx) | Registering a TTF for non-Latin scripts via `fontEntries`. |
| [fonts/fonts-prop.tsx](fonts/fonts-prop.tsx) | `resolveFonts` and the async `options.fonts` shortcut (renders the same document twice — the pair is identical by design). |
| [fonts/scripts-27.tsx](fonts/scripts-27.tsx) | The five scripts engine 1.8.0 adds (Lao, Tai Tham, New Tai Lue, Tai Le, Cham) and the Hausa/Yoruba/Igbo/Swahili Latin aliases through `resolveFonts`. |
| [layout/page-setup.tsx](layout/page-setup.tsx) | Page size, margins, and PDF/A-2b archival mode via `layout`. |
| [layout/viewer-preferences.tsx](layout/viewer-preferences.tsx) | `layout.viewerPreferences` — control how a reader opens the PDF. |
| [layout/debug-inspect.tsx](layout/debug-inspect.tsx) | `layout.debug` overlay + `inspectDocument` layout report. |
| [layout/watermark-header-footer.tsx](layout/watermark-header-footer.tsx) | `watermark` / `header` / `footer` / `attachments` / `tagged` props, and a real PDF/A-3 document. |
| [layout/print-production.tsx](layout/print-production.tsx) | `print` — bleed + printer's marks, `trapped` metadata, and duplex/copies Print-dialog defaults. |
| [layout/print-pdfx4.tsx](layout/print-pdfx4.tsx) | A press-ready PDF/X-4 sheet: `pdfx="pdfx4"`, a CMYK output intent, CMYK colours, crop marks and colour bars in a 5 mm bleed; linted first, checked with the engine's `validatePdfX` afterwards. |
| [layout/cmyk.tsx](layout/cmyk.tsx) | CMYK colour on every colour position — text, links, table borders and zebra, chart palettes, watermark, header and footer. |
| [charts/charts.tsx](charts/charts.tsx) | All five chart types: bar, horizontal bar, line, pie, donut — with axes, legends, palettes and negative values. |
| [charts/charts-v2.tsx](charts/charts-v2.tsx) | Charts v2 (engine 1.7.0): stacked bars, area, scatter, time and dual axes, log scale, data labels, label rotation. | <!-- verify-docs:allow version-token -->

## Generate all, and the byte baseline

Every runnable sample is listed in `scripts/lib/sample-plan.ts` and rendered by
the repository into a byte baseline:

```bash
npm run build && npm run test:generate    # every sample, one process each, instant pinned, into test-output/samples/
npx tsx scripts/verify-samples.ts         # SHA-256 of every PDF against tests/regression/baselines/samples.sha256.json
```

CI holds the baseline on Linux, Windows and macOS. A new sample, or an intended
change to an existing one, is rebaselined with
`npx tsx scripts/verify-samples.ts --update` and declared in the release note;
the manifest's `provenance` note says why. Samples never read the environment:
the generator pins the creation instant before the sample loads. Prose in a
sample is English; the one French sentence (`text/typography-french.tsx`)
carries a `demo-language: fr` marker.

## Server samples — HTTP responses

`renderToResponse` returns a web-standard `Response`, so one implementation
covers Next.js, Remix, Hono, Deno, Bun and Cloudflare Workers.

| Sample | Shows |
|---|---|
| [server/next-route-handler.tsx](server/next-route-handler.tsx) | A Next.js App Router route handler, streaming and buffered modes, the `DocSpec` variant, and an Express recipe. |

## Quality samples

| Sample | Shows |
|---|---|
| [quality/lint.tsx](quality/lint.tsx) | `lintDocument` — accessibility findings, rule filtering, the opt-in overflow check, and a CI gate. |
| [quality/diagnostics.tsx](quality/diagnostics.tsx) | The conformance diagnostics channel (9 codes as of engine 1.8.0): `layout.onDiagnostic` sink, `layout.strict` escalation, and a `TYPOGRAPHY_FEATURE_INEFFECTIVE` example. |
| [quality/reproducible.tsx](quality/reproducible.tsx) | Byte-reproducible output: `creationDate`, `setDefaultCreationDate`, UTC dates, the same SHA-256 twice, and how a pipeline applies `SOURCE_DATE_EPOCH` itself. |

## Agent samples — autonomous usage

The compact `DocSpec` lets LLM agents author documents with a fraction of the
tokens of JSX, compiling to the **same** PDF. The rest of the agent surface —
discovery, pre-flight, validation — is designed to be driven without a human in
the loop. See [docs/AGENT_CONTRACT.md](../docs/AGENT_CONTRACT.md).

| Sample | Shows |
|---|---|
| [agent/agent-loop.ts](agent/agent-loop.ts) | **Start here.** The full loop: `doctor` → `capabilityManifest` → `schema` → `validateSpec` → `compileSpec` → `lintSpec` → render. |
| [agent/compact-spec.ts](agent/compact-spec.ts) | A full invoice from a terse `DocSpec` → `renderSpecToFile`. |
| [agent/manifest.ts](agent/manifest.ts) | `capabilityManifest()` — every component, block, entry point, error code and lint rule. Pass `--json` to pipe it. |
| [agent/error-envelope.tsx](agent/error-envelope.tsx) | The `E_*` taxonomy, `toErrorEnvelope`, and branching on codes rather than messages. |
| [agent/schema.ts](agent/schema.ts) | Print the versioned JSON Schema agents validate against. |
| [agent/visual-verify.tsx](agent/visual-verify.tsx) | Tier 5 for vision agents: render → rasterize (pdftoppm/mutool) → look at the PNG; degrades to the geometry report without a rasterizer. |

## Client samples (React components)

These are browser/React component modules (not standalone scripts). Drop them
into a React 19 app.

| Sample | Shows |
|---|---|
| [client/use-pdf.tsx](client/use-pdf.tsx) | Live blob-URL preview with the `usePdf` hook. |
| [client/viewer.tsx](client/viewer.tsx) | `PDFViewer`, `PDFDownloadLink`, and `BlobProvider`. |
