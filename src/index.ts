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

// Render entry points (bytes / blob / stream / file) + layout inspection
export {
    compileDocument,
    renderToBytes,
    renderToBlob,
    renderToStream,
    renderToFile,
    renderToFileStream,
    inspectDocument,
} from './render.js';

// Web-standard Response (Next.js route handlers, Remix, Hono, Workers…)
export { renderToResponse } from './response.js';
export type { PdfResponseOptions } from './response.js';

// Accessibility & layout linting
export { lintDocument, LINT_RULES, LINT_RULE_CODES } from './lint.js';
export type {
    LintFinding,
    LintOptions,
    LintReport,
    LintRuleCode,
    LintSeverity,
} from './lint.js';

// Font convenience (async loader map → FontEntry[])
export { resolveFonts } from './fonts.js';

// Asset helpers (image bytes from URLs / base64 payloads)
export { fromUrl, fromBase64 } from './assets.js';

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
    inspectSpec,
    lintSpec,
    validateSpec,
    renderSpecToBytes,
    renderSpecToBlob,
    renderSpecToStream,
    renderSpecToFile,
    renderSpecToFileStream,
    renderSpecToResponse,
    schema,
    schemaId,
    SCHEMA_SUBJECTS,
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
    ChartSpec,
    ChartSpecBody,
    SchemaSubject,
    SpecCodeValue,
    SpecFinding,
    SpecFindingSeverity,
    SpecValidation,
    JsonSchema,
} from './spec/index.js';
export { SpecCode } from './spec/index.js';

// Font + environment helpers (re-exported from the pdfnative engine)
export {
    registerFonts,
    registerFont,
    loadFontData,
    validateFontData,
    downloadBlob,
    initNodeCompression,
    setDeflateImpl,
} from './core-bridge/index.js';

// Errors — stable, machine-readable taxonomy
export { PdfStructureError, PdfReactError, ErrorCode, toErrorEnvelope } from './errors.js';
export type { ErrorCodeValue, ErrorEnvelope } from './errors.js';

// Agent surface: discovery, pre-flight, governance
export { capabilityManifest } from './manifest.js';
export type {
    CapabilityManifest,
    ManifestBlock,
    ManifestComponent,
    ManifestEntrypoint,
    ManifestLintRule,
} from './manifest.js';
export { doctor } from './doctor.js';
export type { CheckStatus, DoctorCheck, DoctorReport } from './doctor.js';
export { aiGovernancePolicy, agentRulesText, validateIssueDraft } from './governance.js';
export type { AiGovernancePolicy, GovernanceValidation } from './governance.js';

// Version
export { version } from './version.js';

// Public types
export type {
    Align,
    Color,
    RenderOptions,
    FontsMap,
    CompiledDocument,
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
    PdfLayoutOptions,
    PdfRow,
    ColumnDef,
    FontEntry,
    FontData,
    FontLoader,
    FontValidationResult,
    PdfColor,
    BarcodeFormat,
    QRErrorLevel,
    FormFieldType,
    SvgRenderOptions,
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
    ChartBlock,
    ChartSeries,
    ChartType,
    PageTemplate,
    WatermarkOptions,
    WatermarkText,
    WatermarkImage,
    PdfAttachment,
    PdfAttachmentRelationship,
    EncryptionOptions,
    PrintOptions,
    PrinterMarksOptions,
    PageBox,
    CustomOutputIntent,
    PdfDiagnostic,
    PdfDiagnosticCode,
    PdfDiagnosticHandler,
    PdfColors,
} from './types.js';
