/**
 * Public component layer for pdfnative-react.
 *
 * Every component is a thin, side-effect-free factory that emits a *host element*
 * (a lowercase tag understood by the reconciler). Components carry no rendering
 * logic themselves: the tree they form is reconciled and then serialized into a
 * `pdfnative` `DocumentParams` object.
 *
 * The API intentionally mirrors familiar React-PDF ergonomics (`<Document>`,
 * `<Page>`, `<Text>`, `<Image>`, `<Link>`) while mapping onto pdfnative's
 * declarative *block flow* model.
 *
 * @packageDocumentation
 */

import { createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import type {
    Align,
    BarcodeFormat,
    CellBorders,
    ColumnDef,
    DocumentMetadata,
    FontEntry,
    FormFieldType,
    ListItem,
    OutlineItem,
    PageLabelRange,
    PdfColor,
    PdfLayoutOptions,
    PdfRow,
    QRErrorLevel,
    SvgRenderOptions,
} from './types.js';
import type { HostTag } from './reconciler/nodes.js';

/**
 * Typed wrapper around {@link createElement} for our lowercase host tags.
 * The host tags are not DOM intrinsics, so we narrow the loose `createElement`
 * surface to exactly what the reconciler accepts.
 */
const h = createElement as (
    tag: HostTag,
    props: Record<string, unknown> | null,
    children?: ReactNode,
) => ReactElement;

// ─────────────────────────────────────────────────────────────────────────────
// Document & Page
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Document}, the required root of every tree. */
export interface DocumentProps {
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
     * Document outline / bookmarks shown in the viewer's sidebar.
     * Pass an explicit nested `OutlineItem[]` tree, or `'auto'` to derive a
     * flat outline from every `<Heading>` in document order. PDF/A-safe.
     */
    readonly outline?: readonly OutlineItem[] | 'auto';
    /**
     * Page labels controlling the numbering shown in the viewer's page box
     * (e.g. roman front matter, then decimal body). PDF/A-safe.
     */
    readonly pageLabels?: readonly PageLabelRange[];
    readonly children?: ReactNode;
}

/** The root component. Exactly one `<Document>` must wrap the whole tree. */
export function Document(props: DocumentProps): ReactElement {
    const { children, ...rest } = props;
    return h('document', rest, children);
}

/** Props for {@link Page}. */
export interface PageProps {
    readonly children?: ReactNode;
}

/**
 * An explicit page boundary. Pages are optional: content flows and paginates
 * automatically. Use `<Page>` to force grouped content onto a fresh page.
 */
export function Page(props: PageProps): ReactElement {
    return h('page', null, props.children);
}

/** Props for {@link Section}. */
export interface SectionProps {
    /** Section title, rendered as a `<Heading>`. */
    readonly title: string;
    /** Heading level (1–3). Default: `2`. */
    readonly level?: 1 | 2 | 3;
    /** Heading color. */
    readonly color?: PdfColor;
    /** Start the section on a fresh page. Default: `false`. */
    readonly break?: boolean;
    readonly children?: ReactNode;
}

/**
 * A titled group of content: a `<Heading>` followed by its blocks.
 *
 * This is the package's one intentional *composite* component — it emits no
 * host tag of its own; React resolves it to `<Heading>` + children before the
 * reconciler runs, so the serialized output is identical to writing them by
 * hand. The heading feeds `<TableOfContents>` and `outline="auto"` like any
 * other `<Heading>`.
 */
export function Section(props: SectionProps): ReactElement {
    const { title, level = 2, color, break: pageBreak, children } = props;
    return createElement(
        Fragment,
        null,
        pageBreak ? h('pageBreak', null) : null,
        h('heading', compactProps({ level, color }), title),
        children,
    );
}

/** Drop `undefined` props so host elements stay clean for serialization. */
function compactProps(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text blocks
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Heading}. */
export interface HeadingProps {
    /** Heading level (1–3). Default: `1`. */
    readonly level?: 1 | 2 | 3;
    /** Text color. */
    readonly color?: PdfColor;
    /** Heading text (alternatively provide it as children). */
    readonly text?: string;
    readonly children?: ReactNode;
}

/** A section heading. Headings feed the auto-generated `<TableOfContents>`. */
export function Heading(props: HeadingProps): ReactElement {
    const { children, ...rest } = props;
    return h('heading', rest, children);
}

/** Props for {@link Paragraph} / {@link Text}. */
export interface ParagraphProps {
    /** Font size in points. */
    readonly fontSize?: number;
    /** Line height multiplier. */
    readonly lineHeight?: number;
    /** Horizontal alignment. Default: `'left'`. */
    readonly align?: Align;
    /** First-line indent in points. */
    readonly indent?: number;
    /** Text color. */
    readonly color?: PdfColor;
    /** Paragraph text (alternatively provide it as children). */
    readonly text?: string;
    readonly children?: ReactNode;
}

/** A wrapping paragraph of body text. */
export function Paragraph(props: ParagraphProps): ReactElement {
    const { children, ...rest } = props;
    return h('paragraph', rest, children);
}

/** Alias of {@link Paragraph} for React-PDF familiarity. */
export const Text = Paragraph;

// ─────────────────────────────────────────────────────────────────────────────
// Lists
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link List}. */
export interface ListProps {
    /** Render as a numbered list instead of bullets. */
    readonly ordered?: boolean;
    /** Explicit list style. Overrides `ordered` when set. */
    readonly style?: 'bullet' | 'numbered';
    /** Font size in points. */
    readonly fontSize?: number;
    /**
     * Items as data: plain strings, or `ListItem` objects carrying nested
     * sub-lists (`{ text, items }`). Alternatively provide `<Item>` children.
     */
    readonly items?: readonly (string | ListItem)[];
    readonly children?: ReactNode;
}

/** A bullet or numbered list. Items may nest sub-lists (see {@link Item}). */
export function List(props: ListProps): ReactElement {
    const { children, ...rest } = props;
    return h('list', rest, children);
}

/** Props for {@link Item}. */
export interface ItemProps {
    /** Item text (alternatively provide it as children). */
    readonly text?: string;
    /** Nested sub-items as data (alternatively nest `<List>`/`<Item>` children). */
    readonly items?: readonly (string | ListItem)[];
    readonly children?: ReactNode;
}

/**
 * A single list item. Use inside `<List>`.
 *
 * Sub-lists nest either as a child `<List>` (HTML-shaped) or as directly
 * nested `<Item>` children; nested lists inherit the parent list's style.
 */
export function Item(props: ItemProps): ReactElement {
    const { children, ...rest } = props;
    return h('item', rest, children);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Table}. */
export interface TableProps {
    /** Column headers. Omit to derive from the first `<Row header>`. */
    readonly headers?: readonly string[];
    /** Rows as data (alternatively provide `<Row>`/`<Cell>` children). */
    readonly rows?: readonly PdfRow[];
    /** Explicit column definitions (widths, alignment). */
    readonly columns?: readonly ColumnDef[];
    /** Clip cell contents to column bounds. Default: `true`. */
    readonly clipCells?: boolean;
    /** Auto-fit column widths to content. Default: `false`. */
    readonly autoFitColumns?: boolean;
    /** Cell wrapping policy. Default: `'auto'`. */
    readonly wrap?: 'auto' | 'always' | 'never';
    /** Repeat the header row across page breaks. Default: `true`. */
    readonly repeatHeader?: boolean;
    /** Alternate-row background (zebra striping). */
    readonly zebra?: boolean | PdfColor;
    /** Caption rendered above the table. */
    readonly caption?: string;
    /** Minimum row height in points. */
    readonly minRowHeight?: number;
    /** Horizontal cell padding in points. */
    readonly cellPadding?: number;
    /** Cell border styling (sides, color, width, dash pattern). */
    readonly cellBorders?: CellBorders;
    /**
     * Vertical alignment of cell content. Default: `'top'`.
     * Override per column with `ColumnDef.vAlign`.
     */
    readonly cellVAlign?: 'top' | 'middle' | 'bottom';
    readonly children?: ReactNode;
}

/** A data table. */
export function Table(props: TableProps): ReactElement {
    const { children, ...rest } = props;
    return h('table', rest, children);
}

/** Props for {@link Row}. */
export interface RowProps {
    /** Mark this row as the header row. */
    readonly header?: boolean;
    /** Visual variant forwarded to pdfnative (`PdfRow.type`). */
    readonly variant?: string;
    /** Emphasize ("pointed") row styling. */
    readonly pointed?: boolean;
    readonly children?: ReactNode;
}

/** A table row. Use inside `<Table>`. */
export function Row(props: RowProps): ReactElement {
    const { children, ...rest } = props;
    return h('row', rest, children);
}

/** Props for {@link Cell}. */
export interface CellProps {
    readonly children?: ReactNode;
}

/** A table cell. Use inside `<Row>`. */
export function Cell(props: CellProps): ReactElement {
    return h('cell', null, props.children);
}

// ─────────────────────────────────────────────────────────────────────────────
// Media & links
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Image}. */
export interface ImageProps {
    /** Raw JPEG or PNG bytes. */
    readonly data: Uint8Array;
    /** Display width in points. */
    readonly width?: number;
    /** Display height in points. */
    readonly height?: number;
    /** Horizontal alignment. Default: `'left'`. */
    readonly align?: Align;
    /** Alt text for tagged-PDF accessibility. */
    readonly alt?: string;
}

/** An embedded raster image (JPEG/PNG). */
export function Image(props: ImageProps): ReactElement {
    return h('image', { ...props });
}

/** Props for {@link Link}. */
export interface LinkProps {
    /** Destination URL. */
    readonly url?: string;
    /** Alias of `url`. */
    readonly href?: string;
    /** Font size in points. */
    readonly fontSize?: number;
    /** Text color. */
    readonly color?: PdfColor;
    /** Link text (alternatively provide it as children). */
    readonly text?: string;
    readonly children?: ReactNode;
}

/** A clickable hyperlink. */
export function Link(props: LinkProps): ReactElement {
    const { children, ...rest } = props;
    return h('link', rest, children);
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Spacer}. */
export interface SpacerProps {
    /** Vertical whitespace in points. Default: `12`. */
    readonly height?: number;
}

/** Vertical whitespace. */
export function Spacer(props: SpacerProps = {}): ReactElement {
    return h('spacer', { ...props });
}

/** A hard page break. */
export function PageBreak(): ReactElement {
    return h('pageBreak', null);
}

/** Props for {@link TableOfContents}. */
export interface TableOfContentsProps {
    /** Heading shown above the entries. Default: `'Table of Contents'`. */
    readonly title?: string;
    /** Deepest heading level to include (1–3). Default: `3`. */
    readonly maxLevel?: 1 | 2 | 3;
    /** Font size for entries. Default: `10`. */
    readonly fontSize?: number;
    /** Indent per heading level in points. Default: `15`. */
    readonly indent?: number;
}

/** An auto-generated table of contents, built from `<Heading>` blocks. */
export function TableOfContents(props: TableOfContentsProps = {}): ReactElement {
    return h('toc', { ...props });
}

/** Alias of {@link TableOfContents}. */
export const Toc = TableOfContents;

// ─────────────────────────────────────────────────────────────────────────────
// Vector & data graphics
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link Barcode}. */
export interface BarcodeProps {
    /** Barcode format (`'qr'`, `'code128'`, `'ean13'`, `'pdf417'`, `'datamatrix'`…). */
    readonly format: BarcodeFormat;
    /** Data to encode. */
    readonly data: string;
    /** Width in points. */
    readonly width?: number;
    /** Height in points. */
    readonly height?: number;
    /** Horizontal alignment. Default: `'left'`. */
    readonly align?: Align;
    /** QR error-correction level. Default: `'M'`. */
    readonly ecLevel?: QRErrorLevel;
    /** PDF417 error-correction level (0–8). Default: `2`. */
    readonly pdf417ECLevel?: number;
}

/** A 1D or 2D barcode rendered with vector operators. */
export function Barcode(props: BarcodeProps): ReactElement {
    return h('barcode', { ...props });
}

/** Props for {@link Svg}. */
export interface SvgProps {
    /** SVG path data or inline SVG markup. */
    readonly data: string;
    /** Display width in points. Default: `200`. */
    readonly width?: number;
    /** Display height in points. Default: `200`. */
    readonly height?: number;
    /** Horizontal alignment. Default: `'left'`. */
    readonly align?: Align;
    /** SVG viewBox `[minX, minY, width, height]`. */
    readonly viewBox?: readonly [number, number, number, number];
    /** Fill color. `'none'` disables fill. */
    readonly fill?: SvgRenderOptions['fill'];
    /** Stroke color. */
    readonly stroke?: SvgRenderOptions['stroke'];
    /** Stroke width in SVG user units. Default: `1`. */
    readonly strokeWidth?: number;
    /** Alt text for tagged-PDF accessibility. */
    readonly alt?: string;
}

/** Inline vector graphics rendered with PDF path operators. */
export function Svg(props: SvgProps): ReactElement {
    return h('svg', { ...props });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive form fields
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link FormField}. */
export interface FormFieldProps {
    /** Field type (`'text'`, `'checkbox'`, `'dropdown'`…). */
    readonly fieldType: FormFieldType;
    /** Unique field name. */
    readonly name: string;
    /** Display label rendered before the widget. */
    readonly label?: string;
    /** Default value. */
    readonly value?: string;
    /** Placeholder hint. */
    readonly placeholder?: string;
    /** Widget width in points. */
    readonly width?: number;
    /** Widget height in points. */
    readonly height?: number;
    /** Font size for text fields/dropdowns. Default: `10`. */
    readonly fontSize?: number;
    /** Options for dropdown/listbox fields. */
    readonly options?: readonly string[];
    /** Read-only field. Default: `false`. */
    readonly readOnly?: boolean;
    /** Required field. Default: `false`. */
    readonly required?: boolean;
    /** Maximum character count. */
    readonly maxLength?: number;
    /** Initial checked state for checkbox/radio. Default: `false`. */
    readonly checked?: boolean;
}

/** An interactive AcroForm widget. */
export function FormField(props: FormFieldProps): ReactElement {
    return h('formField', { ...props });
}
