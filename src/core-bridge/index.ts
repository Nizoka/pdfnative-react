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
} from 'pdfnative';
