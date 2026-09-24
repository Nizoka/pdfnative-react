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

<!-- verify-docs:allow version-token -->
### 1.1.0 — Charts, server rendering, autonomous agents

<!-- verify-docs:allow version-token -->
Tracks the engine's 1.6.0 release and closes the two adoption gaps that mattered
most: there was no first-class way to serve a PDF from a modern React server,
and no way for an AI agent to discover or check its own work.

- `<Chart>` — native vector charts (bar, barH, line, pie, donut), the one
  authoring capability pdfnative 1.6.0 adds, with full `DocSpec` parity. <!-- verify-docs:allow version-token -->
- `renderToResponse` / `renderSpecToResponse` — web-standard `Response`,
  streaming by default. Next.js App Router, Remix, Hono, Deno, Bun, Workers.
- Document-level layout sugar: `watermark`, `header`, `footer`, `attachments`,
  `tagged` — previously an undocumented `layout` pass-through.
- `lintDocument` / `lintSpec` — accessibility and layout rules with stable
  codes, eight of which pre-empt engine-level render failures.
- The agent surface: `ErrorCode` taxonomy, `capabilityManifest()`, `doctor()`,
  `validateSpec()`, multi-subject `schema()`, and the governance contract
  exported as runtime capability.
- Peer floor `^1.6.0`; Node floor `>=22` (inherited from the engine).

<!-- verify-docs:allow version-token -->
### 1.2.0 — Charts v2, print production, conformance channel

<!-- verify-docs:allow version-token -->
Tracks the engine's 1.7.0 release and closes the one capability this package
had explicitly promised (`docs/CHARTS.md`: "when they land there, they reach
this package as new `ChartProps` fields"):

- Charts v2 — `stackedBar`, `stackedBarH`, `area`, `scatter`; log and time
  scales; a secondary right axis; per-point data labels; x-label stride and
  rotation. Full `DocSpec` and schema parity.
- Print production — `<Document print>` (bleed/trim/art/crop boxes, printer's
  marks, `userUnit`), `metadata.trapped`, print-dialog viewer preferences,
  `layout.outputIntent`.
- The PDF/A conformance diagnostics channel (`layout.strict` /
  `layout.onDiagnostic`).
- Lint 18 → 25 rules (13 pre-empt engine throws), `L_PRINT_BOXES` delegating
  to the engine's own validator.
- Quality backlog from the 1.1.0 review: `renderToResponse`
  `cacheControl`/`etag`, `ErrorOptions`/`cause` on the error taxonomy,
  `eslint-plugin-react-hooks`, `validateSpec` fuzzing, the PDF/UA round-trip
  test.
- Peer floor `^1.7.0`. <!-- verify-docs:allow engine-version-token -->

### 1.3.0 — Typography, CMYK & PDF/X-4, reproducible output, the hardened repository

Tracks the engine's 1.8.0 release and brings the repository to the engineering
standard of pdfnative 1.8.0, pdfnative-cli 1.5.0 and pdfnative-mcp 1.7.0:

- Typography — `<Document typography>` / `DocSpec.typography` (twelve keys,
  all opt-in), `align="justify"`, block-level `keepWithNext` / `splittable`;
  the compile-time lock `TypographyPropsCoverTypographyOptions`.
- CMYK colours on every colour position; `print.marks.colourBars`; CMYK and
  Gray output intents; `outputIntent` as a document prop.
- PDF/X-4 — `<Document pdfx="pdfx4">` with six coherence lint rules whose
  messages are the engine's; `validatePdfX` deliberately used through the
  engine (RECIPES) and in-process by the repository's PDF/X gate.
- Reproducible bytes — `creationDate` on `<Document>` / `DocSpec`,
  `setDefaultCreationDate` re-exported, UTC dates, `{date}` follows the pin;
  proven on Linux, Windows and macOS, and by a two-time-zone test.
- 27 Unicode scripts (was 22) through `resolveFonts`; six engine helpers and
  eleven types re-exported.
- Lint 25 → 37 rules (20 pre-empt engine throws); engine input errors
  classified as `E_INPUT`.
- One gate, a byte-exact sample baseline, PDF/X-4 and veraPDF gates, nine
  hardened workflows with five required checks on three operating systems,
  verified docs (`docs/assets/ecosystem.json` + `verify:docs`), the Claude Code
  layer, `release-prepare`, the engine-surface matrix, the zero-breaking-change
  proofs (API, schema and manifest supersets; the frozen v1.2.0 samples
  compiled against the current source), publint and `@arethetypeswrong/cli`
  in the gate.
- Inherited fixes: pdfnative #74 AcroForm fields under PDF/A, #75 page count
  with a table of contents, #78 `setDeflateImpl` validation.
- Peer floor `^1.8.0`.

## Later

- **React Native renderer** (separate entry point).
- **Incremental compilation** for very large documents (reuse the reconciled
  tree across renders when only data changed).
- **A visual regression tier** through an *external* rasteriser (`pdftoppm` /
  `mutool`) with PNG baselines, opt-in and skip-when-absent — the package
  bundles no rasteriser (golden rule 1), so the tier can only be advisory.
- **PDF/X-1a, PDF/X-3, PDF/X-4p and PDF/A-4** when the engine adds them;
  today `PDF_X_CONFORMANCE_TARGETS` holds `'pdfx4'` alone
  (`tests/regression/engine-surface.json`, upstream limit `pdfx-single-target`).
- **A hyphenation provider sample** — no dictionary will ever ship; a sample
  installing a Liang-pattern library through `setHyphenationProvider` would
  show the seam (upstream limit `no-bundled-hyphenation`).
- **The engine-surface matrix kept per release** — one section per engine bump.
- **`harden-runner` block mode** once the audited egress of every workflow is
  known.

### Considered and dropped

- **`<Outline>` / `<Bookmark>` authoring sugar.** <!-- verify-docs:allow registry-parity --> `outline="auto"` already
  covers the common case, and an explicit `OutlineItem[]` covers the rest.
  Adding components would grow the public surface — permanently — for a
  marginal ergonomic gain.
- **Dev-mode automatic lint warnings.** `lintDocument` is deliberately pure: it
  never writes to the console. Emitting warnings implicitly would make render
  behaviour depend on `NODE_ENV` and put unrequested output in users' logs.
  Call it explicitly, in a test or a CI gate — see `samples/quality/lint.tsx`.
- **A `pdfnative-react` MCP server.** pdfnative-mcp 1.7.0 exposes 28 tools over
  the same engine, including the full document model; a second server would
  duplicate it for a JSX-shaped input agents do not produce (they emit JSON —
  which is what `DocSpec` already is). The right shape, if ever wanted, is a
  `docspec` tool inside pdfnative-mcp that validates against
  `schema('doc-spec')` and renders through this package — a request to that
  repository, not a server here.
- **Re-exporting `validatePdfX`.** Golden rule 7; one import line from the
  engine, shown in `docs/RECIPES.md`, and the repository's own PDF/X gate uses
  it that way.
- **A `<Typography>` wrapper component.** <!-- verify-docs:allow registry-parity --> Typography is a document-level
  layout option (page furniture), not a block; it is a `<Document>` prop like
  `print`.
- **A CMYK colour helper.** The engine's `parseColor` / `resolveColor` already
  do it and are one import away; a wrapper would restate their validation.
- **Reading `SOURCE_DATE_EPOCH` in the library.** A library must not read the
  process environment on behalf of its host; the pin is an explicit prop or
  `setDefaultCreationDate`. The repository scripts honour the variable; the
  package never will.

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
