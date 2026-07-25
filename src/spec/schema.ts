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
import {
    BLOCK_REGISTRY,
    LINT_RULES,
    LINT_RULE_CODES,
    type BlockGroupId,
} from '../registry.js';
import { ErrorCode, PdfReactError } from '../errors.js';
import type { DocSpec } from './types.js';

/** A read-only JSON Schema fragment. */
export type JsonSchema = Readonly<Record<string, unknown>>;

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const ID_BASE = 'https://pdfnative.dev/schema/react';

/**
 * Every schema this package can emit.
 *
 * `'list'` is the self-describing index — ask for it first when you do not know
 * what is available.
 */
export const SCHEMA_SUBJECTS = [
    'doc-spec',
    'render-options',
    'lint-report',
    'spec-validation',
    'doctor',
    'manifest',
    'list',
] as const;

/** A subject accepted by {@link schema} / {@link schemaId}. */
export type SchemaSubject = (typeof SCHEMA_SUBJECTS)[number];

/**
 * The versioned `$id` for a subject, e.g.
 * `https://pdfnative.dev/schema/react/1.1.0/doc-spec.schema.json`.
 *
 * The version is embedded deliberately: a consumer that caches a schema can
 * detect contract drift by comparing `$id`s alone.
 */
export function schemaId(subject: SchemaSubject = 'doc-spec'): string {
    return `${ID_BASE}/${version}/${subject}.schema.json`;
}

/** `['h1' | 'h2' | 'h3', text, opts?]` */
function headingBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'HeadingSpec',
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

/** A header/footer template with `{page}`, `{pages}`, `{date}`, `{title}` placeholders. */
function pageTemplateDef(): JsonSchema {
    return {
        type: 'object',
        description:
            'PageTemplate. Placeholders: {page}, {pages}, {date}, {title}.',
        properties: {
            left: { type: 'string' },
            center: { type: 'string' },
            right: { type: 'string' },
            fontSize: { type: 'number', description: 'Default 7.' },
            color: { type: ['string', 'array'] },
        },
    };
}

/** `['table', body]` */
function tableBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'TableSpec',
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
        prefixItems: [{ const: 'sp' }, { type: 'number', description: 'Height in points.' }],
    };
}

/** `['br']` */
function pageBreakBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'PageBreakSpec',
        prefixItems: [{ const: 'br' }],
    };
}

/** `['page', blocks]` */
function pageBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'PageSpec',
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
        prefixItems: [
            { const: 'svg' },
            { type: 'string', description: 'SVG path data or inline markup.' },
            { type: 'object', description: 'Optional { width, height, align, viewBox, fill, stroke, strokeWidth }.' },
        ],
    };
}

/** `['chart', body]` */
function chartBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'ChartSpec',
        prefixItems: [
            { const: 'chart' },
            {
                type: 'object',
                required: ['chartType', 'series'],
                description:
                    'Chart body. Pie/donut take exactly one series with non-negative values.',
                properties: {
                    chartType: { enum: ['bar', 'barH', 'line', 'pie', 'donut'] },
                    series: {
                        type: 'array',
                        minItems: 1,
                        description: 'Data series; each value array matches `categories` in length.',
                        items: {
                            type: 'object',
                            required: ['label', 'values'],
                            properties: {
                                label: { type: 'string', description: 'Series label (legend).' },
                                values: { type: 'array', items: { type: 'number' } },
                                color: { type: ['string', 'array'] },
                            },
                        },
                    },
                    categories: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Category / slice labels. Defaults to 1-based indices.',
                    },
                    width: { type: 'number', description: 'Plot width in points. Default 460.' },
                    height: { type: 'number', description: 'Plot height in points. Default 240.' },
                    title: { type: 'string' },
                    legend: { enum: ['bottom', 'none'] },
                    axis: {
                        type: 'object',
                        description: 'Value-axis options (bar/line only).',
                        properties: {
                            yMin: { type: 'number' },
                            yMax: { type: 'number' },
                            ticks: { type: 'integer', minimum: 2 },
                            grid: { type: 'boolean' },
                        },
                    },
                    markers: { type: 'boolean', description: 'Point markers on line series.' },
                    colors: { type: 'array', description: 'Palette override (PdfColor[]).' },
                    align: { enum: ['left', 'center', 'right'] },
                    altText: {
                        type: 'string',
                        description: 'Tagged-PDF /Figure /Alt text. Auto-generated when omitted.',
                    },
                },
            },
        ],
    };
}

/** `['field', body]` */
function fieldBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'FormFieldSpec',
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
 * Per-group schema builders, keyed by {@link BlockGroupId}.
 *
 * The `satisfies` clause is the anti-drift lock: registering a new block in
 * `BLOCK_REGISTRY` without adding its builder here is a compile error, and
 * vice-versa.
 */
const BLOCK_SCHEMAS = {
    heading: headingBlock,
    paragraph: paragraphBlock,
    list: listBlock,
    table: tableBlock,
    image: imageBlock,
    link: linkBlock,
    spacer: spacerBlock,
    pageBreak: pageBreakBlock,
    page: pageBlock,
    toc: tocBlock,
    barcode: barcodeBlock,
    svg: svgBlock,
    chart: chartBlock,
    field: fieldBlock,
} satisfies Record<BlockGroupId, () => JsonSchema>;

/**
 * Assemble `$defs.block.oneOf` in {@link BLOCK_REGISTRY} order.
 *
 * Tuple arity and the one-line description come from the registry, not from the
 * builders — the builders describe *shape*, the registry owns the *contract*,
 * so the schema and `validateSpec` can never disagree about how long a tuple is.
 */
function blockDefs(): readonly JsonSchema[] {
    return BLOCK_REGISTRY.map((entry) => {
        const built = BLOCK_SCHEMAS[entry.id]();
        const prefixItems = [...(built['prefixItems'] as JsonSchema[])];

        // Overwrite the kind discriminator from the registry rather than trusting
        // the builder's hardcoded literal. Without this the `satisfies` lock only
        // covers *group ids*: a new kind could be added to `BLOCK_REGISTRY` and
        // accepted by `validateSpec` while the schema still advertised the old
        // enum — the two claiming to be derived from one source while disagreeing.
        prefixItems[0] =
            entry.kinds.length === 1
                ? { const: entry.kinds[0] }
                : { enum: [...entry.kinds] };

        return {
            ...built,
            prefixItems,
            description: entry.summary,
            minItems: entry.minItems,
            maxItems: entry.maxItems,
        };
    });
}

/**
 * Return the JSON Schema (Draft 2020-12) describing the {@link DocSpec} authoring
 * format. The `$id` embeds the current package version.
 */
export function docSpecSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('doc-spec'),
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
            watermark: {
                oneOf: [
                    { type: 'string', description: 'Shorthand for { text: { text: … } }.' },
                    {
                        type: 'object',
                        description: 'WatermarkOptions: { text?, image?, position? }.',
                        properties: {
                            text: {
                                type: 'object',
                                required: ['text'],
                                properties: {
                                    text: { type: 'string' },
                                    fontSize: { type: 'number' },
                                    color: { type: ['string', 'array'] },
                                    opacity: { type: 'number', minimum: 0, maximum: 1 },
                                    angle: { type: 'number' },
                                    autoFit: { type: 'boolean' },
                                },
                            },
                            image: {
                                type: 'object',
                                required: ['data'],
                                description: '{ data: Uint8Array, opacity?, width?, height? }.',
                            },
                            position: { enum: ['background', 'foreground'] },
                        },
                    },
                ],
                description: 'Watermark repeated on every page. Sugar over layout.watermark.',
            },
            header: { $ref: '#/$defs/pageTemplate', description: 'Running page header.' },
            footer: { $ref: '#/$defs/pageTemplate', description: 'Running page footer.' },
            attachments: {
                type: 'array',
                description: 'Embedded file attachments (PDF/A-3).',
                items: {
                    type: 'object',
                    required: ['filename', 'data', 'mimeType'],
                    properties: {
                        filename: { type: 'string' },
                        data: { description: 'File content as Uint8Array.' },
                        mimeType: { type: 'string' },
                        description: { type: 'string' },
                        relationship: {
                            enum: ['Source', 'Data', 'Alternative', 'Supplement', 'Unspecified'],
                        },
                    },
                },
            },
            tagged: {
                oneOf: [
                    { type: 'boolean' },
                    { enum: ['pdfa1b', 'pdfa2b', 'pdfa2u', 'pdfa3b'] },
                ],
                description:
                    'Emit a tagged (accessible) PDF, optionally at a PDF/A conformance level. '
                    + 'PDF/A requires every rendering font to be embedded via fontEntries.',
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
            pageTemplate: pageTemplateDef(),
            block: { oneOf: blockDefs() },
        },
    };
}

/** The `$id` (versioned URL) of the current {@link docSpecSchema}. */
export function docSpecSchemaId(): string {
    return schemaId('doc-spec');
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional subjects — the report and option shapes an agent branches on
// ─────────────────────────────────────────────────────────────────────────────

/** Options accepted by every render entry point. */
function renderOptionsSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('render-options'),
        title: 'pdfnative-react RenderOptions',
        description:
            'Options accepted by renderToBytes/Blob/Stream/File/FileStream/Response and '
            + 'their renderSpec* twins.',
        type: 'object',
        properties: {
            layout: {
                type: 'object',
                description:
                    'PdfLayoutOptions overrides: pageWidth, pageHeight, margins, columns, '
                    + 'colors, fontSizes, tagged, encryption, compress, headerTemplate, '
                    + 'footerTemplate, watermark, attachments, maxBlocks, normalize, '
                    + 'creationDate, viewerPreferences, debug.',
            },
            fontEntries: {
                type: 'array',
                items: { type: 'object' },
                description: 'Pre-loaded font entries (see resolveFonts).',
            },
            fonts: {
                type: 'object',
                description:
                    'Map of language key → dynamic font-module loader. Honoured only by the '
                    + 'async entry points; synchronous ones need fontEntries.',
            },
        },
    };
}

/** The shape returned by `lintDocument` / `lintSpec`. */
function lintReportSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('lint-report'),
        title: 'pdfnative-react LintReport',
        description: 'Accessibility and layout findings produced by lintDocument/lintSpec.',
        type: 'object',
        required: ['ok', 'findings', 'counts'],
        properties: {
            ok: { type: 'boolean', description: 'True when no finding has severity "error".' },
            counts: {
                type: 'object',
                required: ['error', 'warning', 'info'],
                properties: {
                    error: { type: 'integer', minimum: 0 },
                    warning: { type: 'integer', minimum: 0 },
                    info: { type: 'integer', minimum: 0 },
                },
            },
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['code', 'severity', 'message'],
                    properties: {
                        code: {
                            enum: [...LINT_RULE_CODES],
                            description: 'Stable rule identifier — branch on this, not the message.',
                        },
                        severity: { enum: ['error', 'warning', 'info'] },
                        message: { type: 'string' },
                        blockIndex: { type: 'integer', minimum: 0 },
                        hint: { type: 'string' },
                    },
                },
            },
        },
        $defs: {
            rules: {
                description: 'The full rule registry: code → severity + description.',
                // A fresh copy, never the live `LINT_RULES` object. Schema tooling
                // routinely walks and annotates a returned document ($id rewriting,
                // $ref dereferencing); handing out the registry by reference would
                // let that mutate every subsequent lint severity process-wide.
                const: Object.fromEntries(
                    LINT_RULE_CODES.map((code) => [
                        code,
                        { severity: LINT_RULES[code].severity, description: LINT_RULES[code].description },
                    ]),
                ),
            },
        },
    };
}

/** The shape returned by `validateSpec`. */
function specValidationSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('spec-validation'),
        title: 'pdfnative-react SpecValidation',
        description: 'Structural findings produced by validateSpec (the dry-run tier).',
        type: 'object',
        required: ['ok', 'errors', 'warnings'],
        properties: {
            ok: { type: 'boolean' },
            errors: { type: 'array', items: { $ref: '#/$defs/finding' } },
            warnings: { type: 'array', items: { $ref: '#/$defs/finding' } },
        },
        $defs: {
            finding: {
                type: 'object',
                required: ['code', 'severity', 'path', 'message'],
                properties: {
                    code: {
                        enum: [
                            'V_NOT_OBJECT',
                            'V_BLOCKS',
                            'V_BLOCK_SHAPE',
                            'V_UNKNOWN_KIND',
                            'V_ARITY',
                            'V_PAYLOAD_TYPE',
                            'V_OPTS_TYPE',
                            'V_UNKNOWN_FIELD',
                            'V_TOO_DEEP',
                        ],
                    },
                    severity: { enum: ['error', 'warning'] },
                    path: { type: 'string', description: 'e.g. "blocks[3][1]".' },
                    message: { type: 'string' },
                },
            },
        },
    };
}

/** The shape returned by `doctor`. */
function doctorSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('doctor'),
        title: 'pdfnative-react DoctorReport',
        description: 'Environment pre-flight report produced by doctor().',
        type: 'object',
        required: ['ok', 'checks'],
        properties: {
            ok: { type: 'boolean', description: 'True when no check has status "error".' },
            checks: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['name', 'status', 'value', 'detail'],
                    properties: {
                        name: { type: 'string' },
                        status: { enum: ['ok', 'warn', 'error'] },
                        value: { type: 'string' },
                        detail: { type: 'string' },
                    },
                },
            },
        },
    };
}

/** The shape returned by `capabilityManifest`. */
function manifestSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('manifest'),
        title: 'pdfnative-react CapabilityManifest',
        description:
            'Machine-readable description of everything this package can do. Fetch it with '
            + 'capabilityManifest() to register pdfnative-react as an agent tool set.',
        type: 'object',
        required: ['kind', 'name', 'version', 'contract', 'components', 'specBlocks', 'entrypoints'],
        properties: {
            kind: { const: 'capability-manifest' },
            name: { const: 'pdfnative-react' },
            version: { type: 'string' },
            schemaId: { type: 'string' },
            contract: { type: 'object' },
            components: { type: 'array', items: { type: 'object' } },
            specBlocks: { type: 'array', items: { type: 'object' } },
            entrypoints: { type: 'array', items: { type: 'object' } },
            errorCodes: { type: 'array', items: { type: 'string' } },
            lintRules: { type: 'array', items: { type: 'object' } },
        },
    };
}

/** The self-describing index of available subjects. */
function listSchema(): JsonSchema {
    return {
        $schema: DRAFT,
        $id: schemaId('list'),
        title: 'pdfnative-react schema subjects',
        description: 'The subjects accepted by schema(subject).',
        type: 'object',
        required: ['subjects'],
        properties: {
            subjects: {
                type: 'array',
                items: { enum: [...SCHEMA_SUBJECTS] },
            },
        },
        examples: [{ subjects: [...SCHEMA_SUBJECTS] }],
    };
}

/** Subject → builder. `satisfies` keeps this exhaustive against the subject union. */
const SUBJECT_SCHEMAS = {
    'doc-spec': docSpecSchema,
    'render-options': renderOptionsSchema,
    'lint-report': lintReportSchema,
    'spec-validation': specValidationSchema,
    doctor: doctorSchema,
    manifest: manifestSchema,
    list: listSchema,
} satisfies Record<SchemaSubject, () => JsonSchema>;

/**
 * Return the JSON Schema (Draft 2020-12) for a subject.
 *
 * Every schema is pure data with a versioned `$id`; no validator is bundled, so
 * this stays dependency-free. Validate with whatever tooling you already have.
 *
 * `schema('manifest')` returns the *schema of* the capability manifest — call
 * {@link capabilityManifest} for the manifest itself.
 *
 * @param subject - Defaults to `'doc-spec'`, the one you almost always want.
 * @throws PdfReactError with code `E_INPUT` when the subject is unknown.
 *
 * @example
 * ```ts
 * const subjects = schema('list').examples;   // discover what is available
 * const docSpec = schema();                   // the DocSpec grammar
 * ```
 */
export function schema(subject: SchemaSubject = 'doc-spec'): JsonSchema {
    // `Object.hasOwn`, not `SUBJECT_SCHEMAS[subject] !== undefined`: this is the
    // one API explicitly designed to be called with a model-generated string,
    // and a plain-object lookup would happily resolve 'toString' or
    // 'constructor' through Object.prototype and return something that is not a
    // schema at all.
    if (!Object.hasOwn(SUBJECT_SCHEMAS, subject)) {
        throw new PdfReactError(
            `Unknown schema subject ${JSON.stringify(subject)}. Valid subjects: ${SCHEMA_SUBJECTS.join(', ')}.`,
            ErrorCode.INPUT,
        );
    }
    return SUBJECT_SCHEMAS[subject]();
}

// Re-export the type for convenience at the schema entry point.
export type { DocSpec };
