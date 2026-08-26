/**
 * The package's single source of truth for its own surface.
 *
 * Four tables live here — {@link BLOCK_REGISTRY} (the `DocSpec` grammar),
 * {@link COMPONENT_REGISTRY} (the JSX components), {@link CLIENT_COMPONENT_REGISTRY}
 * (the preview/download components) and {@link LINT_RULES} (the lint contract).
 * They feed four consumers:
 *
 * 1. `spec/schema.ts` — assembles `$defs.block.oneOf` and the report schemas.
 * 2. `spec/validate.ts` — derives tuple arity and payload types.
 * 3. `manifest.ts` — emits the machine-readable capability manifest.
 * 4. `tests/registry.test.ts` — locks the exact, ordered contents.
 *
 * Because all four derive from these tables rather than restating them, the
 * schema, the manifest and the docs cannot drift apart. The compile-time
 * assertions at the bottom of this file make *omission* a build error, not a
 * silent gap: add a member to `BlockSpec` or `HostTag` without registering it
 * here and `npm run typecheck` fails.
 *
 * This module is pure data — no engine import, no side effects, isomorphic.
 *
 * @packageDocumentation
 */

import type { BlockSpecKind } from './spec/types.js';
import type { HostTag } from './reconciler/nodes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Block registry — the DocSpec grammar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected JavaScript type of a tuple's payload — element `[1]`.
 *
 * `'blocks'` is a nested `BlockSpec[]` (only `['page', …]`), and `'none'` means
 * the tuple carries no payload at all (`['br']`).
 */
export type BlockPayloadKind = 'string' | 'array' | 'object' | 'number' | 'blocks' | 'none';

/** Shape of a {@link BLOCK_REGISTRY} entry. */
interface BlockDescriptorShape {
    /** Schema-group id. Several tuple kinds may share one schema (`h1`/`h2`/`h3`). */
    readonly id: string;
    /** Every `DocSpec` tuple kind this group covers. */
    readonly kinds: readonly BlockSpecKind[];
    /** Minimum tuple length. */
    readonly minItems: number;
    /** Maximum tuple length. When 3, element `[2]` is an options object. */
    readonly maxItems: number;
    /** Expected type of element `[1]`, when present. */
    readonly payload: BlockPayloadKind;
    /** The tuple form, as written in a spec. */
    readonly tuple: string;
    /** One-line description, reused verbatim by the capability manifest. */
    readonly summary: string;
    /** Name of the equivalent JSX component. */
    readonly component: string;
}

/**
 * Every block kind in the `DocSpec` grammar, in schema order.
 *
 * Order is part of the contract: it fixes the order of `$defs.block.oneOf` and
 * of `capabilityManifest().specBlocks`, and a test pins it.
 */
export const BLOCK_REGISTRY = [
    {
        id: 'heading',
        minItems: 2,
        maxItems: 3,
        payload: 'string',
        kinds: ['h1', 'h2', 'h3'],
        tuple: "['h1' | 'h2' | 'h3', text, opts?]",
        summary: 'Section heading (levels 1–3). Feeds the TOC and outline="auto".',
        component: 'Heading',
    },
    {
        id: 'paragraph',
        minItems: 2,
        maxItems: 3,
        payload: 'string',
        kinds: ['p'],
        tuple: "['p', text, opts?]",
        summary: 'Wrapping paragraph of body text.',
        component: 'Paragraph',
    },
    {
        id: 'list',
        minItems: 2,
        maxItems: 3,
        payload: 'array',
        kinds: ['ul', 'ol'],
        tuple: "['ul' | 'ol', items, opts?]",
        summary: 'Bullet or numbered list; items may nest sub-lists.',
        component: 'List',
    },
    {
        id: 'table',
        minItems: 2,
        maxItems: 2,
        payload: 'object',
        kinds: ['table'],
        tuple: "['table', body]",
        summary: 'Data table with headers, column definitions, zebra striping and borders.',
        component: 'Table',
    },
    {
        id: 'image',
        minItems: 2,
        maxItems: 2,
        payload: 'object',
        kinds: ['img'],
        tuple: "['img', body]",
        summary: 'Raster image (JPEG/PNG) from a Uint8Array.',
        component: 'Image',
    },
    {
        id: 'link',
        minItems: 3,
        maxItems: 3,
        payload: 'string',
        kinds: ['link'],
        tuple: "['link', text, opts]",
        summary: 'External hyperlink annotation.',
        component: 'Link',
    },
    {
        id: 'spacer',
        minItems: 1,
        maxItems: 2,
        payload: 'number',
        kinds: ['sp'],
        tuple: "['sp', height?]",
        summary: 'Vertical whitespace in points.',
        component: 'Spacer',
    },
    {
        id: 'pageBreak',
        minItems: 1,
        maxItems: 1,
        payload: 'none',
        kinds: ['br'],
        tuple: "['br']",
        summary: 'Hard page break.',
        component: 'PageBreak',
    },
    {
        id: 'page',
        minItems: 2,
        maxItems: 2,
        payload: 'blocks',
        kinds: ['page'],
        tuple: "['page', blocks]",
        summary: 'Explicit page group; blocks inside start on a fresh page.',
        component: 'Page',
    },
    {
        id: 'toc',
        minItems: 1,
        maxItems: 2,
        payload: 'object',
        kinds: ['toc'],
        tuple: "['toc', opts?]",
        summary: 'Auto-generated table of contents built from heading blocks.',
        component: 'TableOfContents',
    },
    {
        id: 'barcode',
        minItems: 2,
        maxItems: 3,
        payload: 'string',
        kinds: ['qr', 'code128', 'ean13', 'pdf417', 'datamatrix'],
        tuple: "['qr' | 'code128' | 'ean13' | 'pdf417' | 'datamatrix', data, opts?]",
        summary: '1D or 2D barcode rendered with vector operators.',
        component: 'Barcode',
    },
    {
        id: 'svg',
        minItems: 2,
        maxItems: 3,
        payload: 'string',
        kinds: ['svg'],
        tuple: "['svg', data, opts?]",
        summary: 'Inline vector graphics; <text>/<tspan> render as selectable PDF text.',
        component: 'Svg',
    },
    {
        id: 'chart',
        minItems: 2,
        maxItems: 2,
        payload: 'object',
        kinds: ['chart'],
        tuple: "['chart', body]",
        summary:
            'Native vector chart (bar, barH, line, pie, donut, stackedBar, stackedBarH, '
            + 'area, scatter) drawn with PDF path operators. Requires the pdfnative '
            + 'engine >= 1.7.0.',
        component: 'Chart',
    },
    {
        id: 'field',
        minItems: 2,
        maxItems: 2,
        payload: 'object',
        kinds: ['field'],
        tuple: "['field', body]",
        summary: 'Interactive AcroForm widget.',
        component: 'FormField',
    },
] as const satisfies readonly BlockDescriptorShape[];

/** A schema-group id from {@link BLOCK_REGISTRY}. */
export type BlockGroupId = (typeof BLOCK_REGISTRY)[number]['id'];

/** A read-only view of a {@link BLOCK_REGISTRY} entry. */
export type BlockDescriptor = (typeof BLOCK_REGISTRY)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Component registry — the JSX surface
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a {@link COMPONENT_REGISTRY} entry. */
interface ComponentDescriptorShape {
    /** Exported component name. */
    readonly name: string;
    /** Host tag emitted, or `null` for the one composite (`<Section>`). */
    readonly tag: HostTag | null;
    /** One-line description. */
    readonly summary: string;
    /** Additional exported aliases for the same component. */
    readonly aliases?: readonly string[];
}

/** Every public component, in barrel order. */
export const COMPONENT_REGISTRY = [
    {
        name: 'Document',
        tag: 'document',
        summary:
            'Required root. Carries title, metadata, fonts, outline, page labels and '
            + 'the layout sugar (watermark, header, footer, attachments, tagged).',
    },
    { name: 'Page', tag: 'page', summary: 'Explicit page boundary.' },
    {
        name: 'Section',
        tag: null,
        summary:
            'The one composite: a heading plus its grouped content. Emits no host tag '
            + 'of its own.',
    },
    { name: 'Heading', tag: 'heading', summary: 'Section heading, levels 1–3.' },
    {
        name: 'Paragraph',
        tag: 'paragraph',
        summary: 'Wrapping body text.',
        aliases: ['Text'],
    },
    { name: 'List', tag: 'list', summary: 'Bullet or numbered list.' },
    { name: 'Item', tag: 'item', summary: 'A list item; may nest sub-lists.' },
    { name: 'Table', tag: 'table', summary: 'Data table.' },
    { name: 'Row', tag: 'row', summary: 'A table row.' },
    { name: 'Cell', tag: 'cell', summary: 'A table cell.' },
    { name: 'Image', tag: 'image', summary: 'Raster image from bytes.' },
    { name: 'Link', tag: 'link', summary: 'External hyperlink.' },
    { name: 'Spacer', tag: 'spacer', summary: 'Vertical whitespace.' },
    { name: 'PageBreak', tag: 'pageBreak', summary: 'Hard page break.' },
    {
        name: 'TableOfContents',
        tag: 'toc',
        summary: 'Auto-generated table of contents.',
        aliases: ['Toc'],
    },
    { name: 'Barcode', tag: 'barcode', summary: '1D/2D barcode.' },
    { name: 'Svg', tag: 'svg', summary: 'Inline vector graphics.' },
    {
        name: 'Chart',
        tag: 'chart',
        summary:
            'Native vector chart (bar, barH, line, pie, donut, stackedBar, stackedBarH, '
            + 'area, scatter).',
    },
    { name: 'FormField', tag: 'formField', summary: 'Interactive AcroForm widget.' },
] as const satisfies readonly ComponentDescriptorShape[];

/** A read-only view of a {@link COMPONENT_REGISTRY} entry. */
export type ComponentDescriptor = (typeof COMPONENT_REGISTRY)[number];

/**
 * Client-side components — preview and download helpers.
 *
 * Kept separate from {@link COMPONENT_REGISTRY} because they emit no host tag
 * and author no block: they *consume* a document rather than describing one.
 * Folding them in would also defeat the `HostTag` exhaustiveness lock.
 *
 * These modules carry `'use client'` in source, and reach consumers through the
 * dedicated `pdfnative-react/client` subpath (built from `src/client.ts`), which
 * ships the directive applied. The root bundle deliberately does **not** carry
 * it — marking it would break every server usage. See `docs/SERVER.md`.
 */
export const CLIENT_COMPONENT_REGISTRY = [
    {
        name: 'PDFViewer',
        summary: 'Live iframe preview of a document.',
    },
    {
        name: 'PDFDownloadLink',
        summary: 'Anchor that downloads a rendered document.',
    },
    {
        name: 'BlobProvider',
        summary: 'Render-prop giving access to the blob, URL, loading and error state.',
    },
] as const satisfies readonly { readonly name: string; readonly summary: string }[];

// ─────────────────────────────────────────────────────────────────────────────
// Lint-rule registry
// ─────────────────────────────────────────────────────────────────────────────

/** How serious a lint finding is. */
export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * Stable lint-rule registry: code → severity + one-line description.
 *
 * Lives here, next to the other surface tables, so `spec/schema.ts` can describe
 * a lint report **without importing the linter** — and therefore without pulling
 * the pdfnative engine into the schema path. Emitting the schema stays a pure,
 * dependency-free operation.
 */
export const LINT_RULES = {
    L_EMPTY_DOCUMENT: {
        severity: 'error',
        description: 'The document has no blocks — it would render as a blank page.',
    },
    L_IMAGE_ALT: {
        severity: 'warning',
        description: 'An image has no alt text, so assistive technology cannot describe it.',
    },
    L_CHART_ALT: {
        severity: 'info',
        description:
            'A chart has no altText. The engine auto-generates a generic description; '
            + 'a written one is far more useful.',
    },
    L_TABLE_HEADERS: {
        severity: 'warning',
        description: 'A table has no header row, which breaks screen-reader navigation.',
    },
    L_HEADING_HIERARCHY: {
        severity: 'warning',
        description: 'Heading levels skip a step (e.g. h1 followed by h3).',
    },
    L_FIELD_LABEL: {
        severity: 'warning',
        description: 'A form field has no label, leaving the widget unidentified.',
    },
    L_LINK_TEXT: {
        severity: 'warning',
        description: 'A link has no text, or its text is just the raw URL.',
    },
    L_TAGGED_NO_FONTS: {
        severity: 'error',
        description:
            'PDF/A is requested but no fontEntries are supplied. PDF/A requires every '
            + 'rendering font to be embedded (veraPDF rule 6.2.11.4.1).',
    },
    L_TAGGED_ENCRYPTED: {
        severity: 'error',
        description: 'PDF/A and encryption are mutually exclusive (ISO 19005-1 §6.3.2).',
    },
    L_ATTACHMENTS_NEED_PDFA3: {
        severity: 'error',
        description:
            "Embedded file attachments require tagged: 'pdfa3b' — only PDF/A-3 "
            + 'permits them (ISO 19005-3).',
    },
    L_MAX_BLOCKS: {
        severity: 'warning',
        description: 'The block count is within 10% of the configured maxBlocks ceiling.',
    },
    L_MAX_BLOCKS_EXCEEDED: {
        severity: 'error',
        description: 'The block count is past the configured maxBlocks ceiling.',
    },
    L_CHART_EMPTY: {
        severity: 'error',
        description: 'A chart has no series, or a series has no values.',
    },
    L_CHART_SERIES: {
        severity: 'error',
        description: 'A pie or donut chart must have exactly one series.',
    },
    L_CHART_CATEGORIES: {
        severity: 'error',
        description: "A chart series has a different length from the chart's categories.",
    },
    L_CHART_VALUES: {
        severity: 'error',
        description: 'A chart contains a non-finite value, or a negative value in a pie/donut.',
    },
    L_CHART_POINTS: {
        severity: 'error',
        description: 'A chart exceeds the engine ceiling of 10 000 data points.',
    },
    L_CHART_LOG_SCALE: {
        severity: 'error',
        description:
            'A log-scaled axis is combined with a stacked chart, has a bound <= 0, '
            + 'or a series bound to it contains a value <= 0.',
    },
    L_CHART_X_AXIS: {
        severity: 'error',
        description:
            'Invalid x-axis configuration: a positional axis type on an unsupported '
            + 'chart kind, a scatter chart with a category axis, missing or '
            + 'mismatched xValues, date strings without a time axis, or yAxis '
            + '"right" on a pie/donut.',
    },
    L_CHART_LABELS: {
        severity: 'error',
        description:
            'Invalid x-label options: labelStride/labelRotation on a scatter chart, '
            + 'a non-integer or < 1 labelStride, or a labelRotation outside 0-90.',
    },
    L_PRINT_BOXES: {
        severity: 'error',
        description:
            'The print-production options are invalid (bleed/box geometry, marks '
            + 'without a TrimBox, or userUnit constraints) — the engine would '
            + 'reject them mid-render.',
    },
    L_VIEWER_PRINT_RANGE: {
        severity: 'error',
        description:
            'Invalid print-dialog viewer preferences: a malformed printPageRange '
            + 'pair (1-based, first <= last) or a non-positive-integer numCopies.',
    },
    L_OUTPUT_INTENT_IGNORED: {
        severity: 'warning',
        description:
            'layout.outputIntent is set but the document is not tagged — the '
            + 'engine silently ignores it.',
    },
    L_TAGGED_FORM_FONTS: {
        severity: 'warning',
        description:
            'A PDF/A document contains form fields; the AcroForm font is not '
            + 'embedded, so the engine will report PDFA_UNEMBEDDED_FORM_FONT '
            + '(and throw under layout.strict).',
    },
    L_OVERFLOW: {
        severity: 'warning',
        description: 'A block overflows the page content box (requires `overflow: true`).',
    },
} as const satisfies Record<
    string,
    { readonly severity: LintSeverity; readonly description: string }
>;

/** A stable lint-rule identifier. */
export type LintRuleCode = keyof typeof LINT_RULES;

/** Every rule code, in registry order. */
export const LINT_RULE_CODES = /* @__PURE__ */ (Object.keys(
    LINT_RULES,
) as readonly LintRuleCode[]);

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time exhaustiveness locks
//
// These make omission a *build* error. Delete an entry above (or add a member
// to `BlockSpec` / `HostTag` without registering it) and `npm run typecheck`
// fails before any test runs.
// ─────────────────────────────────────────────────────────────────────────────

/** Exact type equality (invariant, so it catches widening in both directions). */
type Equals<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T;

/** Every tuple kind covered by {@link BLOCK_REGISTRY}. */
type RegisteredBlockKind = (typeof BLOCK_REGISTRY)[number]['kinds'][number];

/** Every host tag produced by {@link COMPONENT_REGISTRY}. */
type RegisteredTag = Exclude<(typeof COMPONENT_REGISTRY)[number]['tag'], null>;

/** Locks {@link BLOCK_REGISTRY} to the `BlockSpec` union. */
export type BlockRegistryIsExhaustive = Assert<Equals<RegisteredBlockKind, BlockSpecKind>>;

/** Locks {@link COMPONENT_REGISTRY} to the `HostTag` union. */
export type ComponentRegistryIsExhaustive = Assert<Equals<RegisteredTag, HostTag>>;
