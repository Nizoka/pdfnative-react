/**
 * Versioned JSON Schema (Draft 2020-12) for the compact {@link DocSpec} authoring
 * format, so agents and tooling can self-validate a spec before rendering.
 *
 * Pure data — zero runtime deps, no validator is bundled — and versioned via a
 * `$id` that embeds the package version, so drift is detectable and pinned by a
 * test.
 *
 * The per-block *shapes* are hand-authored here, but the **contract** is not:
 * `blockDefs()` sources each tuple's kind discriminator, arity and description
 * from `BLOCK_REGISTRY`, and the `lint-report` enum from `LINT_RULE_CODES`. A
 * builder cannot disagree with the registry, because the registry overwrites it.
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

/** A `$ref` to the shared colour definition. */
const COLOR = { $ref: '#/$defs/color' } as const;

/** A `$ref` to the process-only colour definition (outline bookmarks). */
const PROCESS_COLOR = { $ref: '#/$defs/processColor' } as const;

/**
 * Every colour form the engine accepts (`PdfColor`). Since engine 1.8.0 a
 * four-element tuple (percent) or a four-operand string is DeviceCMYK; since
 * 1.9.0 `{ spot, tint? }` and `{ inks }` paint through declared spot inks.
 */
function colorDef(): JsonSchema {
    return {
        description:
            "PdfColor: '#RRGGBB' hex, [r, g, b] 0–255, 'r g b' operands 0–1, "
            + "[c, m, y, k] percent 0–100 (DeviceCMYK, engine >= 1.8.0), "
            + "'c m y k' operands 0–1 (DeviceCMYK, engine >= 1.8.0), "
            + '{ spot: name, tint?: 0–1 } (a /Separation over an ink declared in '
            + 'print.spotColours, engine >= 1.9.0), or { inks: { name: tint, … } } '
            + '(a /DeviceN mix of declared inks, all with CMYK or all with RGB '
            + 'alternates, engine >= 1.9.0). The component count selects the '
            + 'colour space: three is RGB, four is CMYK. An undeclared ink is '
            + 'lint L_SPOT_UNDECLARED before it is an engine throw.',
        anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 4 },
            {
                type: 'object',
                required: ['spot'],
                properties: {
                    spot: { type: 'string', minLength: 1, description: 'Declared ink name (non-empty).' },
                    tint: { type: 'number', minimum: 0, maximum: 1, description: 'Tint 0–1; default 1 (solid).' },
                },
            },
            {
                type: 'object',
                required: ['inks'],
                properties: {
                    inks: {
                        type: 'object',
                        description: 'Ink name → tint 0–1; every ink declared in print.spotColours.',
                        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
                    },
                },
            },
        ],
    };
}

/**
 * The process-colour forms alone — hex, RGB or CMYK, as a tuple or an operand
 * string. An outline bookmark colour (`/C`) is an RGB triple by the PDF
 * specification (ISO 32000-1 §12.3.3): the engine approximates a CMYK value
 * and refuses a spot or ink-mix value (`An outline colour (/C) is a process
 * RGB colour …`), so the schema refuses them one tier earlier.
 */
function processColorDef(): JsonSchema {
    return {
        description:
            "A process colour: '#RRGGBB' hex, [r, g, b] 0–255, 'r g b' operands 0–1, "
            + "[c, m, y, k] percent 0–100 or 'c m y k' operands 0–1 (CMYK approximated). "
            + 'Outline bookmark colours are RGB by the PDF specification: the { spot } '
            + 'and { inks } forms do not apply here (the engine throws).',
        anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 4 },
        ],
    };
}

/** `TextDirection` (engine ≥ 1.9.0): the base direction of a paragraph. */
function directionDef(description: string): JsonSchema {
    return { enum: ['auto', 'ltr', 'rtl'], description };
}

/** The OpenType single-substitution features the engine can apply. */
const FONT_FEATURE_TAGS = [
    'tnum', 'pnum', 'lnum', 'onum', 'zero', 'ordn', 'sups', 'subs', 'smcp', 'c2sc', 'case',
] as const;

/** `TypographyOptions` (engine ≥ 1.8.0) — every key opt-in. */
function typographyDef(): JsonSchema {
    return {
        type: 'object',
        description:
            'TypographyOptions (engine >= 1.8.0). Every key is opt-in; omitted, the '
            + 'output is byte-identical to earlier releases. kerning, fontFeatures and '
            + "the 'fr' preset need a registered font (fontEntries); metrics 'exact' "
            + 'acts on base-14 text only; no hyphenation dictionary ships.',
        properties: {
            splitParagraphs: {
                type: 'boolean',
                description: 'Let paragraphs break across pages at a line boundary. Default false.',
            },
            orphans: {
                type: 'integer',
                minimum: 1,
                description: 'Minimum lines left at the foot of a page (needs splitParagraphs). Default 2.',
            },
            widows: {
                type: 'integer',
                minimum: 1,
                description: 'Minimum lines carried to the next page (needs splitParagraphs). Default 2.',
            },
            keepHeadingsWithNext: {
                description:
                    'Keep every heading with what follows: true (two lines), or '
                    + '{ minLines } to reserve more. Per-block override: keepWithNext.',
                oneOf: [
                    { type: 'boolean' },
                    {
                        type: 'object',
                        properties: { minLines: { type: 'integer', minimum: 1 } },
                    },
                ],
            },
            unitBinding: {
                description:
                    'Bind numbers to the unit symbol that follows (ISO 80000-1): true for '
                    + 'the built-in list, or { units } to replace it.',
                oneOf: [
                    { type: 'boolean' },
                    {
                        type: 'object',
                        properties: { units: { type: 'array', items: { type: 'string' } } },
                    },
                ],
            },
            bindShortWords: {
                description:
                    'Bind short words to the next word with a no-break space: true for '
                    + 'one-letter words, or { maxLength (1–3), words }.',
                oneOf: [
                    { type: 'boolean' },
                    {
                        type: 'object',
                        properties: {
                            maxLength: { type: 'integer', minimum: 1, maximum: 3 },
                            words: { type: 'array', items: { type: 'string' } },
                        },
                    },
                ],
            },
            punctuationSpacing: {
                description:
                    "No-break spaces around punctuation: the 'fr' or 'fr-CA' preset, or "
                    + 'explicit rules [{ char, side, space }].',
                oneOf: [
                    { enum: ['fr', 'fr-CA'] },
                    {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['char', 'side', 'space'],
                            properties: {
                                char: { type: 'string' },
                                side: { enum: ['before', 'after'] },
                                space: { enum: ['nbsp', 'narrow'] },
                            },
                        },
                    },
                ],
            },
            opticalMargins: {
                type: 'boolean',
                description: 'Hang leading/trailing punctuation past the margin. Default false.',
            },
            metrics: {
                enum: ['approximate', 'exact'],
                description: "Base-14 advance widths: 'exact' reads the Adobe Core 14 AFM tables.",
            },
            fontFeatures: {
                type: 'array',
                items: { enum: [...FONT_FEATURE_TAGS] },
                description: 'OpenType single-substitution features to apply (registered fonts only).',
            },
            kerning: {
                type: 'boolean',
                description: "Apply the font's pair kerning (registered fonts only). Default false.",
            },
            hyphenationLanguage: {
                type: 'string',
                description: 'BCP 47 tag handed to the installed hyphenation provider.',
            },
        },
    };
}

/** `CustomOutputIntent` — an ICC profile plus its identification. */
function outputIntentDef(): JsonSchema {
    return {
        type: 'object',
        required: ['iccProfile', 'outputConditionIdentifier'],
        description:
            'CustomOutputIntent. iccProfile is the full ICC file (Uint8Array; the engine '
            + 'checks the acsp signature and the size field). Under tagged (PDF/A) any '
            + 'RGB/CMYK/Gray profile; under pdfx a printer (prtr) profile is required. '
            + 'pdfnative ships no press profile.',
        properties: {
            iccProfile: { description: 'ICC profile bytes as Uint8Array.' },
            outputConditionIdentifier: { type: 'string' },
            registryName: { type: 'string' },
            outputCondition: { type: 'string' },
            info: { type: 'string' },
        },
    };
}

/** `['h1' | 'h2' | 'h3', text, opts?]` */
function headingBlock(): JsonSchema {
    return {
        type: 'array',
        title: 'HeadingSpec',
        prefixItems: [
            { enum: ['h1', 'h2', 'h3'] },
            { type: 'string', description: 'Heading text.' },
            {
                type: 'object',
                description: 'Optional { color, keepWithNext }.',
                properties: {
                    color: COLOR,
                    keepWithNext: {
                        type: 'boolean',
                        description: 'Keep with the following block (engine >= 1.8.0).',
                    },
                },
            },
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
            {
                type: 'object',
                description:
                    'Optional { fontSize, lineHeight, align, indent, color, keepWithNext, '
                    + 'splittable, direction }.',
                properties: {
                    fontSize: { type: 'number' },
                    lineHeight: { type: 'number' },
                    align: {
                        enum: ['left', 'center', 'right', 'justify'],
                        description: "'justify' needs engine >= 1.8.0.",
                    },
                    indent: { type: 'number' },
                    color: COLOR,
                    keepWithNext: {
                        type: 'boolean',
                        description: 'Keep with the following block (engine >= 1.8.0).',
                    },
                    splittable: {
                        type: 'boolean',
                        description:
                            'Override typography.splitParagraphs for this block (engine >= 1.8.0).',
                    },
                    direction: directionDef(
                        'Base text direction of this paragraph, overriding the document '
                        + "direction: 'auto' (first strong character), 'ltr' or 'rtl' "
                        + '(engine >= 1.9.0).',
                    ),
                },
            },
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
            color: PROCESS_COLOR,
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
            color: COLOR,
        },
    };
}

/** A print-production page box: `[llx, lly, urx, ury]` in points. */
function printBoxDef(what: string): JsonSchema {
    return {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: { type: 'number' },
        description: `${what} as [llx, lly, urx, ury] in points, within the MediaBox.`,
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
                    zebra: { oneOf: [{ type: 'boolean' }, COLOR] },
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
                description:
                    'Image body: { data: Uint8Array, width?, height?, align?, alt? }. data is '
                    + 'JPEG, PNG without an alpha channel (colour types 0, 2 and 3; the engine '
                    + 'refuses types 4 and 6 — flatten the transparency first) or JPEG 2000 '
                    + '(JP2 file or J2K codestream, passed through as /JPXDecode with a PDF 1.5 '
                    + 'header; engine >= 1.9.0; not under pdfa1b — lint L_PDFA_JPX_IMAGE).',
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
                description: 'Options; one of url/href is required. Also accepts fontSize and color.',
                properties: {
                    url: { type: 'string' },
                    href: { type: 'string' },
                    fontSize: { type: 'number' },
                    color: COLOR,
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
            { type: 'object', description: 'Optional { width, height, align, viewBox, fill, stroke, strokeWidth, alt }.' },
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
                    chartType: {
                        enum: [
                            'bar', 'barH', 'line', 'pie', 'donut',
                            'stackedBar', 'stackedBarH', 'area', 'scatter',
                        ],
                    },
                    series: {
                        type: 'array',
                        minItems: 1,
                        description: 'Data series; each value array matches `categories` in length.',
                        items: {
                            type: 'object',
                            required: ['values'],
                            properties: {
                                label: {
                                    type: 'string',
                                    description:
                                        'Series label (legend). Optional since engine 1.9.0: an '
                                        + "unnamed series is listed as 'Series N'.",
                                },
                                values: { type: 'array', items: { type: 'number' } },
                                color: COLOR,
                                colors: {
                                    type: 'array',
                                    items: COLOR,
                                    description:
                                        'One colour per value on bar/barH/stackedBar/stackedBarH '
                                        + '(engine >= 1.9.0); must match values in length (lint '
                                        + 'L_CHART_SERIES_COLORS, an engine throw). The other kinds '
                                        + 'ignore it; the legend swatch keeps color.',
                                },
                                xValues: {
                                    type: 'array',
                                    items: { type: ['number', 'string'] },
                                    description:
                                        'Per-point x positions for linear/time axes. '
                                        + 'Required for scatter; same length as values.',
                                },
                                yAxis: {
                                    enum: ['left', 'right'],
                                    description: 'Which value axis this series binds to. Default left.',
                                },
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
                        description: 'Primary (left) value-axis options.',
                        properties: {
                            yMin: { type: 'number' },
                            yMax: { type: 'number' },
                            ticks: { type: 'integer', minimum: 2 },
                            grid: { type: 'boolean' },
                            scale: {
                                enum: ['linear', 'log'],
                                description:
                                    'Log scale requires strictly positive values; '
                                    + 'incompatible with stacked kinds. Default linear.',
                            },
                        },
                    },
                    axis2: {
                        type: 'object',
                        description:
                            'Secondary right value axis; rendered only when a series '
                            + 'binds to it with yAxis "right".',
                        properties: {
                            yMin: { type: 'number' },
                            yMax: { type: 'number' },
                            ticks: { type: 'integer', minimum: 2 },
                            scale: { enum: ['linear', 'log'] },
                        },
                    },
                    xAxis: {
                        type: 'object',
                        description:
                            'X-axis options. "linear"/"time" position points by series '
                            + 'xValues ("time" parses ISO-8601 or epoch ms, UTC ticks). '
                            + 'Default "category" ("linear" for scatter).',
                        properties: {
                            type: { enum: ['category', 'linear', 'time'] },
                            min: { type: ['number', 'string'] },
                            max: { type: ['number', 'string'] },
                            ticks: { type: 'integer', minimum: 2 },
                            grid: { type: 'boolean' },
                        },
                    },
                    dataLabels: {
                        description:
                            'Per-point value labels: true for defaults, or '
                            + '{ decimals?, prefix?, suffix? }.',
                        oneOf: [
                            { type: 'boolean' },
                            {
                                type: 'object',
                                properties: {
                                    decimals: { type: 'integer', minimum: 0 },
                                    prefix: { type: 'string' },
                                    suffix: { type: 'string' },
                                },
                            },
                        ],
                    },
                    labelStride: {
                        type: 'integer',
                        minimum: 1,
                        description:
                            'Draw every Nth x-label. Defaults to the smallest '
                            + 'non-overlapping stride; 1 forces every label.',
                    },
                    labelRotation: {
                        type: 'number',
                        minimum: 0,
                        maximum: 90,
                        description: 'Rotate x-labels counter-clockwise (degrees).',
                    },
                    markers: { type: 'boolean', description: 'Point markers on line series.' },
                    colors: {
                        type: 'array',
                        items: COLOR,
                        description: 'Palette override (PdfColor[]; CMYK forms accepted).',
                    },
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
                description: "Form-field body: { fieldType, name, label?, value?, options?, … }. fieldType is the engine's FormFieldType: 'text' | 'multilineText' | 'checkbox' | 'radio' | 'dropdown' | 'listbox' (options for dropdown, listbox and radio).",
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
        // The property set is held to `DOC_SPEC_FIELDS` (the registry) by
        // `tests/registry.test.ts`, so a field `validateSpec` accepts can never
        // be invisible here.
        properties: {
            title: { type: 'string', description: 'Document title: the /Title entry and the {title} placeholder of the page templates.' },
            footerText: { type: 'string', description: 'A plain centred footer line on every page (sugar over footer.center).' },
            metadata: {
                type: 'object',
                description:
                    "DocumentMetadata: { author?, subject?, keywords?, trapped? "
                    + "('True' | 'False' | 'Unknown') }. Under pdfx, trapped must be "
                    + "'True' or 'False'.",
            },
            fontEntries: {
                type: 'array',
                items: { type: 'object' },
                description:
                    'Embedded fonts (FontEntry[]): the result of resolveFonts({ ar, he, hi, ja, … }) '
                    + 'or the engine font modules, serialized as objects. Required for every '
                    + 'PDF/A level (tagged) and for any text outside the base-14 repertoire.',
            },
            layout: {
                type: 'object',
                description:
                    'PdfLayoutOptions overrides. Includes strict (escalate PDF/A and '
                    + 'PDF/X diagnostics to errors, JSON-safe), outputIntent (custom ICC '
                    + 'profile; RGB, CMYK or Gray), typography, pdfx, creationDate, '
                    + "direction ('auto' | 'ltr' | 'rtl', engine >= 1.9.0), actualText "
                    + '(false opts out of the untagged /Span /ActualText the engine writes '
                    + 'on reordered and right-to-left runs since 1.9.0) and colors (every '
                    + 'entry accepts the CMYK and spot forms); onDiagnostic is '
                    + 'function-valued and not representable in JSON — set it from code.',
            },
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
                                    color: COLOR,
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
                    + "true is the engine's default claim, PDF/A-2b — the same bytes as 'pdfa2b'; "
                    + "the PDF/A lint rules (L_TAGGED_NO_FONTS, L_TAGGED_FORM_FONTS, L_PDFA_JPX_IMAGE) "
                    + 'evaluate the string levels only, so name the level to get the pre-flight. '
                    + 'PDF/A requires every rendering font to be embedded via fontEntries. '
                    + "'pdfa2b' and 'pdfa2u' combine with pdfx (one file, both claims; "
                    + "engine >= 1.9.0); 'pdfa1b' and 'pdfa3b' do not.",
            },
            pdfx: {
                const: 'pdfx4',
                description:
                    'Claim PDF/X-4 conformance (ISO 15930-7; engine >= 1.8.0). Sugar over '
                    + 'layout.pdfx. Needs outputIntent (a prtr press profile), '
                    + "metadata.trapped 'True' or 'False', fontEntries, and a TrimBox or an "
                    + "ArtBox (not both); exclusive with layout.encryption and with tagged "
                    + "'pdfa1b' / 'pdfa3b' (combines with 'pdfa2b' / 'pdfa2u' since engine "
                    + '1.9.0). Every constraint is an L_PDFX_* lint rule.',
            },
            outputIntent: {
                $ref: '#/$defs/outputIntent',
                description: 'Custom output intent. Sugar over layout.outputIntent.',
            },
            typography: {
                $ref: '#/$defs/typography',
                description: 'Fine typography (engine >= 1.8.0). Sugar over layout.typography; layout wins.',
            },
            creationDate: {
                type: 'string',
                format: 'date-time',
                description:
                    'Pin the creation instant (ISO 8601) for byte-reproducible output: '
                    + '/CreationDate, the XMP dates, the {date} placeholder and the trailer '
                    + '/ID all derive from it, in UTC. Sugar over layout.creationDate. Not '
                    + 'covered: layout.encryption (fresh keys on every build).',
            },
            direction: directionDef(
                "Base text direction of every paragraph (engine >= 1.9.0): 'auto' "
                + "detects it from the first strong character (UAX #9), 'rtl' and 'ltr' "
                + 'force it. Sugar over layout.direction; a paragraph direction opt '
                + 'overrides it. Omitted, the output is byte-identical to earlier '
                + 'releases. Set it for Arabic, Hebrew, Persian or Urdu documents.',
            ),
            print: {
                type: 'object',
                description:
                    'Print-production page geometry and spot inks. Sugar over layout.print. '
                    + 'bleed is mutually exclusive with trimBox; marks require a '
                    + 'TrimBox source; userUnit is rejected under pdfa1b; spotColours '
                    + 'declares the inks that { spot } / { inks } colours may name.',
                properties: {
                    spotColours: {
                        type: 'array',
                        description:
                            'Spot inks the document may paint with (engine >= 1.9.0): each '
                            + 'a name and a process alternate — [c, m, y, k] percent 0–100 '
                            + 'or [r, g, b] 0–255. A { spot } or { inks } colour naming an '
                            + 'undeclared ink is lint L_SPOT_UNDECLARED, then an engine '
                            + 'throw; an empty or duplicate name or an alternate out of '
                            + 'range is L_PRINT_BOXES. Colour bars paint process inks only, '
                            + 'and outline bookmark colours stay process RGB ($defs.processColor).',
                        items: {
                            type: 'object',
                            required: ['name', 'alternate'],
                            properties: {
                                name: { type: 'string', minLength: 1 },
                                alternate: {
                                    type: 'array',
                                    items: { type: 'number' },
                                    minItems: 3,
                                    maxItems: 4,
                                    description: 'Four CMYK percentages or three RGB values.',
                                },
                            },
                        },
                    },
                    bleed: {
                        type: 'number',
                        exclusiveMinimum: 0,
                        description: 'Uniform bleed in points (shorthand for a centred TrimBox).',
                    },
                    trimBox: printBoxDef('Finished-page trim box'),
                    bleedBox: printBoxDef('Bleed box'),
                    artBox: printBoxDef('Art box'),
                    cropBox: printBoxDef('Crop box'),
                    marks: {
                        description:
                            'Printer’s marks: true for defaults, or '
                            + '{ crop?, registration?, length?, offset?, weight?, colourBars? }.',
                        oneOf: [
                            { type: 'boolean' },
                            {
                                type: 'object',
                                properties: {
                                    crop: { type: 'boolean' },
                                    registration: { type: 'boolean' },
                                    length: { type: 'number' },
                                    offset: { type: 'number' },
                                    weight: { type: 'number' },
                                    colourBars: {
                                        description:
                                            'C/M/Y/K control bars in the bottom bleed strip '
                                            + '(engine >= 1.8.0): true, or { tints, size }. '
                                            + 'Use a bleed of 5 mm (14.17 pt) or more.',
                                        oneOf: [
                                            { type: 'boolean' },
                                            {
                                                type: 'object',
                                                properties: {
                                                    tints: { type: 'boolean' },
                                                    size: { type: 'number', exclusiveMinimum: 0 },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                    userUnit: {
                        type: 'number',
                        minimum: 1,
                        maximum: 75000,
                        description:
                            'Large-format point multiplier; raises the header to PDF 1.7.',
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
            color: colorDef(),
            processColor: processColorDef(),
            listItem: listItemDef(),
            outlineItem: outlineItemDef(),
            pageTemplate: pageTemplateDef(),
            typography: typographyDef(),
            outputIntent: outputIntentDef(),
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
                    + "colors (the engine's PdfColors palette — read by its table-report "
                    + 'builder only, not by the block-flow renderer this package drives), '
                    + 'fontSizes, tagged, pdfx, encryption, '
                    + 'compress, headerTemplate, footerTemplate, watermark, attachments, '
                    + 'maxBlocks, normalize, creationDate (pins the dates, {date} and the '
                    + 'trailer /ID; UTC), typography, direction (auto | ltr | rtl), '
                    + 'actualText (false opts out of the untagged /ActualText spans), '
                    + 'viewerPreferences (incl. duplex, pickTrayByPDFSize, printPageRange, '
                    + 'numCopies), debug, print (incl. spotColours), '
                    + 'outputIntent (RGB, CMYK or Gray), strict, onDiagnostic. strict '
                    + 'escalates PDF/A and PDF/X diagnostics to thrown errors (JSON-safe); '
                    + 'onDiagnostic is function-valued and not representable in JSON — set '
                    + 'it from code.',
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
        // Every key `capabilityManifest()` emits. `tests/schema.test.ts` asserts
        // the two stay in step — a manifest property the schema does not describe
        // is invisible to an agent that discovers the API through the schema,
        // which is the documented path.
        required: [
            'kind',
            'name',
            'version',
            'schemaId',
            'contract',
            'components',
            'clientComponents',
            'errorClasses',
            'specBlocks',
            'specFields',
            'entrypoints',
            'errorCodes',
            'lintRules',
            'schemaSubjects',
        ],
        properties: {
            kind: { const: 'capability-manifest' },
            name: { const: 'pdfnative-react' },
            version: { type: 'string' },
            schemaId: { type: 'string', description: "The $id of this schema." },
            contract: {
                type: 'object',
                description: 'Invariants a caller can rely on (authoring-only, block flow, versions).',
            },
            components: {
                type: 'array',
                items: { type: 'object' },
                description: 'JSX components, their host tag and aliases.',
            },
            clientComponents: {
                type: 'array',
                items: { type: 'object' },
                description:
                    'Preview/download components. Client-side; import them from '
                    + '"pdfnative-react/client" in a React Server Components app.',
            },
            errorClasses: {
                type: 'array',
                items: { type: 'string' },
                description: 'Error classes exported for instanceof checks.',
            },
            specBlocks: {
                type: 'array',
                items: { type: 'object' },
                description: 'The whole DocSpec grammar: tuple form, summary, equivalent component.',
            },
            specFields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Every top-level DocSpec field, in schema order.',
            },
            entrypoints: {
                type: 'array',
                items: { type: 'object' },
                description: 'Every callable export, with signature and sync/async/stream kind.',
            },
            errorCodes: { type: 'array', items: { type: 'string' } },
            lintRules: { type: 'array', items: { type: 'object' } },
            schemaSubjects: {
                type: 'array',
                items: { enum: [...SCHEMA_SUBJECTS] },
                description: 'The subjects schema(subject) answers to.',
            },
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
