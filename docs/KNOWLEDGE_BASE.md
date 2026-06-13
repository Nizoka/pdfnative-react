# Knowledge Base — pdfnative-react

This document explains how pdfnative-react is built and why. It is the reference
for contributors and for AI agents working in this repository.

## 1. What this package is

pdfnative-react is a **custom React renderer** for the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) PDF engine. You compose a
document with JSX components; a React reconciler compiles that tree into a
`pdfnative` `DocumentParams` object; the engine renders it to PDF bytes.

It is **not** a CSS/flexbox layout engine. pdfnative models a document as an
ordered *flow of blocks*, and pdfnative-react exposes those blocks 1:1.

## 2. The compile pipeline

```
 JSX tree
   │  React.createElement (via component factories in components.tsx)
   ▼
 Host tree of ElementNode / TextNode      (reconciler/nodes.ts)
   │  react-reconciler (mutation mode)     (reconciler/host-config.ts)
   ▼
 RootContainer { children: HostNode[] }
   │  serialize()                          (reconciler/serialize.ts)
   ▼
 DocumentParams { title, blocks, … }       (pdfnative model)
   │  buildDocumentPDFBytes / …Stream      (core-bridge/index.ts → pdfnative)
   ▼
 Uint8Array  (a valid PDF: %PDF-… …%%EOF)
```

Key properties:

- **Synchronous & DOM-free.** `compile()` reconciles into an in-memory tree and
  serializes immediately. There is no DOM, no async scheduling, no Suspense.
- **Single source of truth.** Every pdfnative import funnels through
  `src/core-bridge/index.ts`, keeping the engine surface small and auditable.

## 3. Module map

| Module | Responsibility |
|---|---|
| `src/components.tsx` | Public component factories; each emits a lowercase host tag. |
| `src/reconciler/nodes.ts` | Host tree node types (`ElementNode`, `TextNode`, `RootContainer`). |
| `src/reconciler/host-config.ts` | The react-reconciler `HostConfig` (mutation mode). |
| `src/reconciler/serialize.ts` | Pure transform: host tree → `DocumentParams`. |
| `src/reconciler/render.ts` | `compile(node)` — drives the reconciler and serializes. |
| `src/render.ts` | `renderToBytes/Blob/Stream/File`, `compileDocument`. |
| `src/hooks.ts` | `usePdf`, `usePdfStream` (client). |
| `src/viewer.tsx` | `PDFViewer`, `PDFDownloadLink`, `BlobProvider` (client). |
| `src/core-bridge/index.ts` | The only place that imports from `pdfnative`. |
| `src/types.ts` | Public types + re-exports of the pdfnative model. |
| `src/index.ts` | Public barrel. |

## 4. react-reconciler version contract

This is the single most fragile dependency relationship. Three versions must
move together:

| React | `react-reconciler` runtime | `@types/react-reconciler` |
|---|---|---|
| 19 | `^0.31` | `^0.32` |

Notes learned the hard way:

- The **types and runtime are skewed by one minor**: `@types@0.32` describes the
  `0.31` runtime. Do not assume the type version equals the runtime version.
- The `0.32` `HostConfig` has **14 generic parameters** (the last is
  `TransitionStatus`) and requires the transition/priority and
  suspense-on-commit members (`setCurrentUpdatePriority`, `maySuspendCommit`,
  `waitForCommitToBeReady`, …). `prepareUpdate` was removed; `commitUpdate` is
  `(instance, type, prevProps, nextProps, handle)`.
- `getRootHostContext` / `getChildHostContext` **must return a non-null value.**
  React uses `null` as its internal "no context" sentinel and will throw
  *"Expected host context to exist"* (then spin into an OOM) if you return
  `null`. We return a frozen empty object.
- `createContainer` takes **11 positional args** in `0.32` (it added
  `onDefaultTransitionIndicator` before `transitionCallbacks`).
- The synchronous flush API was renamed: the `0.31` runtime exposes
  `updateContainerSync` + `flushSyncWork`, not `flushSync`. `render.ts` prefers
  the new pair and falls back to `flushSync(fn)` for older runtimes.

## 5. Serialization rules (`serialize.ts`)

- Text for a block comes from its `text` prop, otherwise from the concatenated
  text of its children.
- `<List ordered>` → `style: 'numbered'`; otherwise `'bullet'`.
- `<Table>` headers come from the `headers` prop or the first `<Row header>`;
  data rows come from the `rows` prop or `<Row>`/`<Cell>` children.
- `<Page>` siblings are joined with an inserted `pageBreak` block.
- The root must be `<Document>`; otherwise a `PdfStructureError` is thrown.
- `undefined` props are stripped so emitted JSON is deterministic.

## 6. Testing

- `tests/compile.test.tsx` — asserts the `DocumentParams` shape for every block.
- `tests/render.test.tsx` — asserts real PDF output (`%PDF-` … `%%EOF`) for
  bytes, blob, and stream.
- `tests/hooks.test.tsx` — exercises `usePdf`/`usePdfStream` under jsdom.
- `tests/spec.test.tsx` — asserts `compileSpec` parity with the equivalent JSX,
  real `renderSpec*` PDF output, and the JSON Schema `$id`/version.
- `tests/version.test.ts` — pins `version` to `package.json` (reads it via
  `process.cwd()`; `import.meta.url` file URLs break under jsdom).
- jsdom lacks `URL.createObjectURL`; `tests/setup.ts` stubs it.

## 7. Agent authoring contract (`src/spec/`)

pdfnative-react is a *library*, so the token cost LLM agents pay is **authoring**
a document, not invoking a CLI. The `src/spec/` layer gives agents a compact,
JSON-serializable grammar — `DocSpec` — that compiles to the **same**
`DocumentParams` as the equivalent JSX.

```
 DocSpec (tuples)            spec/types.ts   — the grammar
   │  specToElement()        spec/compile.ts — projects tuples onto components
   ▼
 <Document> element  ──────► the normal compile pipeline (§2)
```

Design rules:

- **Parity by construction.** `compile.ts` builds the JSX tree from the existing
  components via `createElement`, so a spec and its JSX twin can never drift.
  Tests assert `compileSpec(spec)` `toEqual` the JSX `compileDocument`.
- **Block tuples** are `[kind, …payload, opts?]`; per-block opts reuse the
  component prop types (via `Pick`/`Omit`) so the spec inherits the components'
  type safety. `TableRowSpec` accepts either a `string[]` (widened to
  `{ cells, type:'default', pointed:false }`) or a full `PdfRow`.
- **Versioned schema.** `docSpecSchema()` returns a Draft 2020-12 JSON Schema
  whose `$id` is `https://pdfnative.dev/schema/react/<version>/doc-spec.schema.json`
  (`version` comes from `src/version.ts`, the single source of truth that
  `tests/version.test.ts` pins to `package.json`). Agents can self-validate a
  spec before rendering.
- **Isomorphic, no `'use client'`.** The spec module is pure/render-agnostic;
  `renderSpec*` reuse the existing isomorphic `render*` entry points.
- **GOTCHA.** `createElement` for default-param components (`Spacer`,
  `TableOfContents`) needs an explicit generic (`createElement<SpacerProps>`),
  otherwise TS infers `Attributes` and rejects the extra props (TS2769).

## 8. Design boundaries

- **No `<View>`/flexbox.** Honest mapping to the engine's block flow.
- **React 19 only** for now. React 18 support is a roadmap item (the reconciler
  peer/type matrix makes dual-support costly to do correctly).
- **Browser & Node.** `renderToFile` is Node-only (dynamic `node:fs/promises`).
