# pdfnative-react

[![npm version](https://img.shields.io/npm/v/pdfnative-react)](https://www.npmjs.com/package/pdfnative-react)
[![CI](https://github.com/Nizoka/pdfnative-react/actions/workflows/ci.yml/badge.svg)](https://github.com/Nizoka/pdfnative-react/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![pdfnative](https://img.shields.io/badge/pdfnative-1.8-0a7e8c.svg)](https://github.com/Nizoka/pdfnative)
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

- **Declarative & familiar.** 19 components mirror `@react-pdf/renderer`
  ergonomics (`Document`, `Page`, `Text`, `Image`, `Link`, `usePdf`,
  `PDFViewer`, `PDFDownloadLink`, `BlobProvider`).
- **On-device.** A custom React reconciler compiles your tree — synchronously,
  with no DOM — to the `pdfnative` model and renders the bytes locally.
- **Honest model.** Components map 1:1 onto pdfnative blocks. There is no
  CSS/flexbox engine and no `<View>` — it is a declarative *block flow*.
- **Fine typography.** Paragraphs that split across pages under widow and
  orphan rules, headings kept with what follows, justification with hanging
  punctuation, kerning, OpenType features, units and short words that never
  break — all opt-in. See [Typography](docs/TYPOGRAPHY.md).
- **Print colour and PDF/X-4.** CMYK on every colour position, colour bars in
  the bleed, CMYK and Gray output intents, and the PDF/X-4 conformance claim
  with every constraint linted before the render. See [Print](docs/PRINT.md).
- **Byte-reproducible.** Pin `creationDate` and the same document renders to
  the same bytes on every host, in every time zone — proven by the repository
  on Linux, Windows and macOS. See [Reproducible output](docs/REPRODUCIBLE.md).
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
  pre-empts the engine constraints that would otherwise throw mid-render — 37
  lint rules, see [Linting](docs/LINTING.md).
- **Validated against veraPDF and `validatePdfX`.** A PDF/A and PDF/X corpus
  covering both authoring doors is validated with the pinned veraPDF reference
  validator and the engine's PDF/X validator — locally and as a blocking gate,
  with negative canaries the validators must reject. See
  [CONTRIBUTING.md](CONTRIBUTING.md#pdfa-and-pdfx-validation).
- **27 Unicode scripts.** Every bundled font module of the engine — Latin with
  its tone-marked African languages, Arabic, Indic, Thai, Lao, Khmer, Myanmar,
  Tai Tham, Cham, CJK, colour emoji and more — through one `resolveFonts` call.
- **Typed, tested, tree-shakeable.** Strict TypeScript, dual ESM + CJS with
  per-condition types, source maps, provenance-signed publishes, 810 tests.

## Install

```bash
npm install pdfnative-react pdfnative react
```

Requires **React 19**, **`pdfnative` ≥ 1.8**, and **Node.js ≥ 22** (the engine's
own floor since 1.6.0).

## Components

Every component maps 1:1 onto a pdfnative block.

| Component | Renders |
|---|---|
| `Document` | The required root (`title`, `footerText`, `metadata`, `fontEntries`, `layout`, `outline`, `pageLabels`, `watermark`, `header`, `footer`, `attachments`, `tagged`, `print`, `pdfx`, `outputIntent`, `typography`, `creationDate`). |
| `Page` | An explicit page boundary (content auto-paginates otherwise). |
| `Section` | Sugar: a heading grouped with its content (`title`, `level`, `color`, `break`). |
| `Heading` | A section heading (`level` 1–3, `keepWithNext`); feeds the auto `TableOfContents`. |
| `Paragraph` / `Text` | A wrapping paragraph (`fontSize`, `lineHeight`, `align` incl. `'justify'`, `indent`, `color`, `keepWithNext`, `splittable`). |
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

Every `color` prop — and chart palettes, table borders and zebra stripes,
watermarks, headers and footers — accepts a hex string, an RGB tuple, a
CMYK tuple in percent (`[0, 60, 100, 0]`) or a PDF operator string.

### Document-level page furniture

`watermark`, `header`, `footer`, `attachments`, `tagged`, `print`, `pdfx`,
`outputIntent`, `typography` and `creationDate` are props on `<Document>`
rather than components, because they are page furniture, not blocks in the
flow. They fold into `layout` under the engine's own keys, and an explicit
`layout` prop always wins.

```tsx
<Document
    watermark="DRAFT"                                  // or the full WatermarkOptions
    header={{ left: 'Acme Inc', right: '{date}' }}
    footer={{ center: '{title}', right: 'Page {page} of {pages}' }}
    tagged="pdfa3b"
    attachments={[{ filename: 'data.xml', data, mimeType: 'application/xml' }]}
    print={{ bleed: 14.17, marks: { crop: true, colourBars: true } }}   // print production (engine ≥ 1.7; colour bars ≥ 1.8)
    typography={{ splitParagraphs: true, orphans: 2, widows: 2 }}       // engine ≥ 1.8
    creationDate="2026-01-01T00:00:00Z"                                 // byte-reproducible output
/>
```

Header and footer templates resolve `{page}`, `{pages}`, `{date}` and `{title}`
at render time (`{date}` follows a pinned `creationDate`). `print` adds
bleed/trim/art/crop boxes, vector printer's marks, colour bars and large-format
`userUnit`; `metadata.trapped` and the print-dialog viewer preferences
(`duplex`, `printPageRange`, `numCopies`, `pickTrayByPDFSize` under
`layout.viewerPreferences`) complete the prepress surface — see
[samples/layout/print-production.tsx](samples/layout/print-production.tsx).

### Typography

```tsx
<Document
    fontEntries={fontEntries}                                    // kerning, features and 'fr' need a registered font
    typography={{
        splitParagraphs: true, orphans: 2, widows: 2,            // paragraphs break across pages, never leaving a lone line
        keepHeadingsWithNext: { minLines: 3 },                   // a heading takes three lines of its paragraph along
        unitBinding: true, bindShortWords: true,                 // "150 €", "12 kg" and "a" never end a line
        punctuationSpacing: 'fr',                                // narrow no-break spaces before ; ! ? — 'fr-CA' too
        opticalMargins: true, kerning: true,                     // hanging punctuation, GPOS pair kerning
        fontFeatures: ['smcp', 'onum'], metrics: 'exact',        // OpenType features; Adobe Core 14 advances for base-14 text
    }}
>
    <Heading level={2} keepWithNext>Results</Heading>
    <Paragraph align="justify" splittable>…</Paragraph>
</Document>
```

All twelve keys are off by default: a document that sets none renders
byte-identically to earlier releases. `align="justify"` is paragraph-only
(`ParagraphAlign = Align | 'justify'`). No hyphenation dictionary ships —
soft hyphens (U+00AD) are honoured and `setHyphenationProvider` accepts yours.
Anything a font cannot deliver is a lint finding (`L_TYPOGRAPHY_INEFFECTIVE`)
before it is an engine diagnostic. Guide: [docs/TYPOGRAPHY.md](docs/TYPOGRAPHY.md).

### Print colour and PDF/X-4

```tsx
<Document
    pdfx="pdfx4"
    fontEntries={fontEntries}
    metadata={{ trapped: 'False' }}
    outputIntent={{ iccProfile: pressProfile, outputConditionIdentifier: 'FOGRA39' }}   // a prtr profile — none is bundled
    print={{ bleed: 14.17, marks: { crop: true, registration: true, colourBars: true } }}
>
    <Heading level={1} color={[0, 0, 0, 100]}>Press sheet</Heading>
    <Paragraph color="0 1 1 0">Set in DeviceCMYK.</Paragraph>
</Document>
```

`pdfx="pdfx4"` writes the PDF/X-4 identification, a `/GTS_PDFX` output intent,
a TrimBox per page and `/Trapped`. Every constraint the engine enforces — an
output intent with a printer profile, a known trapping state, embedded fonts,
no `tagged`, no encryption, a TrimBox *or* an ArtBox — is an `L_PDFX_*` lint
rule before it is a throw. Check the bytes with the engine's `validatePdfX()`
([recipe](docs/RECIPES.md#validate--and-see--the-output)); a `valid` result
means the structural prerequisites hold, not that a certified preflight
passed. Guide: [docs/PRINT.md](docs/PRINT.md).

### Reproducible output

```tsx
<Document creationDate={new Date('2026-01-01T00:00:00Z')}>   // this document
setDefaultCreationDate(new Date('2026-01-01T00:00:00Z'));    // every document in this process
```

Every date the engine writes is UTC; the `{date}` placeholder and the trailer
`/ID` follow the pin; the same document gives the same bytes on every host.
The library reads no environment variable — a pipeline exporting
`SOURCE_DATE_EPOCH` applies it in one line of its own. Encrypted output is not
reproducible by design. `renderToResponse({ etag: true })` is therefore a
stable validator only when the document is pinned. Guide:
[docs/REPRODUCIBLE.md](docs/REPRODUCIBLE.md).

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
PDF/A mode, encryption, viewer preferences, typography, debug overlay, and
non-Latin fonts. `renderToFileStream` writes page by page with constant memory
and preserves document-level features (outline, page labels). The `fonts`
loader map is honored only by the async entry points (`renderToFile`,
`renderToFileStream`, `renderToResponse`, `usePdf`, `usePdfStream`); for the
synchronous entries resolve it first with `fontEntries: await resolveFonts({ … })`.

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
block's position/size) without rendering — handy for tests and tooling, and
the cheapest way to see where a paragraph split.

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
    creationDate: '2026-01-01T00:00:00Z',
    typography: { unitBinding: true, splitParagraphs: true },
    blocks: [
        ['h1', 'Invoice #1024'],
        ['p', 'Thank you for your business.', { align: 'justify' }],
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

Block tuples: `['h1'|'h2'|'h3', text, opts?]` (`keepWithNext`),
`['p', text, opts?]` (`align` incl. `'justify'`, `keepWithNext`, `splittable`),
`['ul'|'ol', items, opts?]` (items may be `{ text, items }` for nesting),
`['table', { h?, r, cellBorders?, cellVAlign?, … }]`, `['img', { data }]`,
`['link', text, { url }]`, `['sp', height?]`, `['br']`, `['page', blocks]`,
`['toc', opts?]`, `['qr'|'code128'|'ean13'|'pdf417'|'datamatrix', data, opts?]`,
`['svg', data, opts?]`, `['chart', { chartType, series, … }]`,
`['field', { fieldType, name, … }]`. A spec also accepts the 18 top-level
fields of `<Document>`: `title`, `footerText`, `metadata`, `fontEntries`,
`layout`, `outline`, `pageLabels`, `watermark`, `header`, `footer`,
`attachments`, `tagged`, `print`, `pdfx`, `outputIntent`, `typography`,
`creationDate` and `blocks`.

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

Every error carries one of 6 stable `E_*` codes and serializes to
`{ ok: false, error: { code, message } }`. Branch on the code, never the message.

Full contract: [docs/AGENT_CONTRACT.md](docs/AGENT_CONTRACT.md). Runnable:
[samples/agent/agent-loop.ts](samples/agent/agent-loop.ts).

## Fonts & environment

Re-exported from the engine: `registerFonts`, `registerFont`, `loadFontData`,
`downloadBlob` (browser), `initNodeCompression` (Node), `setDeflateImpl` /
`setDeflateRawImpl` / `wrapZlib` (inject a compressor elsewhere),
`setDefaultCreationDate` / `getDefaultCreationDate` (a process-wide pin),
`setHyphenationProvider` / `getHyphenationProvider`. Pass pre-loaded fonts via
the `fontEntries` render option, or use the `resolveFonts` convenience:

```ts
import { resolveFonts, renderToBytes } from 'pdfnative-react';

const fontEntries = await resolveFonts({
    math: () => import('pdfnative/fonts/noto-sans-math-data.js'),
    lo: () => import('pdfnative/fonts/noto-lao-data.js'),
});
const bytes = renderToBytes(doc, { fontEntries });
```

The async entry points accept the loader map directly as `options.fonts`.
`validateFontData(data)` runs an opt-in, read-only structural check on a custom
font module (`{ valid, errors, warnings }`) before you embed it. The engine
bundles 27 Unicode scripts as font modules — 1.8.0 added Lao, Tai Tham, New Tai
Lue, Tai Le and Cham, and Hausa, Yoruba, Igbo and Swahili on the Latin module —
see [samples/fonts/scripts-27.tsx](samples/fonts/scripts-27.tsx).

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
digital signatures, annotations, PDF/X or PDF/UA validation, or in-app font
compilation — use the [`pdfnative`](https://www.npmjs.com/package/pdfnative)
engine directly on the bytes this library produces.

[docs/RECIPES.md](docs/RECIPES.md) shows each of those, with working code.

## Upgrading to 1.3

Everything in 1.3.0 is additive. One install-time floor moved:

```bash
npm install pdfnative-react@^1.3.0 pdfnative@^1.8.0 react@^19
```

- **`pdfnative` ≥ 1.8** is now required. `layout.typography`, `layout.pdfx`,
  CMYK colour operands, colour bars and `setDeflateRawImpl` do not exist before
  1.8.0, so an older engine would throw mid-render or silently write RGB.
  `doctor()` tells a 1.7.x engine apart from a missing one and says exactly
  what to upgrade.
- Rendering behaviour inherited from the engine, with no code change here:
  every embedded TrueType subset changes bytes (hinting tables kept,
  `head.checkSumAdjustment` computed); printer's marks stop 0.5 pt short of
  the trim line; Indic, Khmer, Myanmar, Thai/Lao and Latin-with-marks text
  takes its designed mark positions; soft hyphens no longer render mid-word.
  Documents on base-14 fonts that use none of those are byte-identical.
- **Dates are written in UTC** (`+00'00'`): same instant, different offset
  string; `{date}` follows a pinned `creationDate`.
- `setDeflateImpl` now rejects a raw-DEFLATE function (pdfnative #78); pass
  zlib output, or use the new `setDeflateRawImpl`.

No API was removed or narrowed — `tests/api-surface.test.ts`, the JSON Schema
and manifest superset tests and a compile of the frozen 1.2.0 samples against
the 1.3.0 source prove it on every push. New: the `typography`, `pdfx`,
`outputIntent` and `creationDate` document props (and DocSpec fields),
`align="justify"`, `keepWithNext` / `splittable`, CMYK colours everywhere,
`print.marks.colourBars`, twelve lint rules (37 total), six engine helpers and
eleven types re-exported, `ParagraphAlign`, and a `Color` type that admits the
four-element tuple.

## Upgrading to 1.2

Everything in 1.2.0 was additive. One install-time floor moved:

```bash
# verify-docs:allow engine-version-token
npm install pdfnative-react@^1.2.0 pdfnative@^1.7.0 react@^19
```

- **`pdfnative` ≥ 1.7** became required. The four new chart kinds,
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
seven lint rules (25 at the time), `cacheControl`/`etag` on `renderToResponse`,
and `ErrorOptions`/`cause` on the error taxonomy.

## Upgrading to 1.1

Everything in 1.1.0 was additive. Two install-time floors moved:

```bash
# verify-docs:allow engine-version-token
npm install pdfnative-react@^1.1.0 pdfnative@^1.6.0 react@^19
```

- **`pdfnative` ≥ 1.6** became required. `<Chart>` compiles to a block type that
  does not exist before 1.6.0, so an older engine would silently mis-render it.
- **Node ≥ 22** — inherited, not invented: the 1.6.0 engine requires it, so a
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
fonts and 27 scripts, print production, CMYK and PDF/X-4, reproducible output,
layout/PDF-A, the client hooks/components, and the compact agent spec. Every
sample is rendered into a byte baseline that CI holds on three operating
systems.

## Engineering

One quality gate (`npm run gate`) is the definition of green: type-check of
the sources, tests, samples, scripts and the frozen 1.2.0 samples; lint;
build; the built artefacts probed, bundled for a browser and packed through
publint and `@arethetypeswrong/cli`; 38 samples rendered and held to a byte
baseline; coverage; verified documentation; a PDF/A and PDF/X conformance
corpus validated in-process and by veraPDF. CI runs it on Linux (Node 22 and
24), Windows and macOS; releases go through npm Trusted Publishing with a
build-provenance attestation and a CycloneDX SBOM. Details in
[CONTRIBUTING.md](CONTRIBUTING.md).

## The pdfnative ecosystem

| Package | Use it for |
|---|---|
| [`pdfnative`](https://www.npmjs.com/package/pdfnative) | The zero-dependency PDF engine — Node, browsers, Workers, Deno, Bun. |
| **`pdfnative-react`** | Declarative React/JSX components with live preview (this package). |
| [`pdfnative-cli`](https://www.npmjs.com/package/pdfnative-cli) | Render, sign, inspect, and verify PDFs from the shell. |
| [`pdfnative-mcp`](https://www.npmjs.com/package/pdfnative-mcp) | Generate PDFs from Claude Desktop, Cursor, Continue, Zed. |

## Documentation

**Guides**

- [Typography](docs/TYPOGRAPHY.md) — the twelve keys, block-level controls,
  presets, limits.
- [Print](docs/PRINT.md) — CMYK, colour bars, output intents, PDF/X-4 and how
  to check it.
- [Reproducible output](docs/REPRODUCIBLE.md) — pinning the creation date, what
  is covered, how the repository proves it.
- [Charts](docs/CHARTS.md) — the nine chart types, dual axes, log/time scales,
  accessibility, PDF/A.
- [Server rendering](docs/SERVER.md) — `renderToResponse` on Next.js, Remix,
  Hono, Deno, Bun, Workers and Express.
- [Linting](docs/LINTING.md) — the 37 lint rules, the diagnostics channel, and
  how to gate on them.
- [Recipes](docs/RECIPES.md) — merging, form filling, text extraction,
  decryption, PDF/X validation: calling the engine on the bytes this library produces.
- [Agent contract](docs/AGENT_CONTRACT.md) — driving the package autonomously.

**Reference**

- [Knowledge Base](docs/KNOWLEDGE_BASE.md) — architecture, the compile pipeline,
  the react-reconciler version contract, testing and reproducibility.
- [AGENTS.md](AGENTS.md) — guidance for AI agents working in this repo.
- [AI Governance](docs/AI_GOVERNANCE.md) — the human-in-the-loop draftsman
  contract for AI agents proposing issues/PRs (`npm run verify:issue`).
- [CHANGELOG.md](CHANGELOG.md) · [ROADMAP.md](ROADMAP.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 Nizoka — [Plika](https://plika.app)
