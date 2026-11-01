/**
 * Minimal, intentional re-export surface over the `pdfnative` engine.
 *
 * Keeping every engine import funnelled through this module means the rest of
 * the package depends on a small, auditable slice of `pdfnative` — and that
 * slice is easy to review when the engine releases a new version.
 */

export {
    buildDocumentPDFBytes,
    buildDocumentPDFStreamTrue,
    /**
     * Called eagerly by `renderToStream` before the generator is handed out:
     * the engine otherwise runs this check *inside* the generator, which for
     * `renderToResponse` (streaming by default) would surface a `<TableOfContents>`
     * or `{pages}`-template rejection mid-response — after the headers are gone.
     */
    validateDocumentStreamable,
    initNodeCompression,
    setDeflateImpl,
    /**
     * Environment helpers first shipped in pdfnative 1.8.0, re-exported from
     * the public barrel beside `setDeflateImpl`:
     *
     * - `setDeflateRawImpl` / `wrapZlib` — inject a raw RFC 1951 compressor
     *   (fflate's `deflateSync`, for instance) and let the engine add the
     *   RFC 1950 envelope. `setDeflateImpl` now rejects raw output (#78).
     * - `setDefaultCreationDate` / `getDefaultCreationDate` — pin the
     *   creation instant process-wide; with dates written in UTC the output
     *   is byte-identical on every host (see `docs/REPRODUCIBLE.md`).
     * - `setHyphenationProvider` / `getHyphenationProvider` — bring your own
     *   hyphenation dictionary; the engine ships none.
     */
    setDeflateRawImpl,
    wrapZlib,
    /**
     * Also a **capability probe** for `doctor()`: this function first
     * exists in pdfnative 1.8.0, alongside typography, CMYK and PDF/X-4. Its
     * presence distinguishes a 1.8.x engine from a 1.7.x one (the 1.9.0
     * probe is `resolveBidiLevels`).
     */
    setDefaultCreationDate,
    getDefaultCreationDate,
    setHyphenationProvider,
    getHyphenationProvider,
    inspectDocumentLayout,
    streamToFile,
    downloadBlob,
    registerFonts,
    registerFont,
    loadFontData,
    validateFontData,
    /**
     * Imported solely as a **capability probe** for `doctor()`: this function
     * first exists in pdfnative 1.6.0, alongside the `chart` block. Probing for
     * the capability is more honest — and more portable, since it survives
     * bundling into a browser build — than parsing a version string out of the
     * engine's `package.json`.
     *
     * Deliberately not re-exported from the public barrel: charts are authored
     * with `<Chart>`, not by calling engine internals.
     */
    estimateChartHeight,
    /**
     * Imported for two deliberate, internal uses — and, like
     * `estimateChartHeight`, never re-exported from the public barrel:
     *
     * 1. **Capability probe** for `doctor()`: this function first exists in
     *    pdfnative 1.7.0, alongside print production (`layout.print`). Its
     *    presence distinguishes a 1.7.x engine from a 1.6.x one without
     *    parsing version strings (the 1.8.0 probe is `setDefaultCreationDate`).
     * 2. **Lint delegate** for `L_PRINT_BOXES`: `lintDocument` calls it in a
     *    try/catch so the lint report carries the engine's own validation
     *    message — zero duplicated geometry rules, zero drift.
     */
    validatePrintOptions,
    /**
     * The engine's default page size (A4, points). Imported so the
     * `L_PRINT_BOXES` lint validates print geometry against the exact
     * dimensions the engine will use when `layout.pageWidth`/`pageHeight`
     * are unset — no hard-coded copies to drift. Not re-exported from the
     * public barrel.
     */
    PG_W,
    PG_H,
    /**
     * The engine's list of PDF/X conformance targets (`['pdfx4']` in 1.8.0).
     * Imported so the `L_PDFX_*` lint hints name the targets the engine will
     * actually accept — no hard-coded copy to drift. Not re-exported.
     */
    PDF_X_CONFORMANCE_TARGETS,
    /**
     * Imported solely as the **capability probe** for `doctor()`: this
     * function first exists in pdfnative 1.9.0, alongside the full UAX #9
     * bidirectional algorithm and the `direction` option the renderer
     * surfaces. Its presence distinguishes a 1.9.x engine from a 1.8.x one.
     *
     * Deliberately not re-exported from the public barrel: bidi resolution
     * is an engine internal — authors set `<Document direction>`.
     */
    resolveBidiLevels,
    /**
     * **Lint delegates** for `L_PDFA_JPX_IMAGE` (engine ≥ 1.9.0):
     * `detectImageFormat` is the engine's own magic-byte sniff (`'jpx'` for a
     * JP2 file or a raw codestream) and `parseJPX` its JPEG 2000 header
     * reader, called in a try/catch so the finding names the channel count or
     * opacity channel exactly as the engine's `PDFA_JPX_IMAGE` diagnostic
     * will. Never re-exported — images are authored with `<Image>`, and
     * detection and parsing are the engine's job.
     */
    detectImageFormat,
    parseJPX,
} from 'pdfnative';

export type {
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
    PdfColors,
    PdfLayoutOptions,
    PdfRow,
    ColumnDef,
    FontEntry,
    FontData,
    FontValidationResult,
    OutlineItem,
    PageLabelRange,
    PageLabelStyle,
    ViewerPreferences,
    LayoutDebugOptions,
    LayoutInspection,
    InspectedPage,
    InspectedBlock,
    CellBorders,
    ListItem,
    StreamToFileResult,
    // Charts (engine ≥ 1.6.0)
    ChartBlock,
    ChartSeries,
    ChartType,
    // Document-level layout options surfaced as `<Document>` props
    PageTemplate,
    WatermarkOptions,
    WatermarkText,
    WatermarkImage,
    PdfAttachment,
    PdfAttachmentRelationship,
    EncryptionOptions,
    // Print production (engine ≥ 1.7.0)
    PrintOptions,
    PrinterMarksOptions,
    PageBox,
    CustomOutputIntent,
    // PDF/A conformance diagnostics channel (engine ≥ 1.7.0; nine codes as of 1.8.0)
    PdfDiagnostic,
    PdfDiagnosticCode,
    PdfDiagnosticHandler,
    // Typography engine (engine ≥ 1.8.0)
    TypographyOptions,
    UnitBindingOptions,
    PunctuationSpacingRule,
    PunctuationSpacingPreset,
    Base14Metrics,
    HyphenationProvider,
    // CMYK colour, colour bars and PDF/X-4 (engine ≥ 1.8.0)
    ColourBarOptions,
    PdfCmykTuple,
    PdfCmykString,
    PdfXConformanceTarget,
    // Bidirectional text, spot colours and JPEG 2000 (engine ≥ 1.9.0)
    TextDirection,
    PdfSpotColor,
    PdfInkMix,
    SpotColourDef,
    JpxInfo,
} from 'pdfnative';
