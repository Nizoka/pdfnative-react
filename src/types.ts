/**
 * Public type definitions for pdfnative-react.
 *
 * These types mirror the `pdfnative` document model (a declarative *block flow*,
 * not an HTML/CSS box model) while presenting an ergonomic, JSX-friendly surface.
 *
 * @packageDocumentation
 */

import type {
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
    PdfLayoutOptions,
    PdfRow,
    ColumnDef,
    FontEntry,
    FontData,
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
};

/** Horizontal alignment shared by several blocks. */
export type Align = 'left' | 'center' | 'right';

/** A color accepted by the pdfnative engine: hex, RGB tuple, or PDF operator string. */
export type Color = string | readonly [number, number, number];

/**
 * Options accepted by every render entry point. Forwarded to the underlying
 * `pdfnative` builder.
 */
export interface RenderOptions {
    /** Layout overrides (page size, margins, colors, PDF/A mode, encryption…). */
    readonly layout?: Partial<PdfLayoutOptions>;
    /** Pre-loaded font entries for non-Latin scripts (see `pdfnative` `loadFontData`). */
    readonly fontEntries?: readonly FontEntry[];
    /**
     * Convenience map of language → font loader, resolved with
     * {@link resolveFonts} before rendering. Only honored by the *async*
     * entry points (`renderToFile`, `renderToFileStream`, `usePdf`,
     * `usePdfStream`) — font loading is asynchronous, so the synchronous
     * entries (`renderToBytes`, `renderToBlob`, `renderToStream`) ignore it;
     * resolve manually first: `fontEntries: await resolveFonts(fonts)`.
     */
    readonly fonts?: FontsMap;
}

/**
 * A dynamic loader for a pdfnative font-data module, typically a bare dynamic
 * import: `() => import('pdfnative/fonts/noto-arabic-data.js')`. The resolved
 * value is the font-data module (its named exports), a `{ default }` wrapper,
 * or a {@link FontData} object — the engine accepts all three at load time,
 * which is why the resolved type is intentionally `unknown` here rather than
 * the engine's stricter loader type (the auto-generated font modules do not
 * structurally satisfy it under `strict`).
 */
export type FontLoader = () => Promise<unknown>;

/**
 * A map of language key → font loader, e.g.
 * `{ math: () => import('pdfnative/fonts/noto-sans-math-data.js') }`.
 * Accepted by {@link resolveFonts} and `RenderOptions.fonts`.
 */
export type FontsMap = Readonly<Record<string, FontLoader>>;

/**
 * The intermediate representation produced by reconciling a React tree.
 * This is exactly the object passed to `pdfnative`'s `buildDocumentPDFBytes`.
 */
export type CompiledDocument = DocumentParams;
