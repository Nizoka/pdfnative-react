# Changelog

All notable changes to **pdfnative-react** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Nizoka/pdfnative-react/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.1.0
