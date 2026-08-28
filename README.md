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
- **Server-ready.** `renderToResponse` returns a web-standard `Response`,
  streaming by default — one line in a Next.js route handler, and the same code
  on Edge, Deno, Bun and Workers. See [Server rendering](docs/SERVER.md).
- **Token-frugal AI authoring.** A compact `DocSpec` lets LLM agents emit
  documents with a fraction of the tokens of JSX, validated by a versioned JSON
  Schema — see [Agent authoring](#agent-authoring-token-frugal).
- **Autonomously usable.** `doctor()`, `capabilityManifest()`, `validateSpec()`
  and a stable `E_*` error taxonomy let an agent check the environment, discover
  the API and verify its own output before rendering — see the
  [agent contract](docs/AGENT_CONTRACT.md).
- **Checks its own work.** `lintDocument` reports accessibility problems and
  pre-empts the engine constraints that would otherwise throw mid-render — see
  [Linting](docs/LINTING.md).
- **Validated against veraPDF.** A PDF/A corpus covering both authoring doors
  and all four conformance targets is validated with the pinned veraPDF
  reference validator — locally (`npm run validate:pdfa`) and as a blocking CI
  and pre-publish gate, with negative canaries the validator must reject. See
  [CONTRIBUTING.md](CONTRIBUTING.md#pdfa-validation-verapdf).
- **Typed, tested, tree-shakeable.** Strict TypeScript, dual ESM + CJS, source
  maps, provenance-signed publishes.

## Install

```bash
npm install pdfnative-react pdfnative react
```

Requires **React 19**, **`pdfnative` ≥ 1.7**, and **Node.js ≥ 22** (the engine's
own floor since 1.6.0).

## Components

Every component maps 1:1 onto a pdfnative block.

| Component | Renders |
|---|---|
| `Document` | The required root (`title`, `footerText`, `metadata`, `fontEntries`, `layout`, `outline`, `pageLabels`, `watermark`, `header`, `footer`, `attachments`, `tagged`, `print`). |
| `Page` | An explicit page boundary (content auto-paginates otherwise). |
| `Section` | Sugar: a heading grouped with its content (`title`, `level`, `color`, `break`). |
| `Heading` | A section heading (`level` 1–3); feeds the auto `TableOfContents`. |
| `Paragraph` / `Text` | A wrapping paragraph (`fontSize`, `lineHeight`, `align`, `indent`, `color`). |
| `List` / `Item` | A bullet or numbered (`ordered`) list; items may nest sub-lists. |
| `Table` / `Row` / `Cell` | A data table (`headers`/`rows` or JSX children; `cellBorders`, `cellVAlign`, `zebra`, `caption`, …). |
| `Image` | An embedded JPEG/PNG (`data: Uint8Array`). |
| `Link` | A clickable hyperlink (`url`/`href`). |
| `Spacer` | Vertical whitespace (`height`). |
| `PageBreak` | A hard page break. |
| `TableOfContents` / `Toc` | An auto-generated TOC built from headings. |
| `Barcode` | QR, Code 128, EAN-13, PDF417, Data Matrix (`format`, `data`). |
| `Svg` | Inline vector graphics (path data or markup; `<text>` renders as selectable PDF text). |
| `Chart` | Native vector charts — bar, barH, line, pie, donut, stackedBar, stackedBarH, area, scatter; log/time scales, dual axes, data labels ([guide](docs/CHARTS.md)). |
| `FormField` | Interactive AcroForm widgets (`fieldType`, `name`). |

### Document-level page furniture

`watermark`, `header`, `footer`, `attachments`, `tagged` and `print` are props
on `<Document>` rather than components, because they are page furniture, not
blocks in the flow. They fold into `layout` under the engine's own keys, and an
explicit `layout` prop always wins.

```tsx
<Document
    watermark="DRAFT"                                  // or the full WatermarkOptions
    header={{ left: 'Acme Inc', right: '{date}' }}
    footer={{ center: '{title}', right: 'Page {page} of {pages}' }}
    tagged="pdfa3b"
    attachments={[{ filename: 'data.xml', data, mimeType: 'application/xml' }]}
    print={{ bleed: 9, marks: true }}                  // print production (engine ≥ 1.7)
/>
```

Header and footer templates resolve `{page}`, `{pages}`, `{date}` and `{title}`
at render time. `print` adds bleed/trim/art/crop boxes, vector printer's marks
and large-format `userUnit`; `metadata.trapped` and the print-dialog viewer
preferences (`duplex`, `printPageRange`, `numCopies`, `pickTrayByPDFSize` under
`layout.viewerPreferences`) complete the prepress surface — see
[samples/layout/print-production.tsx](samples/layout/print-production.tsx).

## Rendering

```ts
import {
    renderToBytes,      // (node, options?) => Uint8Array
    renderToBlob,       // (node, options?) => Blob (application/pdf)
    renderToStream,     // (node, options?) => AsyncGenerator<Uint8Array> (constant memory)
    renderToFile,       // (node, path, options?) => Promise<void> (Node only)
    renderToFileStream, // (node, path, options?) => Promise<StreamToFileResult> (Node, constant memory)
    renderToResponse,   // (node, options?) => Promise<Response> (streams; web standard)
    compileDocument,    // (node) => DocumentParams (inspect the model, no render)
    inspectDocument,    // (node, options?) => LayoutInspection (page/block geometry, no render)
    lintDocument,       // (node, options?) => LintReport (accessibility + engine constraints)
} from 'pdfnative-react';
```

### Serving a PDF

```tsx
// app/invoice/[id]/route.tsx — Next.js App Router
export async function GET() {
    return renderToResponse(<Invoice />, { fileName: 'invoice.pdf' });
}
```

Streams page by page, so peak memory stays flat and the client receives bytes
immediately. `buffered: true` switches to a single buffer and adds
`Content-Length`. Works unchanged on Node, Edge, Deno, Bun and Cloudflare
Workers — see [docs/SERVER.md](docs/SERVER.md).

`options` is `{ layout?: Partial<PdfLayoutOptions>; fontEntries?: FontEntry[]; fonts?: FontsMap }`
and merges on top of anything set on `<Document>` — page size, margins, colors,
PDF/A mode, encryption, viewer preferences, debug overlay, and non-Latin fonts.
`renderToFileStream` writes page by page with constant memory and preserves
document-level features (outline, page labels). The `fonts` loader map is
honored only by the async entry points (`renderToFile`, `renderToFileStream`,
`renderToResponse`, `usePdf`, `usePdfStream`); for the synchronous entries
resolve it first with `fontEntries: await resolveFonts({ … })`.

### Bookmarks, page labels & viewer preferences

```tsx
<Document
    outline="auto"                                  // or an explicit OutlineItem[] tree
    pageLabels={[{ startPage: 0, style: 'roman' }]} // roman front matter, then decimal
    layout={{ viewerPreferences: { pageMode: 'useOutlines' } }}
>
    …
</Document>
```

`outline` builds the reader's bookmark sidebar (`'auto'` derives it from your
headings, or pass a nested `OutlineItem[]`). `layout.viewerPreferences` controls
how a viewer opens the document. All PDF/A-safe.

### Layout debugging

`layout.debug` overlays margin/content/cell boxes onto the PDF, and
`inspectDocument(node)` returns the same geometry as data (page count, and each
block's position/size) without rendering — handy for tests and tooling.

### Nested lists

```tsx
<List>
    <Item>Fruits<List><Item>Apple</Item><Item>Pear</Item></List></Item>
    <Item>Vegetables</Item>
</List>
```

Sub-lists nest as a child `<List>`, as directly nested `<Item>` children, or via
the `items` data prop (`{ text, items }`). Nested lists inherit the parent style.

## Hooks & client components

These run in the browser. In a React Server Components app, import them from the
**`pdfnative-react/client`** subpath, which ships with `'use client'` already
applied — no wrapper file needed. The root barrel exports them too, for apps
without an RSC boundary.

```tsx
import { usePdf } from 'pdfnative-react/client';

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
- `renderSpecToBytes` / `renderSpecToBlob` / `renderSpecToStream` / `renderSpecToFile` /
  `renderSpecToFileStream` / `renderSpecToResponse`
- `schema(subject?)` → a Draft 2020-12 JSON Schema whose `$id` embeds the package
  version, so agents can detect contract drift. Subjects: `doc-spec`,
  `render-options`, `lint-report`, `spec-validation`, `doctor`, `manifest`,
  `list`. (`docSpecSchema()` is retained and returns `schema('doc-spec')`.)

Block tuples: `['h1'|'h2'|'h3', text, opts?]`, `['p', text, opts?]`,
`['ul'|'ol', items, opts?]` (items may be `{ text, items }` for nesting),
`['table', { h?, r, cellBorders?, cellVAlign?, … }]`, `['img', { data }]`,
`['link', text, { url }]`, `['sp', height?]`, `['br']`, `['page', blocks]`,
`['toc', opts?]`, `['qr'|'code128'|'ean13'|'pdf417'|'datamatrix', data, opts?]`,
`['svg', data, opts?]`, `['chart', { chartType, series, … }]`,
`['field', { fieldType, name, … }]`. A spec also accepts top-level `outline`,
`pageLabels`, `watermark`, `header`, `footer`, `attachments`, `tagged` and
`print`, mirroring `<Document>`.

### Running autonomously

An agent driving this package without a human should work through four cheap
checks before spending a render:

```ts
import { doctor, capabilityManifest, validateSpec, lintSpec } from 'pdfnative-react';

doctor();                  // will this environment work? never throws
capabilityManifest();      // every component, block, entry point, error code
validateSpec(json);        // is the JSON well-formed? path-anchored findings
lintSpec(spec);            // is it accessible, and legal for the engine?
```

Every error carries a stable `E_*` code and serializes to
`{ ok: false, error: { code, message } }`. Branch on the code, never the message.

Full contract: [docs/AGENT_CONTRACT.md](docs/AGENT_CONTRACT.md). Runnable:
[samples/agent/agent-loop.ts](samples/agent/agent-loop.ts).

## Fonts & environment

Re-exported from the engine: `registerFonts`, `registerFont`, `loadFontData`,
`downloadBlob` (browser), `initNodeCompression` (Node). Pass pre-loaded fonts via
the `fontEntries` render option, or use the `resolveFonts` convenience:

```ts
import { resolveFonts, renderToBytes } from 'pdfnative-react';

const fontEntries = await resolveFonts({
    math: () => import('pdfnative/fonts/noto-sans-math-data.js'),
});
const bytes = renderToBytes(doc, { fontEntries });
```

The async entry points accept the loader map directly as `options.fonts`.
`validateFontData(data)` runs an opt-in, read-only structural check on a custom
font module (`{ valid, errors, warnings }`) before you embed it.

### Font weight — check before shipping to a browser

Font modules are embedded in your bundle when you import them, and some are
large. Engine 1.6.0 expanded the colour-emoji subset from 221 to 1167 glyphs,
which took it from ~0.25 MB to **4.0 MB** — worth knowing, since this is the one
package in the ecosystem that targets a browser bundle.

| Module | Size |
|---|---|
| `noto-sans-math-data.js` | 1.5 MB |
| `noto-sans-data.js` | 2.8 MB |
| `noto-color-emoji-data.js` | **4.0 MB** |
| `noto-jp-data.js` | 12.6 MB |
| `noto-sc-data.js` | 23.4 MB |

The loaders passed to `resolveFonts` are dynamic imports, so a bundler puts each
in its own chunk and loads it on demand rather than up front. For a smaller
emoji set, generate one covering only the codepoints you use:

```bash
npx pdfnative-build-emoji-font --codepoints "1F600,1F44D,2764"
```

Server-side rendering is unaffected — nothing is bundled there.

### Image helpers

`fromBase64(base64)` and `fromUrl(url)` produce the `Uint8Array` that `<Image>`
expects, from a base64/data-URI payload or a fetched URL respectively.

## Beyond authoring: post-processing

pdfnative-react covers document *authoring*. For byte-level post-processing —
merging/splitting, filling and flattening forms, text extraction, decryption,
digital signatures, annotations, or in-app font compilation — use the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) engine directly on the
bytes this library produces.

[docs/RECIPES.md](docs/RECIPES.md) shows each of those, with working code.

## Upgrading to 1.2

Everything in 1.2.0 is additive. One install-time floor moved:

```bash
npm install pdfnative-react@^1.2.0 pdfnative@^1.7.0 react@^19
```

- **`pdfnative` ≥ 1.7** is now required. The four new chart kinds,
  `layout.print` and the diagnostics channel do not exist before 1.7.0, so an
  older engine would throw mid-render. `doctor()` tells a 1.6.x engine apart
  from a missing one and says exactly what to upgrade.
- Rendering behaviour inherited from the engine, with no code change here:
  RTL digit order, glyph mirroring and Arabic/Persian letterforms are now
  UAX #9-conformant (Arabic-script documents render differently — and
  correctly), form documents gain a complete `/ToUnicode` map (their bytes
  change; text becomes searchable), and crowded chart x-labels are strided
  automatically (`labelStride: 1` restores the old behaviour).

No API was removed or changed. New: the Charts v2 props (`axis2`, `xAxis`,
`dataLabels`, `labelStride`, `labelRotation`, series `xValues`/`yAxis`), the
`print` document prop, `metadata.trapped`, `layout.strict`/`onDiagnostic`,
seven lint rules (25 total), `cacheControl`/`etag` on `renderToResponse`, and
`ErrorOptions`/`cause` on the error taxonomy.

## Upgrading to 1.1

Everything in 1.1.0 is additive. Two install-time floors moved:

```bash
npm install pdfnative-react@^1.1.0 pdfnative@^1.6.0 react@^19
```

- **`pdfnative` ≥ 1.6** is now required. `<Chart>` compiles to a block type that
  does not exist before 1.6.0, so an older engine would silently mis-render it.
- **Node ≥ 22** — inherited, not invented: `pdfnative@1.6.0` requires it, so a
  compliant install is already there.

No API was removed or changed. New: `<Chart>`, `renderToResponse`,
`lintDocument`, the `watermark`/`header`/`footer`/`attachments`/`tagged`
document props, and the agent surface (`doctor`, `capabilityManifest`,
`validateSpec`, `schema(subject)`, `ErrorCode`). `docSpecSchema()` still works
and delegates to `schema('doc-spec')`.

## Migrating from 0.2 to 1.0

1.0 marked the API as stable. The only breaking change was **`pdfnative`
becoming a peer dependency**, installed alongside the wrapper. Everything else
was additive — `<Section>`, nested lists, `outline`/`pageLabels` on
`<Document>`, table `cellBorders`/`cellVAlign`, `inspectDocument`,
`renderToFileStream`, `resolveFonts`, and `fromUrl`/`fromBase64`.

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

**Guides**

- [Charts](docs/CHARTS.md) — the nine chart types, dual axes, log/time scales,
  accessibility, PDF/A.
- [Server rendering](docs/SERVER.md) — `renderToResponse` on Next.js, Remix,
  Hono, Deno, Bun, Workers and Express.
- [Linting](docs/LINTING.md) — the twenty-five rules, and how to gate on them.
- [Recipes](docs/RECIPES.md) — merging, form filling, text extraction,
  decryption: calling the engine on the bytes this library produces.
- [Agent contract](docs/AGENT_CONTRACT.md) — driving the package autonomously.

**Reference**

- [Knowledge Base](docs/KNOWLEDGE_BASE.md) — architecture, the compile pipeline,
  the react-reconciler version contract, and the agent authoring contract.
- [AGENTS.md](AGENTS.md) — guidance for AI agents working in this repo.
- [AI Governance](docs/AI_GOVERNANCE.md) — the human-in-the-loop draftsman
  contract for AI agents proposing issues/PRs (`npm run verify:issue`).
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 Nizoka — [Plika](https://plika.app)
