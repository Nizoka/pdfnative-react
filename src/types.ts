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
    PdfColor,
    BarcodeFormat,
    QRErrorLevel,
    FormFieldType,
    SvgRenderOptions,
} from 'pdfnative';

export type {
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
}

/**
 * The intermediate representation produced by reconciling a React tree.
 * This is exactly the object passed to `pdfnative`'s `buildDocumentPDFBytes`.
 */
export type CompiledDocument = DocumentParams;
