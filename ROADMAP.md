# Roadmap — pdfnative-react

This roadmap is indicative, not a commitment. Priorities follow the needs of the
[pdfnative](https://www.npmjs.com/package/pdfnative) ecosystem.

## Shipped

### 0.2.0 — First implementation

- Declarative component model, custom React reconciler, four render entry
  points, client hooks/components, and the compact `DocSpec` agent layer with a
  versioned JSON Schema.

### 1.0.0 — Stable API

Marks the public API as stable and integrates the `pdfnative` engine's
authoring features through 1.5.0, plus the conveniences originally planned for
0.4.0:

- `<Section>` helper (a heading paired with grouped content).
- Convenience `resolveFonts` / `options.fonts` (register + load in one step).
- Image source helpers `fromUrl` / `fromBase64`.
- Bookmarks/outline & page labels on `<Document>`; viewer preferences and a
  layout debug overlay via `layout`; `inspectDocument` / `inspectSpec`.
- Nested lists; table `cellBorders` / `cellVAlign`; SVG `<text>` as native text.
- `renderToFileStream` (constant-memory file output).
- `pdfnative` moved to a peer dependency (`^1.5.0`).

## Later

- React Server Components streaming helpers.
- React Native renderer (separate entry point).
- Layout linting / accessibility checks surfaced as dev warnings.
- Possible `<Outline>` / `<Bookmark>` authoring sugar over the `outline` prop.

## Non-goals

- **React 18 support.** The reconciler is bound to a single, deliberately pinned
  `react-reconciler` version contract for React 19; supporting 18 and 19
  simultaneously is out of scope.
- **A CSS/flexbox box model (`<View>`).** pdfnative is a declarative block flow
  by design; we will not emulate HTML/CSS layout.
- **Byte-level post-processing.** Merging/splitting, annotations, digital
  signatures, crypto providers, and font compilation are the engine's job — use
  [`pdfnative`](https://www.npmjs.com/package/pdfnative) directly on the bytes
  this library produces.
