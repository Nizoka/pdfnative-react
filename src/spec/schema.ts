/**
 * Versioned JSON Schema (Draft 2020-12) for the compact {@link DocSpec} authoring
 * format, so agents and tooling can self-validate a spec before rendering.
 *
 * The schema is hand-authored, pure data (zero runtime deps — no validator is
 * bundled), and versioned via a `$id` that embeds the package version, so any
 * drift is detectable and pinned by a test.
 *
 * @packageDocumentation
 */

import { version } from '../version.js';
import type { DocSpec } from './types.js';

/** A read-only JSON Schema fragment. */
export type JsonSchema = Readonly<Record<string, unknown>>;

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const ID_BASE = 'https://pdfnative.dev/schema/react';

function schemaId(): string {
    return `${ID_BASE}/${version}/doc-spec.schema.json`;
}

/** `['h1' | 'h2' | 'h3', text, opts?]` */
function headingBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'HeadingSpec',
        minItems: 2,
        maxItems: 3,
        prefixItems: [
            { enum: ['h1', 'h2', 'h3'] },
            { type: 'string', description: 'Heading text.' },
            { type: 'object', description: 'Optional { color }.' },
        ],
    };
}

/** `['p', text, opts?]` */
function paragraphBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'ParagraphSpec',
        minItems: 2,
        maxItems: 3,
        prefixItems: [
            { const: 'p' },
            { type: 'string', description: 'Paragraph text.' },
            { type: 'object', description: 'Optional { fontSize, lineHeight, align, indent, color }.' },
        ],
    };
}

/** `['ul' | 'ol', items, opts?]` */
function listBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'ListSpec',
        minItems: 2,
        maxItems: 3,
        prefixItems: [
            { enum: ['ul', 'ol'] },
            {
                type: 'array',
                items: { $ref: '#/$defs/listItem' },
                description: 'List items: strings, or { text, items } for nested sub-lists.',
            },
            { type: 'object', description: 'Optional { fontSize }.' },
        ],
    };
}

/** A list item: plain string or a recursive `{ text, items }` node. */
function listItemDef(): JsonSchema {
    return {
        oneOf: [
            { type: 'string' },
            {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    items: { type: 'array', items: { $ref: '#/$defs/listItem' } },
                },
            },
        ],
    };
}

/** A recursive outline / bookmark node. */
function outlineItemDef(): JsonSchema {
    return {
        type: 'object',
        required: ['title', 'pageIndex'],
        properties: {
            title: { type: 'string', description: 'Bookmark label.' },
            pageIndex: { type: 'integer', minimum: 0, description: '0-based destination page.' },
            y: { type: 'number', description: 'Destination Y in points (default: top of page).' },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            color: { type: ['string', 'array'] },
            open: { type: 'boolean', description: 'Initial expansion state (default true).' },
            children: { type: 'array', items: { $ref: '#/$defs/outlineItem' } },
        },
    };
}

/** `['table', body]` */
function tableBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'TableSpec',
        minItems: 2,
        maxItems: 2,
        prefixItems: [
            { const: 'table' },
            {
                type: 'object',
                required: ['r'],
                properties: {
                    h: { type: 'array', items: { type: 'string' }, description: 'Column headers.' },
                    r: {
                        type: 'array',
                        description: 'Rows: arrays of cell strings, or full PdfRow objects.',
                        items: {
                            oneOf: [
                                { type: 'array', items: { type: 'string' } },
                                {
                                    type: 'object',
                                    required: ['cells', 'type', 'pointed'],
                                    properties: {
                                        cells: { type: 'array', items: { type: 'string' } },
                                        type: { type: 'string' },
                                        pointed: { type: 'boolean' },
                                    },
                                },
                            ],
                        },
                    },
                    columns: {
                        type: 'array',
                        items: { type: 'object' },
                        description: 'ColumnDef[] (widths, align, vAlign, kind).',
                    },
                    zebra: { type: ['boolean', 'string', 'array'] },
                    caption: { type: 'string' },
                    clipCells: { type: 'boolean' },
                    autoFitColumns: { type: 'boolean' },
                    wrap: { enum: ['auto', 'always', 'never'] },
                    repeatHeader: { type: 'boolean' },
                    minRowHeight: { type: 'number' },
                    cellPadding: { type: 'number' },
                    cellBorders: {
                        type: 'object',
                        description:
                            'CellBorders: { top?, right?, bottom?, left?, all?, color?, '
                            + "width?, style?: 'solid'|'dashed'|'dotted' }.",
                    },
                    cellVAlign: { enum: ['top', 'middle', 'bottom'] },
                },
            },
        ],
    };
}

/** `['img', body]` */
function imageBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'ImageSpec',
        minItems: 2,
        maxItems: 2,
        prefixItems: [
            { const: 'img' },
            {
                type: 'object',
                required: ['data'],
                description: 'Image body: { data: Uint8Array, width?, height?, align?, alt? }.',
            },
        ],
    };
}

/** `['link', text, opts]` */
function linkBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'LinkSpec',
        minItems: 3,
        maxItems: 3,
        prefixItems: [
            { const: 'link' },
            { type: 'string', description: 'Link text.' },
            {
                type: 'object',
                description: 'Options; one of url/href is required.',
                properties: {
                    url: { type: 'string' },
                    href: { type: 'string' },
                },
            },
        ],
    };
}

/** `['sp', height?]` */
function spacerBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'SpacerSpec',
        minItems: 1,
        maxItems: 2,
        prefixItems: [{ const: 'sp' }, { type: 'number', description: 'Height in points.' }],
    };
}

/** `['br']` */
function pageBreakBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'PageBreakSpec',
        minItems: 1,
        maxItems: 1,
        prefixItems: [{ const: 'br' }],
    };
}

/** `['page', blocks]` */
function pageBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'PageSpec',
        minItems: 2,
        maxItems: 2,
        prefixItems: [
            { const: 'page' },
            { type: 'array', description: 'Nested blocks for this page.', items: { $ref: '#/$defs/block' } },
        ],
    };
}

/** `['toc', opts?]` */
function tocBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'TocSpec',
        minItems: 1,
        maxItems: 2,
        prefixItems: [
            { const: 'toc' },
            { type: 'object', description: 'Optional { title, maxLevel, fontSize, indent }.' },
        ],
    };
}

/** `['qr' | 'code128' | 'ean13' | 'pdf417' | 'datamatrix', data, opts?]` */
function barcodeBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'BarcodeSpec',
        minItems: 2,
        maxItems: 3,
        prefixItems: [
            { enum: ['qr', 'code128', 'ean13', 'pdf417', 'datamatrix'] },
            { type: 'string', description: 'Data to encode.' },
            { type: 'object', description: 'Optional { width, height, align, ecLevel, pdf417ECLevel }.' },
        ],
    };
}

/** `['svg', data, opts?]` */
function svgBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'SvgSpec',
        minItems: 2,
        maxItems: 3,
        prefixItems: [
            { const: 'svg' },
            { type: 'string', description: 'SVG path data or inline markup.' },
            { type: 'object', description: 'Optional { width, height, align, viewBox, fill, stroke, strokeWidth }.' },
        ],
    };
}

/** `['field', body]` */
function fieldBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'FormFieldSpec',
        minItems: 2,
        maxItems: 2,
        prefixItems: [
            { const: 'field' },
            {
                type: 'object',
                required: ['fieldType', 'name'],
                description: 'Form-field body: { fieldType, name, label?, value?, options?, … }.',
            },
        ],
    };
}

/**
 * Return the JSON Schema (Draft 2020-12) describing the {@link DocSpec} authoring
 * format. The `$id` embeds the current package version.
 */
export function docSpecSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId(),
        title: 'pdfnative-react DocSpec',
        description:
            'Compact, token-frugal document specification. Compiles to the same '
            + 'pdfnative model as the JSX components.',
        type: 'object',
        required: ['blocks'],
        properties: {
            title: { type: 'string' },
            footerText: { type: 'string' },
            metadata: { type: 'object', description: 'DocumentMetadata.' },
            fontEntries: { type: 'array', items: { type: 'object' } },
            layout: { type: 'object', description: 'PdfLayoutOptions overrides.' },
            outline: {
                oneOf: [
                    { const: 'auto', description: 'Derive a flat outline from every heading.' },
                    { type: 'array', items: { $ref: '#/$defs/outlineItem' } },
                ],
                description: 'Document outline / bookmarks.',
            },
            pageLabels: {
                type: 'array',
                description: 'PageLabelRange[] — viewer page numbering.',
                items: {
                    type: 'object',
                    required: ['startPage'],
                    properties: {
                        startPage: { type: 'integer', minimum: 0 },
                        style: { enum: ['decimal', 'roman', 'Roman', 'alpha', 'Alpha', 'none'] },
                        prefix: { type: 'string' },
                        start: { type: 'integer', minimum: 1 },
                    },
                },
            },
            blocks: {
                type: 'array',
                description: 'Ordered document blocks (positional tuples).',
                items: { $ref: '#/$defs/block' },
            },
        },
        $defs: {
            listItem: listItemDef(),
            outlineItem: outlineItemDef(),
            block: {
                oneOf: [
                    headingBlock(),
                    paragraphBlock(),
                    listBlock(),
                    tableBlock(),
                    imageBlock(),
                    linkBlock(),
                    spacerBlock(),
                    pageBreakBlock(),
                    pageBlock(),
                    tocBlock(),
                    barcodeBlock(),
                    svgBlock(),
                    fieldBlock(),
                ],
            },
        },
    };
}

/** The `$id` (versioned URL) of the current {@link docSpecSchema}. */
export function docSpecSchemaId(): string {
    return schemaId();
}

// Re-export the type for convenience at the schema entry point.
export type { DocSpec };
