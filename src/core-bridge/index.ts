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
     *    parsing version strings.
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
    // PDF/A conformance diagnostics channel (engine ≥ 1.7.0)
    PdfDiagnostic,
    PdfDiagnosticCode,
    PdfDiagnosticHandler,
} from 'pdfnative';
