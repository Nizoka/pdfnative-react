# pdfnative-react

[![npm version](https://img.shields.io/npm/v/pdfnative-react)](https://www.npmjs.com/package/pdfnative-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![pdfnative](https://img.shields.io/npm/v/pdfnative?label=pdfnative&color=0066FF)](https://www.npmjs.com/package/pdfnative)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Nizoka/pdfnative-react/badge)](https://scorecard.dev/viewer/?uri=github.com/Nizoka/pdfnative-react)

Write PDFs the way you write UIs. **pdfnative-react** turns declarative JSX into
real, on-device PDF documents powered by the zero-dependency
[`pdfnative`](https://www.npmjs.com/package/pdfnative) engine — no DOM, no
headless browser, no SaaS round-trips. Your documents never leave the process.

```tsx
import { Document, Heading, Text, Table, renderToBytes } from 'pdfnative-react';

const bytes = renderToBytes(
    <Document title="Invoice #1024" footerText="Acme Inc">
        <Heading level={1}>Invoice #1024</Heading>
        <Text>Thank you for your business.</Text>
        <Table
            headers={['Item', 'Qty', 'Total']}
            rows={[
                { cells: ['Pro plan', '1', '$49.00'], type: 'default', pointed: false },
            ]}
            zebra
        />
    </Document>,
);
// → Uint8Array, a valid PDF (%PDF-… …%%EOF)
```

## Why pdfnative-react

- **Declarative & familiar.** Components mirror `@react-pdf/renderer`
  ergonomics (`Document`, `Page`, `Text`, `Image`, `Link`, `usePdf`,
  `PDFViewer`, `PDFDownloadLink`, `BlobProvider`).
- **On-device.** A custom React reconciler compiles your tree — synchronously,
  with no DOM — to the `pdfnative` model and renders the bytes locally.
- **Honest model.** Components map 1:1 onto pdfnative blocks. There is no
  CSS/flexbox engine and no `<View>` — it is a declarative *block flow*.
- **Token-frugal AI authoring.** A compact `DocSpec` lets LLM agents emit
  documents with a fraction of the tokens of JSX, validated by a versioned JSON
  Schema — see [Agent authoring](#agent-authoring-token-frugal).
- **Typed, tested, tree-shakeable.** Strict TypeScript, dual ESM + CJS, source
  maps, provenance-signed publishes.

## Install

```bash
npm install pdfnative-react pdfnative react
```

Requires **React 19** and **Node.js ≥ 20**.

## Components

Every component maps 1:1 onto a pdfnative block.

| Component | Renders |
|---|---|
| `Document` | The required root (`title`, `footerText`, `metadata`, `fontEntries`, `layout`). |
| `Page` | An explicit page boundary (content auto-paginates otherwise). |
| `Heading` | A section heading (`level` 1–3); feeds the auto `TableOfContents`. |
| `Paragraph` / `Text` | A wrapping paragraph (`fontSize`, `lineHeight`, `align`, `indent`, `color`). |
| `List` / `Item` | A bullet or numbered (`ordered`) list. |
| `Table` / `Row` / `Cell` | A data table (data-driven `headers`/`rows`, or JSX `<Row>`/`<Cell>`). |
| `Image` | An embedded JPEG/PNG (`data: Uint8Array`). |
| `Link` | A clickable hyperlink (`url`/`href`). |
| `Spacer` | Vertical whitespace (`height`). |
| `PageBreak` | A hard page break. |
| `TableOfContents` / `Toc` | An auto-generated TOC built from headings. |
| `Barcode` | QR, Code 128, EAN-13, PDF417, Data Matrix (`format`, `data`). |
| `Svg` | Inline vector graphics (path data or markup). |
| `FormField` | Interactive AcroForm widgets (`fieldType`, `name`). |

## Rendering

```ts
import {
    renderToBytes,   // (node, options?) => Uint8Array
    renderToBlob,    // (node, options?) => Blob (application/pdf)
    renderToStream,  // (node, options?) => AsyncGenerator<Uint8Array> (constant memory)
    renderToFile,    // (node, path, options?) => Promise<void> (Node only)
    compileDocument, // (node) => DocumentParams (inspect the model, no render)
} from 'pdfnative-react';
```

`options` is `{ layout?: Partial<PdfLayoutOptions>; fontEntries?: FontEntry[] }`
and merges on top of anything set on `<Document>` — page size, margins, colors,
PDF/A mode, encryption, and non-Latin fonts.

## Hooks & client components

Client modules carry `'use client'`.

```tsx
'use client';
import { usePdf } from 'pdfnative-react';

function Preview({ doc }: { doc: React.ReactElement }) {
    const { url, loading } = usePdf(doc);
    return loading ? <p>Rendering…</p> : <iframe title="preview" src={url} />;
}
```

- `usePdf(element, options?)` → `{ url, blob, bytes, loading, error, update }`
- `usePdfStream(element, options?)` → `{ getStream() }`
- `PDFViewer` — live `<iframe>` preview.
- `PDFDownloadLink` — one-click download (supports a render-prop child).
- `BlobProvider` — render-prop access to the raw `Blob`.

## Agent authoring (token-frugal)

pdfnative-react is a *library*, so the place LLM agents spend tokens is
**authoring** documents. The compact `DocSpec` expresses the same document as
terse, JSON-serializable tuples — and compiles to the **exact same** PDF as the
JSX, because it is built on the very same components.

```ts
import { renderSpecToBytes, type DocSpec } from 'pdfnative-react';

const spec: DocSpec = {
    title: 'Invoice #1024',
    footerText: 'Acme Inc',
    blocks: [
        ['h1', 'Invoice #1024'],
        ['p', 'Thank you for your business.', { align: 'right' }],
        ['table', { h: ['Item', 'Total'], r: [['Pro plan', '$49.00']], zebra: true }],
        ['qr', 'https://acme.example/pay/1024', { align: 'right' }],
    ],
};

const bytes = renderSpecToBytes(spec);
```

The equivalent JSX is several times more tokens for a typical document (the gap
widens on larger ones), because every block carries opening/closing tags and
prop names. Same bytes out, far fewer tokens in.

- `compileSpec(spec)` → `DocumentParams` · `specToElement(spec)` → `<Document>` element
- `renderSpecToBytes` / `renderSpecToBlob` / `renderSpecToStream` / `renderSpecToFile`
- `docSpecSchema()` → a Draft 2020-12 JSON Schema whose `$id` embeds the package
  version, so agents can self-validate a spec before rendering.

Block tuples: `['h1'|'h2'|'h3', text, opts?]`, `['p', text, opts?]`,
`['ul'|'ol', items, opts?]`, `['table', { h?, r }]`, `['img', { data }]`,
`['link', text, { url }]`, `['sp', height?]`, `['br']`, `['page', blocks]`,
`['toc', opts?]`, `['qr'|'code128'|'ean13'|'pdf417'|'datamatrix', data, opts?]`,
`['svg', data, opts?]`, `['field', { fieldType, name, … }]`.

## Fonts & environment

Re-exported from the engine: `registerFonts`, `registerFont`, `loadFontData`
(Node), `downloadBlob` (browser), `initNodeCompression` (Node). Pass non-Latin
fonts via the `fontEntries` render option.

## Migrating from `@react-pdf/renderer`

| `@react-pdf/renderer` | pdfnative-react |
|---|---|
| `<Document>` / `<Page>` | `<Document>` / `<Page>` |
| `<Text>` | `<Text>` (alias of `<Paragraph>`) |
| `<View>` + flexbox styles | *(none — declarative block flow; use blocks + `<Spacer>`)* |
| `StyleSheet` | per-component props (`align`, `color`, `fontSize`, …) |
| `<PDFViewer>` / `<PDFDownloadLink>` / `<BlobProvider>` | same names, same shape |
| `usePDF()` | `usePdf()` |

## Examples

Runnable, type-checked examples live in [samples/](samples/README.md): typography,
tables, images, links, barcodes, SVG, form fields, multi-page structure, custom
fonts, layout/PDF-A, the client hooks/components, and the compact agent spec.

## The pdfnative ecosystem

| Package | Use it for |
|---|---|
| [`pdfnative`](https://www.npmjs.com/package/pdfnative) | The zero-dependency PDF engine — Node, browsers, Workers, Deno, Bun. |
| **`pdfnative-react`** | Declarative React/JSX components with live preview (this package). |
| [`pdfnative-cli`](https://www.npmjs.com/package/pdfnative-cli) | Render, sign, inspect, and verify PDFs from the shell. |
| [`pdfnative-mcp`](https://www.npmjs.com/package/pdfnative-mcp) | Generate PDFs from Claude Desktop, Cursor, Continue, Zed. |

## Documentation

- [Knowledge Base](docs/KNOWLEDGE_BASE.md) — architecture, the compile pipeline,
  the react-reconciler version contract, and the agent authoring contract.
- [AGENTS.md](AGENTS.md) — guidance for AI agents working in this repo.
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 Nizoka — [Plika](https://plika.app)
