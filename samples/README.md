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
| [fonts/fonts-prop.tsx](fonts/fonts-prop.tsx) | `resolveFonts` and the async `options.fonts` shortcut. |
| [layout/page-setup.tsx](layout/page-setup.tsx) | Page size, margins, and PDF/A-2b archival mode via `layout`. |
| [layout/viewer-preferences.tsx](layout/viewer-preferences.tsx) | `layout.viewerPreferences` — control how a reader opens the PDF. |
| [layout/debug-inspect.tsx](layout/debug-inspect.tsx) | `layout.debug` overlay + `inspectDocument` layout report. |

## Agent samples — token-frugal authoring

The compact `DocSpec` lets LLM agents author documents with a fraction of the
tokens of JSX, compiling to the **same** PDF.

| Sample | Shows |
|---|---|
| [agent/compact-spec.ts](agent/compact-spec.ts) | A full invoice from a terse `DocSpec` → `renderSpecToFile`. |
| [agent/schema.ts](agent/schema.ts) | Print the versioned JSON Schema agents validate against. |

## Client samples (React components)

These are browser/React component modules (not standalone scripts). Drop them
into a React 19 app.

| Sample | Shows |
|---|---|
| [client/use-pdf.tsx](client/use-pdf.tsx) | Live blob-URL preview with the `usePdf` hook. |
| [client/viewer.tsx](client/viewer.tsx) | `PDFViewer`, `PDFDownloadLink`, and `BlobProvider`. |
