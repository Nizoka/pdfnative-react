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

### 1.1.0 — Charts, server rendering, autonomous agents

Tracks the engine's 1.6.0 release and closes the two adoption gaps that mattered
most: there was no first-class way to serve a PDF from a modern React server,
and no way for an AI agent to discover or check its own work.

- `<Chart>` — native vector charts (bar, barH, line, pie, donut), the one
  authoring capability pdfnative 1.6.0 adds, with full `DocSpec` parity.
- `renderToResponse` / `renderSpecToResponse` — web-standard `Response`,
  streaming by default. Next.js App Router, Remix, Hono, Deno, Bun, Workers.
- Document-level layout sugar: `watermark`, `header`, `footer`, `attachments`,
  `tagged` — previously an undocumented `layout` pass-through.
- `lintDocument` / `lintSpec` — accessibility and layout rules with stable
  codes, five of which pre-empt engine-level render failures.
- The agent surface: `ErrorCode` taxonomy, `capabilityManifest()`, `doctor()`,
  `validateSpec()`, multi-subject `schema()`, and the governance contract
  exported as runtime capability.
- Peer floor `^1.6.0`; Node floor `>=22` (inherited from the engine).

## Later

- React Native renderer (separate entry point).
- A `pdfnative-react` MCP server, so agents can drive the package as a tool set
  over MCP rather than as a library import. The capability manifest and the
  versioned schemas added in 1.1.0 are the groundwork for this.
- Incremental compilation for very large documents (reuse the reconciled tree
  across renders when only data changed).

### Considered and dropped

- **`<Outline>` / `<Bookmark>` authoring sugar.** `outline="auto"` already
  covers the common case, and an explicit `OutlineItem[]` covers the rest.
  Adding components would grow the public surface — permanently — for a
  marginal ergonomic gain.
- **Dev-mode automatic lint warnings.** `lintDocument` is deliberately pure: it
  never writes to the console. Emitting warnings implicitly would make render
  behaviour depend on `NODE_ENV` and put unrequested output in users' logs.
  Call it explicitly, in a test or a CI gate — see `samples/quality/lint.tsx`.

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
