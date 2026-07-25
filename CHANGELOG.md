# Changelog

All notable changes to **pdfnative-react** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — Charts, server rendering, and an autonomous agent surface

Tracks the `pdfnative` engine's 1.6.0 release, opens three adoption paths
(server-side rendering, document-level layout sugar, linting), and completes the
agent-automation contract so an AI agent can drive the package without a human
in the loop.

No public API was removed or changed in a backward-incompatible way. Two
*install-time* floors were raised — see **Changed** first.

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

#### Document-level layout sugar

- New `<Document>` props — **`watermark`**, **`header`**, **`footer`**,
  **`attachments`**, **`tagged`** — surfacing `PdfLayoutOptions` fields that
  previously worked only as an opaque, undocumented `layout` pass-through.
  `watermark` accepts a plain string as shorthand for the common case. An
  explicit `layout` prop always wins. Mirrored on `DocSpec` and in the schema.
  A document that uses none of them still serializes with `layout: undefined`,
  so existing output is byte-identical.

#### Linting

- **`lintDocument(node, options?)`** / **`lintSpec(spec, options?)`** — sixteen
  deterministic accessibility and layout rules with stable `L_*` codes. Runs on
  the compiled document model, so JSX and `DocSpec` share one implementation.
  Pure: no console output, no throwing.
- Five rules pre-empt hard failures further down the pipeline:
  `L_CHART_SERIES`, `L_CHART_CATEGORIES`, `L_CHART_VALUES` and `L_CHART_POINTS`
  mirror the engine's own chart validation (which throws at render time), and
  `L_ATTACHMENTS_NEED_PDFA3` / `L_TAGGED_NO_FONTS` catch PDF/A documents the
  engine or veraPDF would reject.

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
  `{ ok, checks: [{ name, status, value, detail }] }`. Never throws, including
  when the `pdfnative` peer is missing — which is precisely what it diagnoses.
  The engine check is a *capability probe* rather than a version-string parse,
  so it survives bundling into a browser build.
- **`validateSpec(spec: unknown)`** — structural validation of an untrusted
  `DocSpec` with no JSON-Schema engine, returning path-anchored `V_*` findings
  (`blocks[3][1]`). Never throws. This is dry-run tier 1; `compileSpec`,
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
- 6 new samples (charts, layout sugar, a Next.js route handler, linting, the
  full agent loop, the error envelope) and 3 new agent samples, all
  type-checked in CI.

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

[Unreleased]: https://github.com/Nizoka/pdfnative-react/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Nizoka/pdfnative-react/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.1.0
