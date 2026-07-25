/**
 * Minimal, intentional re-export surface over the `pdfnative` engine.
 *
 * Keeping every engine import funnelled through this module means the rest of
 * the package depends on a small, auditable slice of `pdfnative` — and that
 * slice is easy to review when the engine releases a new version.
 */

export {
    buildDocumentPDFBytes,
    buildDocumentPDFStream,
    buildDocumentPDFStreamTrue,
    initNodeCompression,
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
} from 'pdfnative';

export type {
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
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
} from 'pdfnative';
