# Changelog

All notable changes to **pdfnative-react** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] — Charts v2, print production, and the conformance channel

Tracks the `pdfnative` engine's 1.7.0 release and delivers the "Charts v2"
capability that `docs/CHARTS.md` promised since 1.1.0 — stacked bars, area and
scatter charts, log and time scales, a secondary axis and per-point data
labels — plus print-production page geometry, the PDF/A conformance
diagnostics channel, and the quality backlog deferred from the 1.1.0 review.

No public API was removed or changed in a backward-incompatible way. One
*install-time* floor was raised — see **Compatibility** first.

### Compatibility

- **Peer floor raised: `pdfnative` `^1.6.0` → `^1.7.0`.** The new chart kinds,
  `layout.print` and the diagnostics channel do not exist before 1.7.0, so an
  older engine would throw mid-render on the new authoring surface. `doctor()`
  now distinguishes a 1.6.x engine (a dedicated error message) from a missing
  or older one, via a second capability probe (`validatePrintOptions`,
  first shipped in 1.7.0).
- Rendering behaviour inherited from engine 1.7.0, without any code change
  here: RTL digit runs keep logical order and paired delimiters mirror
  (UAX #9), Arabic/Persian letterforms join correctly, colour-emoji flag and
  ZWJ sequences resolve, form documents gain a complete `/ToUnicode` map
  (their bytes change; text becomes searchable), and crowded chart x-labels
  are strided automatically (`labelStride: 1` restores the old
  draw-everything behaviour).

### Added

#### Charts v2 (`<Chart>` / `['chart', body]`)

- Four new `chartType` values: `'stackedBar'`, `'stackedBarH'`, `'area'` and
  `'scatter'` (nine total).
- `axis.scale: 'linear' | 'log'`, and a secondary right axis via `axis2` +
  `ChartSeries.yAxis: 'left' | 'right'`.
- `xAxis` — `'category'`, `'linear'` or `'time'` (ISO-8601 / epoch ms,
  UTC-deterministic ticks), with `ChartSeries.xValues` carrying per-point
  positions.
- Per-point `dataLabels` (`true` or `{ decimals, prefix, suffix }`), and
  x-label collision control: `labelStride`, `labelRotation`.
- The `ChartPropsCoversChartBlock` compile-time lock did its job: the peer
  bump was a build error until every new `ChartBlock` field reached
  `ChartProps`, `DocSpec` and the schema.

#### Print production

- `<Document print={…}>` / `DocSpec.print` — bleed/trim/art/crop page boxes
  (or the one-line `bleed` shorthand), vector printer's marks, and
  large-format `userUnit`. Sugar over `layout.print`; an explicit `layout`
  wins, like every other sugar prop.
- `metadata.trapped` (`'True' | 'False' | 'Unknown'`) flows through the
  existing `metadata` prop.
- Print-dialog viewer preferences via `layout.viewerPreferences`: `duplex`,
  `pickTrayByPDFSize`, `printPageRange` (1-based pairs), `numCopies`.
- `layout.outputIntent` — a caller-supplied RGB ICC profile for tagged
  output (engine passthrough; see the new lint rule below for the one
  silent trap).

#### PDF/A conformance diagnostics

- `layout.strict` escalates the engine's conformance diagnostics
  (`PDFA_NO_FONT_ENTRIES`, `PDFA_UNEMBEDDED_FORM_FONT`,
  `PDFA_DEVICE_CMYK_IMAGE`) to thrown errors; `layout.onDiagnostic` receives
  them programmatically. Both are engine options reachable through every
  existing `layout` door — `onDiagnostic` is function-valued and therefore
  JSON-unrepresentable; `strict: true` is the JSON-safe switch.
- New types exported: `PrintOptions`, `PrinterMarksOptions`, `PageBox`,
  `CustomOutputIntent`, `PdfDiagnostic`, `PdfDiagnosticCode`,
  `PdfDiagnosticHandler`.

#### Linting (18 → 25 rules; 13 now pre-empt engine throws)

- `L_CHART_LOG_SCALE`, `L_CHART_X_AXIS`, `L_CHART_LABELS` — every Charts v2
  constraint the engine enforces mid-render, reported before it.
- `L_PRINT_BOXES` — print geometry, validated by delegating to the engine's
  own `validatePrintOptions`, so the finding carries the engine's message
  verbatim and can never drift from it.
- `L_VIEWER_PRINT_RANGE` — malformed `printPageRange` pairs / `numCopies`.
- `L_OUTPUT_INTENT_IGNORED` (warning) — `outputIntent` without `tagged` is a
  silent engine no-op.
- `L_TAGGED_FORM_FONTS` (warning) — a PDF/A target with form fields will
  surface the engine's `PDFA_UNEMBEDDED_FORM_FONT` diagnostic.
- `L_CHART_CATEGORIES` now skips positional-axis charts, mirroring engine
  1.7.0 exactly.

#### Server rendering

- `renderToResponse` / `renderSpecToResponse` options: `cacheControl` sets
  the `Cache-Control` header; `etag` sends a validator (a string verbatim, or
  `true` to derive a strong validator from the rendered bytes — which implies
  buffering). Defaults unchanged: no caching headers unless you opt in.

#### PDF/A conformance gate (veraPDF)

- `npm run validate:pdfa` renders a 10-file PDF/A corpus through the **built**
  package — both authoring doors (JSX and `DocSpec`), all four conformance
  targets (1b/2b/2u/3b), and this release's chart/print features — and
  validates every file with the pinned
  [veraPDF](https://verapdf.org) reference validator (greenfield 1.30.2,
  installer SHA-256-verified in CI). Two **negative canaries** the validator
  must reject guard against a validator that accepts everything; `XPASS` is
  fatal. Blocking in CI (`.github/workflows/verapdf.yml`) and in the
  pre-publish gate; without veraPDF the local runner skips with exit 0 — a
  skip, not a pass (`VERAPDF_REQUIRED=1` fails closed).
- Same runner design as `pdfnative-cli`/`pdfnative-mcp`: manifest-driven
  discovery, strict single-`<validationReport>` parsing, `.bat` launcher
  spawned through a shell with every argument quoted (CVE-2024-27980), raw
  XML reports uploaded as CI artifacts.

#### Visual verification for vision agents (dry-run tier 5)

- The agent contract gains a post-render tier: `extractText` (text truth),
  `validatePdfUA`/veraPDF (conformance truth), and — for vision-capable
  agents — **rasterize and look**: render, rasterize with a standard external
  tool (`pdftoppm`/`mutool`; nothing is bundled, no new dependency), read the
  PNG, judge against intent. Documented in `docs/AGENT_CONTRACT.md`,
  `docs/RECIPES.md` (which also fixes `docs/LINTING.md`'s dangling veraPDF
  cross-reference) and `llms.txt`; runnable with graceful degradation in
  `samples/agent/visual-verify.tsx`.

#### Environment helpers

- `setDeflateImpl` is re-exported alongside `initNodeCompression`, closing an
  asymmetry: `layout.compress` in a browser or worker silently produced
  *larger* output (stored-block fallback) with no documented way to inject a
  real DEFLATE implementation.
- `PdfColors` is re-exported type-only, so a `layout.colors` palette can be
  typed without importing the peer directly.

#### Errors

- `PdfReactError` and `PdfStructureError` accept the standard ES2022
  `ErrorOptions`, so a wrapped failure keeps its original error reachable via
  `error.cause`. The JSON envelope is unchanged (the cause may hold
  non-serializable state, so it deliberately stays out).

### Changed

- `doctor()` requires engine ≥ 1.7.0 and reports a 1.6.x engine with an
  actionable upgrade message instead of a generic failure.
- `capabilityManifest().contract.engine` is `'^1.7.0'`.

### Fixed

- **`resolveFonts` produced malformed PDFs.** It emitted `fontRef` without
  the leading slash (`latin` instead of `/latin`), and the engine writes
  `fontRef` verbatim into content streams as a PDF *name* — so every document
  rendered through the documented font path (`resolveFonts`, or the
  `options.fonts` map consumed by `renderToFile`/`renderToFileStream`/
  `renderToResponse`/`usePdf`/`usePdfStream`) contained `BT latin 10 Tf`
  where ISO 32000 requires `BT /latin 10 Tf`, malformed for conforming
  readers. `resolveFonts` now normalizes the ref (`/`-prefixing bare
  language keys). Found by the new PDF/UA round-trip test — the engine's
  `validatePdfUA` was rejecting this package's own font-embedded output.
  Hand-built `fontEntries` with a correct `/`-prefixed `fontRef` were never
  affected. Re-render anything you produced through the font map or
  `resolveFonts`.
- **Unstreamable documents now fail before the response starts.** The engine's
  streaming path rejects `<TableOfContents>` and `{pages}` header/footer
  templates (the final page count is unknown when page 1 is emitted), but ran
  that check *inside* the generator — so `renderToResponse`, which streams by
  default, surfaced the failure mid-response, after the status and headers
  were sent. `renderToStream` now runs the engine's
  `validateDocumentStreamable` eagerly, so every streaming entry point throws
  a catchable error at call time instead. Documented in `docs/SERVER.md`.
- `samples/layout/page-setup.tsx` claimed PDF/A-2b without embedding fonts —
  a genuinely non-conformant output, invisible to `L_TAGGED_NO_FONTS` because
  the claim rides on `RenderOptions.layout` rather than the `tagged` prop. It
  now embeds Noto Sans and documents the lint blind spot; the veraPDF corpus
  is what proves such files conformant for real.
- `ROADMAP.md` claimed five lint rules pre-empt engine failures where every
  other document said eight — the count the 1.1.0 drift sweep missed.
- **CI (already on `main`, first released here):** the publish workflow
  restores npm Trusted Publishing by installing an OIDC-capable npm before
  publishing — Node 22 bundles npm 10.9.x, which cannot do the OIDC exchange
  and made the v1.1.0 publish fail with an anonymous `E404`.

### Documentation

- npm discovery metadata refreshed for the 1.2.0 surface: the package
  description now names the chart engine, print production, the veraPDF gate
  and the agent surface, and `keywords` grew 42 → 68 — the print/charts/PDF-A
  clusters the ecosystem siblings already use, plus agent-discovery terms
  (`llm`, `agent-tools`, `docspec`, `capability-manifest`, `verapdf`,
  `react-pdf-alternative`). Every keyword maps to a documented capability.
- Every guide, `llms.txt`, the JSON schemas and the capability manifest now
  describe the 1.2.0 surface; `docs/CHARTS.md` closes its "Charts v2 is on
  the engine roadmap" promise with the shipped API.
- New samples: `samples/charts/charts-v2.tsx`,
  `samples/layout/print-production.tsx`, `samples/quality/diagnostics.tsx`.
- New tests: deterministic structural fuzzing of `validateSpec`, and the
  PDF/UA round-trip (render tagged output, validate it with the engine's
  `validatePdfUA`) deferred from the 1.1.0 review.

## [1.1.0] — Charts, server rendering, and an autonomous agent surface

Tracks the `pdfnative` engine's 1.6.0 release, opens three adoption paths
(server-side rendering, document-level layout sugar, linting), and completes the
agent-automation contract so an AI agent can drive the package without a human
in the loop.

No public API was removed or changed in a backward-incompatible way. Two
*install-time* floors were raised — see **Changed** first.

### Security

Both of these are engine fixes that arrive with the `^1.6.0` peer floor. They
are listed here because they affect documents **this package authored**.

- **Encrypted documents no longer leak their outline, link URIs or metadata.**
  Before engine 1.6.0, only *streams* were encrypted — strings were not. Since
  `<Document outline="auto">` derives bookmark titles from every `<Heading>`, a
  password-protected document produced by pdfnative-react disclosed its section
  headings, its `<Link url>` targets and its `metadata` to anyone opening the
  file without the password. Re-render anything you shipped with
  `layout.encryption`.
- **AES-256 output is now spec-compliant.** The engine's R6 hash substituted
  SHA-256 for every round instead of the SHA-256/384/512 rotation ISO 32000-2
  Algorithm 2.B requires, so `algorithm: 'aes256'` files written on engine
  ≤ 1.5.0 were not readable by strictly compliant readers. Output changes
  bit-for-bit; the engine's decryptor keeps a legacy fallback so old files still
  open.

### Changed

- **`pdfnative` peer floor is now `^1.6.0`** (was `^1.5.0`). `<Chart>` compiles
  to a block type that does not exist before 1.6.0; a 1.5 engine would receive
  an unknown block and silently drop or mis-render it. A loud install-time
  requirement is better than a quiet wrong PDF.
- **Node floor is now `>=22`** (was `>=20`). This is *inherited*, not invented:
  `pdfnative@1.6.0` itself requires Node ≥ 22, so any compliant install is
  already there. CI now runs on Node 22 and 24.
- `llms.txt` is now included in the published tarball (`package.json#files`), so
  an agent working from an installed package — with no repository checkout — can
  read the capability summary.

### Added

#### Charts (engine 1.6.0)

- **`<Chart>`** — native vector charts rendered as pure PDF path operators: no
  rasterisation, no chart library, no new runtime dependency. Five types
  (`bar`, `barH`, `line`, `pie`, `donut`), multi-series, legends, "nice" axis
  ticks, gridlines, point markers, palette overrides, negative values, and a
  tagged-PDF `/Figure` + `/Alt` entry.
- **`['chart', body]`** — the matching `DocSpec` tuple, a schema branch, and the
  `ChartBlock` / `ChartSeries` / `ChartType` type re-exports.

#### Server rendering

- **`renderToResponse(node, options?)`** and **`renderSpecToResponse(spec, options?)`**
  return a web-standard `Response`. Streams page by page from the engine's
  generator, so peak memory stays flat and the client receives bytes
  immediately; `buffered: true` switches to a single buffer and adds
  `Content-Length`. Handles `Content-Disposition` including RFC 6266
  `filename*` for non-ASCII names. Runs unchanged on Node, the Edge runtime,
  Deno, Bun and Cloudflare Workers.

#### Packaging — a client subpath, and two fixes that make the runtime claims true

- **New `pdfnative-react/client` export.** `usePdf`, `usePdfStream`,
  `PDFViewer`, `PDFDownloadLink` and `BlobProvider`, shipped with the
  `'use client'` directive already applied. In a React Server Components app,
  import them from there — no wrapper file of your own. The root barrel still
  exports them for apps with no RSC boundary, and is deliberately *not* marked
  as client code, because `renderToResponse` must stay server-safe.

  Note the boundary this does **not** move: importing this package from a
  Server Component or a `'use server'` file still fails, because the reconciler
  needs `createContext` and React's `react-server` condition does not provide
  it. Use a Route Handler. See [docs/SERVER.md](docs/SERVER.md).

- **The published bundle now keeps the `node:` prefix on its dynamic
  `node:fs/promises` import.** It was being rewritten to the bare specifier,
  which Deno and Cloudflare `nodejs_compat` refuse to resolve — so a wrangler or
  Vite-browser build of the very runtimes listed above failed to compile.
  `scripts/postbuild.mjs` now verifies the shipped artifacts and fails the build
  if it regresses; CI additionally bundles both artifacts the way a non-Node
  bundler would.

- **Importing pure data no longer drags in the React reconciler.**
  `import { version }` cost 10 137 bytes and forced `react-reconciler` to
  resolve; it is now 3 216 with no reconciler. Same for `validateSpec`,
  `schema()` and `capabilityManifest()`. The build fails if this regresses.

#### Document-level layout sugar

- New `<Document>` props — **`watermark`**, **`header`**, **`footer`**,
  **`attachments`**, **`tagged`** — surfacing `PdfLayoutOptions` fields that
  previously worked only as an opaque, undocumented `layout` pass-through.
  `watermark` accepts a plain string as shorthand for the common case. An
  explicit `layout` prop always wins. Mirrored on `DocSpec` and in the schema.
  A document that uses none of them still serializes with `layout: undefined`,
  so existing output is byte-identical.

#### Linting

- **`lintDocument(node, options?)`** / **`lintSpec(spec, options?)`** — eighteen
  deterministic accessibility and layout rules with stable `L_*` codes (10
  error, 7 warning, 1 info). Runs on the compiled document model, so JSX and
  `DocSpec` share one implementation. Pure: no console output, no throwing.
- **Eight** rules pre-empt an exception the engine raises mid-render: the five
  `L_CHART_*` errors (`EMPTY`, `SERIES`, `CATEGORIES`, `VALUES`, `POINTS`),
  `L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED` and `L_MAX_BLOCKS_EXCEEDED` —
  the last firing against the engine's default ceiling of 100 000 blocks even
  when you set none yourself. Two more catch output that renders successfully
  but is wrong: `L_EMPTY_DOCUMENT` (a blank page) and `L_TAGGED_NO_FONTS` (a
  PDF/A file veraPDF rejects).

#### Agent surface

- **`ErrorCode`** — a stable `E_*` taxonomy (`E_STRUCTURE`, `E_INPUT`,
  `E_UNSUPPORTED`, `E_ENV`, `E_POLICY`, `E_RUNTIME`) with a `PdfReactError`
  base class carrying `code`, a `toJSON()` producing the ecosystem's standard
  `{ ok: false, error: { code, message } }` envelope, and `toErrorEnvelope()`
  for arbitrary thrown values. `PdfStructureError` now extends `PdfReactError`
  and carries `E_STRUCTURE`; it remains importable from its original path and
  is the same class object, so `instanceof` is unaffected.
- **`capabilityManifest()`** — one call describing every component, `DocSpec`
  block, entry point, error code, lint rule and schema subject as plain JSON.
  Derived entirely from the internal registries, and a test asserts every name
  it advertises resolves to a real export.
- **`doctor()`** — environment pre-flight returning
  `{ ok, checks: [{ name, status, value, detail }] }`. Never throws — it reports
  rather than raises. The engine check is a *capability probe* rather than a
  version-string parse, so it survives bundling into a browser build and catches
  an engine that resolves but is older than 1.6.0. A peer that is absent
  *entirely* fails earlier, at module resolution, and never reaches `doctor()`.
- **`validateSpec(spec: unknown)`** — structural validation of an untrusted
  `DocSpec` with no JSON-Schema engine, returning path-anchored `V_*` findings
  (`blocks[3][1]`). Never throws, and bounds page nesting at 64 levels so a deep
  payload cannot exhaust the call stack. This is dry-run tier 1; `compileSpec`,
  `lintSpec` and `inspectSpec` are tiers 2–4.
- **`schema(subject?)`** / **`schemaId(subject?)`** — seven subjects
  (`doc-spec`, `render-options`, `lint-report`, `spec-validation`, `doctor`,
  `manifest`, `list`), each with a versioned `$id` so a caching consumer can
  detect contract drift. `docSpecSchema()` and `docSpecSchemaId()` are retained
  and delegate; a test pins the equivalence.
- **`aiGovernancePolicy()`**, **`agentRulesText()`**, **`validateIssueDraft(md)`**
  — the human-in-the-loop contract shipped as runtime capability, so an agent
  working from an installed package can read the rules it must follow. Still
  zero network, zero telemetry, zero autonomous GitHub writes.
- npm keywords extended for discovery (`ai-governance`, `hitl`, `llms-txt`,
  `rag`, `mcp`, `nextjs`, `rsc`, `accessibility`, `pdf-ua`, `charts`, …).

#### Internal — the anti-drift mechanism

- New `src/registry.ts` holds the block grammar, the component list and the
  lint rules as single-source tables. The JSON Schema, `validateSpec` and the
  capability manifest all *derive* from them rather than restating them, and
  compile-time `Assert<Equals<…>>` types make omission a build error: adding a
  member to `BlockSpec` or `HostTag` without registering it fails
  `npm run typecheck`.

### Documentation

- New guides: `docs/CHARTS.md`, `docs/SERVER.md`, `docs/LINTING.md`,
  `docs/AGENT_CONTRACT.md`, and **`docs/RECIPES.md`** — the counterpart to the
  authoring-only boundary, showing how to call the engine directly for
  `extractText`, `fillForm`/`flattenForm`, `openPdf({ password })`,
  merge/split and re-encryption on the bytes this library produces.
- `docs/KNOWLEDGE_BASE.md` gains an "Agent Automation Contract" chapter.
- 7 new samples — charts, layout sugar, a Next.js route handler, linting, and
  three agent samples (the full loop, the capability manifest, the error
  envelope). All type-checked in CI and executed end to end.

## [1.0.0] — Stable release

First stable release. The public API is now covered by semantic versioning.
This release integrates the authoring features added by the `pdfnative` engine
through 1.5.0 and ships the previously-planned 0.4.0 authoring conveniences.

### Breaking Changes

- **`pdfnative` is now a peer dependency** (`^1.5.0`) instead of a bundled
  dependency. Install it alongside the wrapper:
  `npm install pdfnative-react pdfnative react`. This lets your app control the
  engine version and matches how `pdfnative` is treated as external in the
  build. The engine floor is raised to **1.5.0**.

### Added

- **Bookmarks / outline & page labels** on `<Document>` (and `DocSpec`):
  `outline` accepts a nested `OutlineItem[]` tree or `'auto'` (derived from
  headings); `pageLabels` controls viewer page numbering. Both PDF/A-safe.
- **`<Section>`** — a composite helper pairing a heading with its grouped
  content (`title`, `level`, `color`, `break`).
- **Nested lists** — `<Item>` may nest a child `<List>`, directly nested
  `<Item>` children, or use the `items` data prop (`{ text, items }`). The
  `DocSpec` `ul`/`ol` grammar accepts the same nested items.
- **Table styling** — `cellBorders` (sides, color, width, dash style) and
  `cellVAlign`, plus per-column `ColumnDef.vAlign` and `kind: 'amount'`.
- **Layout inspection & debugging** — `inspectDocument(node)` /
  `inspectSpec(spec)` return page/block geometry without rendering, and
  `layout.debug` overlays margin/content/cell boxes.
- **Viewer preferences** — `layout.viewerPreferences` (page mode/layout,
  toolbar/menubar visibility, `displayDocTitle`, …).
- **`renderToFileStream`** / `renderSpecToFileStream` — constant-memory file
  output that preserves document-level features (outline, page labels).
- **Font convenience** — `resolveFonts(map)` registers loaders and returns
  `FontEntry[]`; the async entry points accept the loader map as `options.fonts`.
  Enables the bundled Noto Sans Math font (`'math'`) and other scripts ergonomically.
- **Image helpers** — `fromUrl(url)` and `fromBase64(payload)` produce the bytes
  `<Image>` expects.
- **`validateFontData(data)`** — opt-in, read-only structural check of a custom
  font module before embedding (`{ valid, errors, warnings }`); `FontValidationResult`
  type re-exported.
- **AI-governance / human-in-the-loop contract** (aligned with the `pdfnative`
  monorepo): `.github/ai-governance.json`, `.github/AGENT_RULES.md`,
  `.github/drafts/` staging area, [docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md),
  and a `npm run verify:issue` CLI (`scripts/verify-issue.mjs`) that validates a
  draft issue locally. AI agents act strictly as *draftsmen* — no autonomous
  GitHub writes. Covered by `tests/governance.test.ts`.
- **SVG `<text>`/`<tspan>`** now renders as native, selectable PDF text (flows
  through the existing `<Svg data>` — no API change).
- New type re-exports: `OutlineItem`, `PageLabelRange`, `PageLabelStyle`,
  `ViewerPreferences`, `LayoutDebugOptions`, `LayoutInspection`, `InspectedPage`,
  `InspectedBlock`, `CellBorders`, `ListItem`, `StreamToFileResult`, `FontsMap`,
  `FontLoader`, `FontData`, `FontValidationResult`.
- **11 new samples** covering every new feature, and matching test coverage.

### Changed

- Scope is stated explicitly: pdfnative-react covers document *authoring*.
  Byte-level post-processing (merge/split, annotations, signing, crypto
  providers, font compilation) is done with the `pdfnative` engine directly.

## [0.2.0] — First implemented release

### Added

- **Declarative component model** mapping 1:1 onto the `pdfnative` block flow:
  `Document`, `Page`, `Heading`, `Paragraph` (`Text` alias), `List`/`Item`,
  `Table`/`Row`/`Cell`, `Image`, `Link`, `Spacer`, `PageBreak`,
  `TableOfContents` (`Toc` alias), `Barcode`, `Svg`, and `FormField`.
- **Custom React reconciler** that compiles a JSX tree into a `pdfnative`
  `DocumentParams` object — no DOM, no headless browser, no native deps.
- **Render entry points**: `renderToBytes`, `renderToBlob`, `renderToStream`
  (true constant-memory streaming), `renderToFile` (Node), and `compileDocument`.
- **Client hooks**: `usePdf` (bytes / blob / object URL / `update()`),
  `usePdfStream` (streaming factory).
- **Client components**: `PDFViewer` (live `<iframe>` preview), `PDFDownloadLink`,
  and `BlobProvider` for easy migration from `@react-pdf/renderer`.
- **Compact `DocSpec` authoring** for token-frugal AI agents: terse,
  JSON-serializable block tuples that compile to the *same* PDF as the
  equivalent JSX (built on the same components). New exports `compileSpec`,
  `specToElement`, `renderSpecToBytes`/`Blob`/`Stream`/`File`, the `DocSpec`/
  `BlockSpec` types, and a versioned Draft 2020-12 JSON Schema via
  `docSpecSchema()` / `docSpecSchemaId()` (the `$id` embeds the package version).
- **Exhaustive `samples/` tree** covering every 0.2.0 capability (typography,
  tables, images, links, barcodes, SVG, form fields, multi-page structure,
  custom fonts, layout/PDF-A, the client hooks/components, and the agent spec),
  type-checked via a new `typecheck:samples` gate folded into `typecheck:all`.
- Re-exports of `pdfnative` font/environment helpers: `registerFonts`,
  `registerFont`, `loadFontData`, `downloadBlob`, `initNodeCompression`.
- `PdfStructureError` for actionable diagnostics when a tree cannot be mapped
  onto the document model.
- Full TypeScript types, dual ESM + CJS builds, and source maps.
- **Supply-chain hardening**: provenance-signed npm publishes (OIDC), a
  CycloneDX SBOM generated, archived, and attached to each GitHub Release, and
  SHA-pinned CI actions.

### Requirements

- React `^19.0.0` (peer dependency).
- Node.js `>=20`.

## [0.1.0] — Name reservation

### Added

- Placeholder release reserving the `pdfnative-react` package name on npm.

[Unreleased]: https://github.com/Nizoka/pdfnative-react/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Nizoka/pdfnative-react/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.1.0
