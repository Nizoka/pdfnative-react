/**
 * pdfnative-react — a declarative React renderer for the
 * [`pdfnative`](https://www.npmjs.com/package/pdfnative) PDF engine.
 *
 * Compose documents with JSX components; the custom React reconciler compiles
 * the tree into a `pdfnative` `DocumentParams` model and renders real PDF bytes
 * — no DOM, no headless browser, no native dependencies.
 *
 * @example
 * ```tsx
 * import { Document, Heading, Paragraph, renderToBytes } from 'pdfnative-react';
 *
 * const bytes = renderToBytes(
 *   <Document title="Hello">
 *     <Heading>Invoice</Heading>
 *     <Paragraph>Thank you for your business.</Paragraph>
 *   </Document>,
 * );
 * ```
 *
 * @packageDocumentation
 */

// Components (declarative document model)
export * from './components.js';

// Render entry points (bytes / blob / stream / file)
export {
    compileDocument,
    renderToBytes,
    renderToBlob,
    renderToStream,
    renderToFile,
} from './render.js';

// Client hooks
export { usePdf, usePdfStream } from './hooks.js';
export type { UsePdfResult, UsePdfStreamResult } from './hooks.js';

// Client preview/download components
export { PDFViewer, BlobProvider, PDFDownloadLink } from './viewer.js';
export type {
    PDFViewerProps,
    BlobProviderProps,
    PDFDownloadLinkProps,
    PdfRenderState,
} from './viewer.js';

// Compact, token-frugal authoring surface (DocSpec) + versioned JSON Schema
export {
    specToElement,
    compileSpec,
    renderSpecToBytes,
    renderSpecToBlob,
    renderSpecToStream,
    renderSpecToFile,
    docSpecSchema,
    docSpecSchemaId,
} from './spec/index.js';
export type {
    DocSpec,
    BlockSpec,
    BlockSpecKind,
    HeadingSpec,
    ParagraphSpec,
    ListSpec,
    TableSpec,
    TableSpecBody,
    TableRowSpec,
    ImageSpec,
    ImageSpecBody,
    LinkSpec,
    SpacerSpec,
    PageBreakSpec,
    PageSpec,
    TocSpec,
    BarcodeSpec,
    SvgSpec,
    FormFieldSpec,
    FormFieldSpecBody,
    HeadingSpecOpts,
    ParagraphSpecOpts,
    ListSpecOpts,
    LinkSpecOpts,
    TocSpecOpts,
    BarcodeSpecOpts,
    SvgSpecOpts,
    JsonSchema,
} from './spec/index.js';

// Font + environment helpers (re-exported from the pdfnative engine)
export {
    registerFonts,
    registerFont,
    loadFontData,
    downloadBlob,
    initNodeCompression,
} from './core-bridge/index.js';

// Errors
export { PdfStructureError } from './reconciler/serialize.js';

// Version
export { version } from './version.js';

// Public types
export type {
    Align,
    Color,
    RenderOptions,
    CompiledDocument,
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
    PdfLayoutOptions,
    PdfRow,
    ColumnDef,
    FontEntry,
    PdfColor,
    BarcodeFormat,
    QRErrorLevel,
    FormFieldType,
    SvgRenderOptions,
} from './types.js';
