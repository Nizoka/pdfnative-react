/**
 * Compact document specification — the *token-frugal* authoring surface.
 *
 * `DocSpec` is a terse, JSON-serializable description of a document built from
 * short positional tuples (e.g. `['h1', 'Invoice']`, `['p', 'Thank you.']`).
 * It compiles to **exactly the same** `pdfnative` model as the JSX components —
 * it is a thin projection over them — but costs a fraction of the tokens, which
 * makes it ideal for LLM agents and config-driven generation.
 *
 * There is intentionally no CSS/flexbox here either: a `DocSpec` is a flat (or
 * page-grouped) list of blocks, mirroring pdfnative's declarative block flow.
 *
 * @example
 * ```ts
 * import { renderSpecToBytes, type DocSpec } from 'pdfnative-react';
 *
 * const spec: DocSpec = {
 *     title: 'Invoice #1024',
 *     footerText: 'Acme Inc',
 *     blocks: [
 *         ['h1', 'Invoice #1024'],
 *         ['p', 'Thank you for your business.', { align: 'right' }],
 *         ['table', { h: ['Item', 'Total'], r: [['Pro plan', '$490.00']] }],
 *     ],
 * };
 *
 * const bytes = renderSpecToBytes(spec);
 * ```
 *
 * @packageDocumentation
 */

import type {
    BarcodeProps,
    FormFieldProps,
    HeadingProps,
    ImageProps,
    LinkProps,
    ListProps,
    ParagraphProps,
    SvgProps,
    TableOfContentsProps,
} from '../components.js';
import type {
    CellBorders,
    ColumnDef,
    DocumentMetadata,
    FontEntry,
    ListItem,
    OutlineItem,
    PageLabelRange,
    PdfColor,
    PdfLayoutOptions,
    PdfRow,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Per-block option bags (reuse the component prop types so the spec and the JSX
// surface never drift).
// ─────────────────────────────────────────────────────────────────────────────

/** Options for a heading block (`['h1' | 'h2' | 'h3', text, opts?]`). */
export type HeadingSpecOpts = Pick<HeadingProps, 'color'>;

/** Options for a paragraph block (`['p', text, opts?]`). */
export type ParagraphSpecOpts = Omit<ParagraphProps, 'text' | 'children'>;

/** Options for a list block (`['ul' | 'ol', items, opts?]`). */
export type ListSpecOpts = Pick<ListProps, 'fontSize'>;

/** Options for a link block (`['link', text, opts]`); `url` (or `href`) is required. */
export type LinkSpecOpts = Omit<LinkProps, 'text' | 'children'>;

/** Options for a table-of-contents block (`['toc', opts?]`). */
export type TocSpecOpts = TableOfContentsProps;

/** Options for a barcode block (`['qr' | 'code128' | …, data, opts?]`). */
export type BarcodeSpecOpts = Omit<BarcodeProps, 'format' | 'data'>;

/** Options for an SVG block (`['svg', data, opts?]`). */
export type SvgSpecOpts = Omit<SvgProps, 'data'>;

/** Body of an image block (`['img', body]`). */
export type ImageSpecBody = ImageProps;

/** Body of a form-field block (`['field', body]`). */
export type FormFieldSpecBody = FormFieldProps;

/**
 * A table row in a {@link TableSpecBody}: either a plain array of cell strings
 * (the common case) or a full {@link PdfRow} when you need row typing/emphasis.
 */
export type TableRowSpec = readonly string[] | PdfRow;

/** Body of a table block (`['table', body]`). */
export interface TableSpecBody {
    /** Column headers. */
    readonly h?: readonly string[];
    /** Data rows — arrays of cell strings, or full `PdfRow`s. */
    readonly r: readonly TableRowSpec[];
    /** Explicit column definitions (widths, alignment). */
    readonly columns?: readonly ColumnDef[];
    /** Alternate-row background (zebra striping). */
    readonly zebra?: boolean | PdfColor;
    /** Caption rendered above the table. */
    readonly caption?: string;
    /** Clip cell contents to column bounds. */
    readonly clipCells?: boolean;
    /** Auto-fit column widths to content. */
    readonly autoFitColumns?: boolean;
    /** Cell wrapping policy. */
    readonly wrap?: 'auto' | 'always' | 'never';
    /** Repeat the header row across page breaks. */
    readonly repeatHeader?: boolean;
    /** Minimum row height in points. */
    readonly minRowHeight?: number;
    /** Horizontal cell padding in points. */
    readonly cellPadding?: number;
    /** Cell border styling (sides, color, width, dash pattern). */
    readonly cellBorders?: CellBorders;
    /** Vertical alignment of cell content (per-column override: `ColumnDef.vAlign`). */
    readonly cellVAlign?: 'top' | 'middle' | 'bottom';
}

// ─────────────────────────────────────────────────────────────────────────────
// Block tuples
// ─────────────────────────────────────────────────────────────────────────────

/** Heading: `['h1' | 'h2' | 'h3', text, opts?]`. */
export type HeadingSpec = readonly ['h1' | 'h2' | 'h3', string, HeadingSpecOpts?];
/** Paragraph: `['p', text, opts?]`. */
export type ParagraphSpec = readonly ['p', string, ParagraphSpecOpts?];
/**
 * List: `['ul', items]` (bullet) or `['ol', items]` (numbered).
 * An item is a plain string, or a `ListItem` (`{ text, items }`) carrying a
 * nested sub-list.
 */
export type ListSpec = readonly ['ul' | 'ol', readonly (string | ListItem)[], ListSpecOpts?];
/** Table: `['table', body]`. */
export type TableSpec = readonly ['table', TableSpecBody];
/** Image: `['img', body]`. */
export type ImageSpec = readonly ['img', ImageSpecBody];
/** Link: `['link', text, opts]` — `opts.url` (or `opts.href`) is required. */
export type LinkSpec = readonly ['link', string, LinkSpecOpts];
/** Spacer: `['sp']` (default height) or `['sp', height]`. */
export type SpacerSpec = readonly ['sp', number?];
/** Hard page break: `['br']`. */
export type PageBreakSpec = readonly ['br'];
/** Page group: `['page', blocks]`. */
export type PageSpec = readonly ['page', readonly BlockSpec[]];
/** Table of contents: `['toc', opts?]`. */
export type TocSpec = readonly ['toc', TocSpecOpts?];
/** Barcode: `['qr' | 'code128' | 'ean13' | 'pdf417' | 'datamatrix', data, opts?]`. */
export type BarcodeSpec = readonly [
    'qr' | 'code128' | 'ean13' | 'pdf417' | 'datamatrix',
    string,
    BarcodeSpecOpts?,
];
/** SVG: `['svg', data, opts?]`. */
export type SvgSpec = readonly ['svg', string, SvgSpecOpts?];
/** Form field: `['field', body]`. */
export type FormFieldSpec = readonly ['field', FormFieldSpecBody];

/** Any single block in a {@link DocSpec}. */
export type BlockSpec =
    | HeadingSpec
    | ParagraphSpec
    | ListSpec
    | TableSpec
    | ImageSpec
    | LinkSpec
    | SpacerSpec
    | PageBreakSpec
    | PageSpec
    | TocSpec
    | BarcodeSpec
    | SvgSpec
    | FormFieldSpec;

/** The kind discriminator (first tuple element) of any {@link BlockSpec}. */
export type BlockSpecKind = BlockSpec[0];

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A compact, JSON-serializable document specification — the token-frugal
 * equivalent of a `<Document>` tree. Compiles to the same `pdfnative` model as
 * the JSX components via {@link specToElement}.
 */
export interface DocSpec {
    /** Document title (PDF metadata + optional cover title). */
    readonly title?: string;
    /** Footer text repeated on every page. */
    readonly footerText?: string;
    /** PDF metadata (author, subject, keywords). */
    readonly metadata?: DocumentMetadata;
    /** Pre-loaded font entries for non-Latin scripts. */
    readonly fontEntries?: readonly FontEntry[];
    /** Layout overrides (page size, margins, colors, PDF/A mode…). */
    readonly layout?: Partial<PdfLayoutOptions>;
    /**
     * Document outline / bookmarks: an explicit nested `OutlineItem[]` tree,
     * or `'auto'` to derive one from every heading block in document order.
     */
    readonly outline?: readonly OutlineItem[] | 'auto';
    /** Page labels shown in the viewer's page box (e.g. roman front matter). */
    readonly pageLabels?: readonly PageLabelRange[];
    /** Ordered document blocks. */
    readonly blocks: readonly BlockSpec[];
}
