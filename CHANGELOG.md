# Changelog

All notable changes to **pdfnative-react** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Nizoka/pdfnative-react/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Nizoka/pdfnative-react/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.1.0
