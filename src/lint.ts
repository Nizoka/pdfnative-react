/**
 * Deterministic accessibility and layout linting.
 *
 * `lintDocument` compiles the tree once and inspects the resulting
 * `DocumentParams`, so it covers **both** authoring surfaces — JSX and
 * `DocSpec` — from a single implementation, and never diverges from what the
 * engine will actually receive.
 *
 * Findings carry a stable {@link LintRuleCode}. Branch on the code, never on
 * the message: messages may be reworded in any release, codes may not.
 *
 * Twenty of the thirty-seven rules pre-empt an exception the engine raises at
 * build time — the eight `L_CHART_*` errors, `L_PRINT_BOXES`,
 * `L_VIEWER_PRINT_RANGE`, `L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED`,
 * `L_MAX_BLOCKS_EXCEEDED`, `L_OUTPUT_INTENT_PROFILE` and the six PDF/X
 * coherence rules (`L_PDFX_TARGET`, `L_PDFX_TAGGED_CONFLICT`,
 * `L_PDFX_ENCRYPTED`, `L_PDFX_OUTPUT_INTENT`, `L_PDFX_TRAPPED_UNKNOWN`,
 * `L_PDFX_BOXES`) — turning a runtime throw into a finding you can act on
 * beforehand; for the PDF/X rules the finding's message *is* the engine's
 * message. Five more mirror an engine diagnostic that becomes a throw under
 * `layout.strict` (`L_TAGGED_FORM_FONTS`, `L_PDFX_NO_FONTS`,
 * `L_PDFX_ANNOTATIONS`, `L_TYPOGRAPHY_INEFFECTIVE`, `L_CMYK_INTENT_MISMATCH`),
 * and two (`L_EMPTY_DOCUMENT`, `L_TAGGED_NO_FONTS`) catch output that renders
 * successfully but is wrong.
 *
 * The function is pure: it never writes to the console and never throws for a
 * lint failure. What you do with the report is your call.
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import {
    PDF_X_CONFORMANCE_TARGETS,
    PG_H,
    PG_W,
    validatePrintOptions,
} from './core-bridge/index.js';
import { compileDocument, inspectDocument } from './render.js';
import {
    LINT_RULES,
    LINT_RULE_CODES,
    type LintRuleCode,
    type LintSeverity,
} from './registry.js';
import type {
    ChartBlock,
    CustomOutputIntent,
    DocumentBlock,
    DocumentParams,
    PdfLayoutOptions,
    RenderOptions,
    TypographyOptions,
} from './types.js';

// The rule table lives in `./registry.js` so the JSON Schema can describe a lint
// report without importing this module (and therefore without loading the
// engine). Re-exported here because this is where users expect to find it.
export { LINT_RULES, LINT_RULE_CODES };
export type { LintRuleCode, LintSeverity };

/** A single lint finding. */
export interface LintFinding {
    /** Stable rule identifier — branch on this. */
    readonly code: LintRuleCode;
    /** Severity of this rule. */
    readonly severity: LintSeverity;
    /** Human-readable explanation. Not stable across releases. */
    readonly message: string;
    /** Index into `DocumentParams.blocks`, when the finding is block-scoped. */
    readonly blockIndex?: number;
    /** How to fix it. */
    readonly hint?: string;
}

/** The result of a lint run. */
export interface LintReport {
    /** `true` when no finding has severity `'error'`. */
    readonly ok: boolean;
    /** Findings in document order. */
    readonly findings: readonly LintFinding[];
    /** Count per severity, for quick triage. */
    readonly counts: Readonly<Record<LintSeverity, number>>;
}

/** Options for {@link lintDocument} / {@link lintSpec}. */
export interface LintOptions extends RenderOptions {
    /**
     * Also run the geometric overflow check (`L_OVERFLOW`), which needs a full
     * layout pass via `inspectDocument`. Default: `false` — it costs roughly as
     * much as rendering.
     */
    readonly overflow?: boolean;
    /** Only report these rules. Default: all. */
    readonly rules?: readonly LintRuleCode[];
}

const MAX_CHART_POINTS = 10_000;

/**
 * The engine's `DEFAULT_MAX_BLOCKS`, applied when `layout.maxBlocks` is unset.
 *
 * It is not a soft limit: `buildDocumentPDF` **throws** past it. Checking only
 * an explicit `layout.maxBlocks` would leave the common case — no `layout` at
 * all — unguarded, so a large generated document would lint clean and then blow
 * up mid-render.
 */
const DEFAULT_MAX_BLOCKS = 100_000;

/**
 * Every rule this module can actually emit.
 *
 * The registry alone cannot catch a rule that is *declared but never
 * implemented*: such a code would ship into `schema('lint-report')` and
 * `capabilityManifest().lintRules`, and an agent would branch on a finding that
 * can never arrive. `tests/lint.test.tsx` asserts this list equals
 * `LINT_RULE_CODES`, closing the direction the type system cannot.
 *
 * Keep it in sync when adding a rule — the test will tell you if you forget.
 */
export const EMITTED_LINT_RULES: readonly LintRuleCode[] = [
    'L_EMPTY_DOCUMENT',
    'L_IMAGE_ALT',
    'L_CHART_ALT',
    'L_TABLE_HEADERS',
    'L_HEADING_HIERARCHY',
    'L_FIELD_LABEL',
    'L_LINK_TEXT',
    'L_TAGGED_NO_FONTS',
    'L_TAGGED_ENCRYPTED',
    'L_ATTACHMENTS_NEED_PDFA3',
    'L_MAX_BLOCKS',
    'L_MAX_BLOCKS_EXCEEDED',
    'L_CHART_EMPTY',
    'L_CHART_SERIES',
    'L_CHART_CATEGORIES',
    'L_CHART_VALUES',
    'L_CHART_POINTS',
    'L_CHART_LOG_SCALE',
    'L_CHART_X_AXIS',
    'L_CHART_LABELS',
    'L_PRINT_BOXES',
    'L_VIEWER_PRINT_RANGE',
    'L_OUTPUT_INTENT_IGNORED',
    'L_TAGGED_FORM_FONTS',
    'L_OVERFLOW',
    'L_OUTPUT_INTENT_PROFILE',
    'L_PDFX_TARGET',
    'L_PDFX_TAGGED_CONFLICT',
    'L_PDFX_ENCRYPTED',
    'L_PDFX_OUTPUT_INTENT',
    'L_PDFX_TRAPPED_UNKNOWN',
    'L_PDFX_BOXES',
    'L_PDFX_NO_FONTS',
    'L_PDFX_ANNOTATIONS',
    'L_TYPOGRAPHY_INEFFECTIVE',
    'L_PRINT_COLOUR_BARS',
    'L_CMYK_INTENT_MISMATCH',
];

/** The OpenType single-substitution features the engine applies (`fontFeatures`). */
const FONT_FEATURE_TAGS: ReadonlySet<string> = new Set([
    'tnum', 'pnum', 'lnum', 'onum', 'zero', 'ordn', 'sups', 'subs', 'smcp', 'c2sc', 'case',
]);

/** 5 mm in points — the bleed the engine recommends for colour bars. */
const COLOUR_BAR_MIN_STRIP = 14.17;
/** Below this strip height the engine skips colour bars silently. */
const COLOUR_BAR_SKIP_STRIP = 4;

/**
 * The engine's own grammar for a four-operand CMYK string: four values in
 * [0, 1], single spaces, no sign, no exponent (`'0 0.6 1 0'`).
 */
const CMYK_STRING = /^(?:0(?:\.\d+)?|1(?:\.0+)?)(?: (?:0(?:\.\d+)?|1(?:\.0+)?)){3}$/;

/** `true` for the two CMYK colour forms the engine accepts since 1.8.0. */
function isCmykColor(value: unknown): boolean {
    if (typeof value === 'string') return CMYK_STRING.test(value);
    return (
        Array.isArray(value)
        && value.length === 4
        && value.every((v) => typeof v === 'number')
    );
}

/** The four ICC header fields the engine reads before writing an output intent. */
interface IccHeader {
    /** Profile size from bytes 0–3. */
    readonly size: number;
    /** Device class from bytes 12–15 (`'prtr'` for an output profile). */
    readonly deviceClass: string;
    /** Data colour space from bytes 16–19, trimmed (`'RGB'`, `'CMYK'`, `'GRAY'`). */
    readonly space: string;
    /** `true` when bytes 36–39 spell `acsp`. */
    readonly hasAcsp: boolean;
}

/** Pure byte reads — no engine call, no allocation beyond four short strings. */
function iccHeader(icc: Uint8Array): IccHeader | undefined {
    if (icc.length < 128) return undefined;
    const ascii = (at: number): string =>
        String.fromCharCode(icc[at], icc[at + 1], icc[at + 2], icc[at + 3]);
    const size = ((icc[0] << 24) >>> 0) + (icc[1] << 16) + (icc[2] << 8) + icc[3];
    return {
        size,
        deviceClass: ascii(12),
        space: ascii(16).trim(),
        hasAcsp: ascii(36) === 'acsp',
    };
}

/**
 * Mirror of the engine's `resolveOutputIntent()` checks (`outputIntent.*`
 * throws): the header length, the `acsp` signature, the size field and the
 * data colour space. Returns the engine's message, or `undefined` when the
 * profile passes.
 */
function outputIntentProblem(intent: CustomOutputIntent): string | undefined {
    const icc = intent.iccProfile;
    const header = iccHeader(icc);
    if (header === undefined) {
        return 'outputIntent.iccProfile is too short to be an ICC profile (128-byte header required)';
    }
    if (!header.hasAcsp) {
        return 'outputIntent.iccProfile is not an ICC profile (no `acsp` signature at byte 36)';
    }
    if (header.size < 128 || header.size > icc.length) {
        return `outputIntent.iccProfile header declares ${String(header.size)} bytes but `
            + `${String(icc.length)} were supplied — the profile is truncated or corrupt`;
    }
    if (header.space !== 'RGB' && header.space !== 'CMYK' && header.space !== 'GRAY') {
        return `outputIntent.iccProfile declares data colour space '${header.space}' — an `
            + 'OutputIntent profile must describe RGB, CMYK or Gray';
    }
    return undefined;
}

/**
 * The PDF/X coherence rules, in the engine's own order (`resolvePdfXConfig`
 * then `pdfxBoxes`), with the engine's own messages — so the finding an agent
 * reads before rendering is the sentence the engine would throw.
 */
function lintPdfX(params: DocumentParams, out: LintFinding[]): void {
    const layout = params.layout;
    const pdfx = layout?.pdfx;
    if (pdfx === undefined) return;

    const targets = PDF_X_CONFORMANCE_TARGETS as readonly string[];
    if (!targets.includes(pdfx)) {
        out.push(
            finding(
                'L_PDFX_TARGET',
                `layout.pdfx: unknown target '${String(pdfx)}' — use one of ${targets.join(', ')}`,
                { hint: "Set pdfx to 'pdfx4', the one target the engine writes." },
            ),
        );
    }

    const tagged = layout?.tagged;
    if (tagged !== undefined && tagged !== false) {
        out.push(
            finding(
                'L_PDFX_TAGGED_CONFLICT',
                'layout.pdfx and layout.tagged cannot be combined — pdfnative writes one '
                    + 'conformance claim per file; drop one of them',
                { hint: 'Build the print file and the archival file as two documents.' },
            ),
        );
    }

    if (layout?.encryption !== undefined) {
        out.push(
            finding(
                'L_PDFX_ENCRYPTED',
                'PDF/X forbids encryption (ISO 15930-7) — drop layout.encryption or layout.pdfx',
                { hint: 'Drop one of the two.' },
            ),
        );
    }

    const intent = layout?.outputIntent;
    if (intent === undefined) {
        out.push(
            finding(
                'L_PDFX_OUTPUT_INTENT',
                'PDF/X-4 requires layout.outputIntent: the ICC profile of the printing '
                    + 'condition, e.g. ISO Coated v2 or GRACoL from your printer. pdfnative '
                    + 'ships no press profile',
                { hint: 'Pass the output ICC profile your printer names as <Document outputIntent>.' },
            ),
        );
    } else {
        const header = iccHeader(intent.iccProfile);
        // An unreadable header is already an L_OUTPUT_INTENT_PROFILE error.
        if (header?.hasAcsp === true && header.deviceClass !== 'prtr') {
            out.push(
                finding(
                    'L_PDFX_OUTPUT_INTENT',
                    'PDF/X-4 requires an output (printer) profile as layout.outputIntent — '
                        + `the supplied profile's class is '${header.deviceClass}'`,
                    { hint: "Use a press profile (ICC device class 'prtr'), not a monitor profile such as sRGB." },
                ),
            );
        }
    }

    if (params.metadata?.trapped === 'Unknown') {
        out.push(
            finding(
                'L_PDFX_TRAPPED_UNKNOWN',
                "PDF/X requires the trapping state to be known — set metadata.trapped to "
                    + "'True' or 'False', or omit it for 'False'",
                { hint: "pdfnative never traps, so 'False' is accurate for its output." },
            ),
        );
    }

    const print = layout?.print;
    if (
        print?.artBox !== undefined
        && (print.trimBox !== undefined || print.bleed !== undefined)
    ) {
        out.push(
            finding(
                'L_PDFX_BOXES',
                'PDF/X pages carry a TrimBox or an ArtBox, not both — drop print.artBox, or '
                    + 'print.trimBox and print.bleed',
                { hint: 'Keep one of the two boxes.' },
            ),
        );
    }

    if (params.fontEntries === undefined || params.fontEntries.length === 0) {
        out.push(
            finding(
                'L_PDFX_NO_FONTS',
                `pdfx="${String(pdfx)}" requires embedded fonts, but no fontEntries were supplied; `
                    + 'the engine reports PDFX_NO_FONT_ENTRIES (and throws under layout.strict).',
                {
                    hint: 'Pass fontEntries={await resolveFonts({ … })} on <Document> or in the render options.',
                },
            ),
        );
    }

    params.blocks.forEach((block, index) => {
        if (block.type === 'link' || block.type === 'formField') {
            out.push(
                finding(
                    'L_PDFX_ANNOTATIONS',
                    `Block #${String(index)} is a ${block.type === 'link' ? 'link' : 'form field'}; `
                        + 'PDF/X-4 forbids interactive annotations inside the BleedBox, so the '
                        + 'engine reports PDFX_ANNOTATIONS (and throws under layout.strict).',
                    { blockIndex: index, hint: 'Print the URL as text, or drop the form field.' },
                ),
            );
        }
    });
}

/** Typography options that can have no effect as written (engine diagnostics and documented no-ops). */
function lintTypography(
    typography: TypographyOptions,
    hasFonts: boolean,
    out: LintFinding[],
): void {
    const warn = (message: string, hint: string): void => {
        out.push(finding('L_TYPOGRAPHY_INEFFECTIVE', message, { hint }));
    };

    if (
        typography.splitParagraphs !== true
        && (typography.orphans !== undefined || typography.widows !== undefined)
    ) {
        warn(
            'typography.orphans / widows only apply when splitParagraphs is true; paragraphs stay atomic.',
            'Set typography.splitParagraphs: true, or drop the quotas.',
        );
    }
    for (const key of ['orphans', 'widows'] as const) {
        const value = typography[key];
        if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
            warn(
                `typography.${key} must be a whole number >= 1, got ${String(value)}; the engine floors it at 1.`,
                'Use 1, 2 (the default) or 3.',
            );
        }
    }
    const keep = typography.keepHeadingsWithNext;
    if (
        typeof keep === 'object'
        && keep.minLines !== undefined
        && (!Number.isInteger(keep.minLines) || keep.minLines < 1)
    ) {
        warn(
            `typography.keepHeadingsWithNext.minLines must be a whole number >= 1, got ${String(keep.minLines)}.`,
            'Use 2 (the default, byte-identical to true) or 3.',
        );
    }

    const unknownTags = (typography.fontFeatures ?? []).filter((tag) => !FONT_FEATURE_TAGS.has(tag));
    if (unknownTags.length > 0) {
        warn(
            `typography.fontFeatures names tags the engine cannot apply: ${unknownTags.join(', ')} `
                + '(only single substitutions are supported).',
            `Use one of ${[...FONT_FEATURE_TAGS].join(', ')}.`,
        );
    }

    if (!hasFonts) {
        const needsFont: string[] = [];
        if (typography.kerning === true) needsFont.push('kerning');
        if ((typography.fontFeatures ?? []).length > 0) needsFont.push('fontFeatures');
        if (typography.punctuationSpacing === 'fr') needsFont.push("punctuationSpacing 'fr'");
        if (needsFont.length > 0) {
            warn(
                `${needsFont.join(', ')} need a registered font, but no fontEntries were supplied: `
                    + 'the base-14 faces carry no OpenType tables and no narrow no-break space '
                    + "(the 'fr' preset degrades to 'fr-CA').",
                'Pass fontEntries={await resolveFonts({ … })}, e.g. the bundled Noto Sans.',
            );
        }
    }
}

/**
 * Colour bars need a bleed strip to sit in: under 4 pt the engine skips them
 * silently; under 5 mm (14.17 pt) the patches fall below a densitometer
 * aperture. The TrimBox source is `bleed`, or an explicit `trimBox` above the
 * `bleedBox` (or the MediaBox) bottom edge.
 */
function lintColourBars(print: NonNullable<PdfLayoutOptions['print']>, out: LintFinding[]): void {
    const marks = print.marks;
    if (typeof marks !== 'object' || marks.colourBars === undefined || marks.colourBars === false) {
        return;
    }
    let strip: number | undefined;
    if (print.bleed !== undefined) strip = print.bleed;
    else if (print.trimBox !== undefined) strip = print.trimBox[1] - (print.bleedBox?.[1] ?? 0);
    // No TrimBox source at all is `L_PRINT_BOXES` territory (marks need one).
    if (strip === undefined || !Number.isFinite(strip)) return;

    if (strip < COLOUR_BAR_SKIP_STRIP) {
        out.push(
            finding(
                'L_PRINT_COLOUR_BARS',
                `print.marks.colourBars is set but the bottom bleed strip is ${strip.toFixed(2)} pt; `
                    + 'under 4 pt the engine skips the bars silently.',
                { hint: 'Use a bleed of 5 mm (14.17 pt) or more.' },
            ),
        );
    } else if (strip < COLOUR_BAR_MIN_STRIP) {
        out.push(
            finding(
                'L_PRINT_COLOUR_BARS',
                `print.marks.colourBars is set but the bottom bleed strip is ${strip.toFixed(2)} pt; `
                    + 'the patches are clamped below the 12 pt densitometer aperture.',
                { hint: 'Use a bleed of 5 mm (14.17 pt) or more.' },
            ),
        );
    }
}

/**
 * Every colour position of the compiled model, as `[where, value]` pairs — the
 * block-level colours plus the document palette, watermark and page templates.
 */
function colourPositions(params: DocumentParams): [string, unknown][] {
    const out: [string, unknown][] = [];
    const layout = params.layout;
    for (const [name, value] of Object.entries(layout?.colors ?? {})) out.push([`layout.colors.${name}`, value]);
    out.push(['watermark.text.color', layout?.watermark?.text?.color]);
    out.push(['header.color', layout?.headerTemplate?.color]);
    out.push(['footer.color', layout?.footerTemplate?.color]);
    params.blocks.forEach((block, index) => {
        const at = `block #${String(index)}`;
        switch (block.type) {
            case 'heading':
            case 'paragraph':
            case 'link':
                out.push([at, block.color]);
                break;
            case 'table':
                out.push([`${at} zebra`, block.zebra]);
                out.push([`${at} cellBorders`, block.cellBorders?.color]);
                break;
            case 'chart':
                for (const c of block.colors ?? []) out.push([`${at} colors`, c]);
                for (const s of block.series) out.push([`${at} series "${s.label}"`, s.color]);
                break;
            default:
                break;
        }
    });
    return out;
}

/**
 * A CMYK colour under a conformance claim whose output intent is not CMYK is
 * an engine diagnostic (`PDFA_DEVICE_CMYK_CONTENT` / `PDFX_DEVICE_CMYK`). The
 * built-in PDF/A intent is sRGB; a custom intent's space comes from its ICC
 * header. Under `pdfx` without an intent the `L_PDFX_OUTPUT_INTENT` rule
 * already fires, so there is nothing to compare against here.
 */
function lintCmykIntent(params: DocumentParams, out: LintFinding[]): void {
    const layout = params.layout;
    const claim =
        layout?.pdfx !== undefined
            ? 'PDF/X'
            : layout?.tagged !== undefined && layout.tagged !== false
              ? 'PDF/A'
              : undefined;
    if (claim === undefined) return;

    let space: string | undefined;
    const intent = layout?.outputIntent;
    if (intent === undefined) {
        if (claim === 'PDF/X') return;
        space = 'RGB';
    } else {
        space = iccHeader(intent.iccProfile)?.space;
        if (space === undefined) return; // unreadable — L_OUTPUT_INTENT_PROFILE
    }
    if (space === 'CMYK') return;

    const offenders = colourPositions(params).filter(([, value]) => isCmykColor(value));
    if (offenders.length === 0) return;
    out.push(
        finding(
            'L_CMYK_INTENT_MISMATCH',
            `${String(offenders.length)} CMYK colour(s) under a ${claim} claim whose output intent `
                + `is ${space} (${offenders.map(([where]) => where).join(', ')}); the engine reports `
                + `${claim === 'PDF/X' ? 'PDFX_DEVICE_CMYK' : 'PDFA_DEVICE_CMYK_CONTENT'} `
                + '(and throws under layout.strict).',
            {
                hint: 'Supply a CMYK outputIntent (the press profile), or use RGB colours under this claim.',
            },
        ),
    );
}

function finding(
    code: LintRuleCode,
    message: string,
    extra?: { blockIndex?: number; hint?: string },
): LintFinding {
    return {
        code,
        severity: LINT_RULES[code].severity,
        message,
        ...(extra?.blockIndex !== undefined ? { blockIndex: extra.blockIndex } : {}),
        ...(extra?.hint !== undefined ? { hint: extra.hint } : {}),
    };
}

/** Chart rules — these mirror the engine's own validation, ahead of the throw. */
function lintChart(block: ChartBlock, index: number, out: LintFinding[]): void {
    const { chartType, series, categories, altText } = block;

    if (altText === undefined || altText.trim() === '') {
        out.push(
            finding('L_CHART_ALT', `Chart #${index} has no altText.`, {
                blockIndex: index,
                hint: 'Describe what the chart shows, e.g. altText="Revenue per quarter, rising from 12k to 31k".',
            }),
        );
    }

    // The engine throws on an empty series list or an empty value array, so
    // report it here rather than letting the render blow up.
    if (series.length === 0) {
        out.push(
            finding('L_CHART_EMPTY', `Chart #${index} has no series.`, {
                blockIndex: index,
                hint: 'Supply at least one { label, values } series.',
            }),
        );
    }
    for (const s of series) {
        if (s.values.length === 0) {
            out.push(
                finding(
                    'L_CHART_EMPTY',
                    `Chart #${index} series "${s.label}" has no values.`,
                    { blockIndex: index, hint: 'Every series needs at least one value.' },
                ),
            );
        }
    }

    const isRadial = chartType === 'pie' || chartType === 'donut';
    if (isRadial && series.length !== 1) {
        out.push(
            finding(
                'L_CHART_SERIES',
                `A ${chartType} chart takes exactly one series, but #${index} has ${String(series.length)}.`,
                { blockIndex: index, hint: 'Split the extra series into separate charts.' },
            ),
        );
    }

    // Mirror the engine's x-axis resolution: scatter defaults to a linear
    // (positional) axis, everything else to categories.
    const isScatter = chartType === 'scatter';
    const xType = block.xAxis?.type ?? (isScatter ? 'linear' : 'category');
    const positional = xType !== 'category';

    if (positional && !(isScatter || chartType === 'line' || chartType === 'area')) {
        out.push(
            finding(
                'L_CHART_X_AXIS',
                `Chart #${index}: xAxis.type '${xType}' applies only to line/area/scatter charts.`,
                { blockIndex: index, hint: "Drop xAxis.type, or switch to a line/area/scatter chart." },
            ),
        );
    }
    if (isScatter && !positional) {
        out.push(
            finding(
                'L_CHART_X_AXIS',
                `Chart #${index}: scatter charts need a positional x-axis — xAxis.type 'category' is not supported.`,
                { blockIndex: index, hint: "Use xAxis.type 'linear' or 'time' (or omit xAxis)." },
            ),
        );
    }
    if (isRadial && series.some((s) => s.yAxis === 'right')) {
        out.push(
            finding(
                'L_CHART_X_AXIS',
                `Chart #${index}: yAxis binding applies to cartesian charts only, not ${chartType}.`,
                { blockIndex: index, hint: 'Remove yAxis from the series.' },
            ),
        );
    }

    if (isScatter && (block.labelStride !== undefined || block.labelRotation !== undefined)) {
        out.push(
            finding(
                'L_CHART_LABELS',
                `Chart #${index}: labelStride/labelRotation apply to category axes only, not scatter.`,
                { blockIndex: index, hint: 'Remove labelStride/labelRotation.' },
            ),
        );
    }
    if (
        block.labelStride !== undefined
        && (!Number.isInteger(block.labelStride) || block.labelStride < 1)
    ) {
        out.push(
            finding(
                'L_CHART_LABELS',
                `Chart #${index}: labelStride must be an integer >= 1, got ${String(block.labelStride)}.`,
                { blockIndex: index, hint: 'Use a whole number, or omit it for the automatic stride.' },
            ),
        );
    }
    if (
        block.labelRotation !== undefined
        && (!Number.isFinite(block.labelRotation)
            || block.labelRotation < 0
            || block.labelRotation > 90)
    ) {
        out.push(
            finding(
                'L_CHART_LABELS',
                `Chart #${index}: labelRotation must be between 0 and 90 degrees, got ${String(block.labelRotation)}.`,
                { blockIndex: index, hint: '45 is the typical choice for long labels.' },
            ),
        );
    }

    const stacked = chartType === 'stackedBar' || chartType === 'stackedBarH';
    if (stacked && (block.axis?.scale === 'log' || block.axis2?.scale === 'log')) {
        out.push(
            finding(
                'L_CHART_LOG_SCALE',
                `Chart #${index}: log scale cannot be combined with stacked charts.`,
                { blockIndex: index, hint: 'Use a linear scale, or an unstacked bar chart.' },
            ),
        );
    }
    for (const side of ['left', 'right'] as const) {
        const axis = side === 'left' ? block.axis : block.axis2;
        if (axis?.scale !== 'log') continue;
        if (
            (axis.yMin !== undefined && axis.yMin <= 0)
            || (axis.yMax !== undefined && axis.yMax <= 0)
        ) {
            out.push(
                finding(
                    'L_CHART_LOG_SCALE',
                    `Chart #${index}: log-scale axis bounds must be > 0.`,
                    { blockIndex: index, hint: 'Set yMin/yMax to positive values.' },
                ),
            );
        }
        for (const s of series) {
            if ((s.yAxis ?? 'left') !== side) continue;
            if (s.values.some((v) => v <= 0)) {
                out.push(
                    finding(
                        'L_CHART_LOG_SCALE',
                        `Chart #${index} series "${s.label}" has non-positive values on a log axis.`,
                        { blockIndex: index, hint: 'Log scales need strictly positive data.' },
                    ),
                );
            }
        }
    }

    let points = 0;
    for (const s of series) {
        points += s.values.length;

        if (positional) {
            if (s.xValues === undefined) {
                out.push(
                    finding(
                        'L_CHART_X_AXIS',
                        `Chart #${index} series "${s.label}" needs xValues for xAxis.type '${xType}'.`,
                        { blockIndex: index, hint: 'Give every series one x position per value.' },
                    ),
                );
            } else if (s.xValues.length !== s.values.length) {
                out.push(
                    finding(
                        'L_CHART_X_AXIS',
                        `Chart #${index} series "${s.label}" has ${String(s.xValues.length)} xValues `
                            + `but ${String(s.values.length)} values.`,
                        { blockIndex: index, hint: 'xValues and values must be the same length.' },
                    ),
                );
            } else if (xType !== 'time' && s.xValues.some((x) => typeof x === 'string')) {
                out.push(
                    finding(
                        'L_CHART_X_AXIS',
                        `Chart #${index} series "${s.label}" uses date strings — set xAxis.type to 'time'.`,
                        { blockIndex: index, hint: "Only a 'time' axis parses ISO-8601 strings." },
                    ),
                );
            }
        }

        if (categories !== undefined && !positional && s.values.length !== categories.length) {
            out.push(
                finding(
                    'L_CHART_CATEGORIES',
                    `Chart #${index} series "${s.label}" has ${String(s.values.length)} values `
                        + `but there are ${String(categories.length)} categories.`,
                    { blockIndex: index, hint: 'Every series must supply one value per category.' },
                ),
            );
        }

        // `.some`, not `.find`: when the offending value *is* `undefined`,
        // `find` returns `undefined` and an `!== undefined` check silently passes.
        if (s.values.some((v) => !Number.isFinite(v))) {
            out.push(
                finding(
                    'L_CHART_VALUES',
                    `Chart #${index} series "${s.label}" contains a non-finite value.`,
                    { blockIndex: index, hint: 'Replace NaN/Infinity with a real number or 0.' },
                ),
            );
        } else if (isRadial && s.values.some((v) => v < 0)) {
            out.push(
                finding(
                    'L_CHART_VALUES',
                    `A ${chartType} chart cannot plot negative values (chart #${index}).`,
                    { blockIndex: index, hint: 'Use a bar chart for data that goes below zero.' },
                ),
            );
        }
    }

    if (points > MAX_CHART_POINTS) {
        out.push(
            finding(
                'L_CHART_POINTS',
                `Chart #${index} has ${String(points)} data points; the engine ceiling is ${String(MAX_CHART_POINTS)}.`,
                { blockIndex: index, hint: 'Aggregate the data before charting it.' },
            ),
        );
    }
}

function lintBlocks(blocks: readonly DocumentBlock[], out: LintFinding[]): void {
    let lastHeadingLevel = 0;

    blocks.forEach((block, index) => {
        switch (block.type) {
            case 'heading': {
                // A document whose *first* heading is h2 or h3 skips a level just
                // as surely as one that jumps mid-document — WCAG 1.3.1 treats
                // both as a broken outline.
                if (block.level > lastHeadingLevel + 1) {
                    out.push(
                        finding(
                            'L_HEADING_HIERARCHY',
                            lastHeadingLevel === 0
                                ? `The first heading is level ${String(block.level)}; a document should start at level 1 ("${block.text}").`
                                : `Heading jumps from level ${String(lastHeadingLevel)} to ${String(block.level)} ("${block.text}").`,
                            {
                                blockIndex: index,
                                hint: `Use level ${String(lastHeadingLevel + 1)}, or add the intermediate heading.`,
                            },
                        ),
                    );
                }
                lastHeadingLevel = block.level;
                break;
            }

            case 'image': {
                if (block.alt === undefined || block.alt.trim() === '') {
                    out.push(
                        finding('L_IMAGE_ALT', `Image #${index} has no alt text.`, {
                            blockIndex: index,
                            hint: 'Add alt="…" describing the image, or alt="" if purely decorative.',
                        }),
                    );
                }
                break;
            }

            case 'table': {
                if (block.headers.length === 0) {
                    out.push(
                        finding('L_TABLE_HEADERS', `Table #${index} has no header row.`, {
                            blockIndex: index,
                            hint: 'Pass headers={[…]} or mark the first <Row header>.',
                        }),
                    );
                }
                break;
            }

            case 'formField': {
                if (block.label === undefined || block.label.trim() === '') {
                    out.push(
                        finding(
                            'L_FIELD_LABEL',
                            `Form field "${block.name}" has no label.`,
                            { blockIndex: index, hint: 'Add label="…" so the widget is identifiable.' },
                        ),
                    );
                }
                break;
            }

            case 'link': {
                const text = block.text.trim();
                if (text === '') {
                    out.push(
                        finding('L_LINK_TEXT', `Link #${index} has no text.`, {
                            blockIndex: index,
                            hint: 'Give the link a descriptive label.',
                        }),
                    );
                } else if (text === block.url) {
                    out.push(
                        finding(
                            'L_LINK_TEXT',
                            `Link #${index} uses its raw URL as the link text.`,
                            {
                                blockIndex: index,
                                hint: 'Prefer descriptive text, e.g. "Read the invoice terms".',
                            },
                        ),
                    );
                }
                break;
            }

            case 'chart': {
                lintChart(block, index, out);
                break;
            }

            default:
                break;
        }
    });
}

function lintDocumentParams(params: DocumentParams, out: LintFinding[]): void {
    if (params.blocks.length === 0) {
        out.push(
            finding('L_EMPTY_DOCUMENT', 'The document has no blocks.', {
                hint: 'Add at least one block inside <Document>.',
            }),
        );
    }

    const layout = params.layout;
    const tagged = layout?.tagged;
    const wantsPdfA = typeof tagged === 'string';

    if (wantsPdfA && (params.fontEntries === undefined || params.fontEntries.length === 0)) {
        out.push(
            finding(
                'L_TAGGED_NO_FONTS',
                `tagged="${tagged}" requires embedded fonts, but no fontEntries were supplied.`,
                {
                    hint: 'Pass fontEntries={await resolveFonts({ … })} on <Document> or in the render options.',
                },
            ),
        );
    }

    if (tagged !== undefined && tagged !== false && layout?.encryption !== undefined) {
        out.push(
            finding(
                'L_TAGGED_ENCRYPTED',
                'PDF/A and encryption cannot be combined.',
                { hint: 'Drop layout.encryption, or drop the tagged/PDF-A target.' },
            ),
        );
    }

    const attachments = layout?.attachments;
    if (attachments !== undefined && attachments.length > 0 && tagged !== 'pdfa3b') {
        out.push(
            finding(
                'L_ATTACHMENTS_NEED_PDFA3',
                `${String(attachments.length)} file attachment(s) require tagged="pdfa3b", but tagged is `
                    + `${tagged === undefined ? 'unset' : JSON.stringify(tagged)}.`,
                {
                    hint: 'Set tagged="pdfa3b" on <Document> — only PDF/A-3 permits embedded files.',
                },
            ),
        );
    }

    if (wantsPdfA && params.blocks.some((b) => b.type === 'formField')) {
        out.push(
            finding(
                'L_TAGGED_FORM_FONTS',
                `tagged="${tagged}" with form fields: the AcroForm font is not embedded, `
                    + 'so the engine reports PDFA_UNEMBEDDED_FORM_FONT (and throws under '
                    + 'layout.strict).',
                {
                    hint: 'Drop the form fields, relax the PDF/A target, or handle the '
                        + 'diagnostic via layout.onDiagnostic.',
                },
            ),
        );
    }

    // Delegate print geometry to the engine's own validator: a throw here is
    // exactly the throw `buildDocumentPDF` would raise mid-render, so the
    // finding carries the engine's message verbatim — zero duplicated rules.
    const print = layout?.print;
    if (print !== undefined) {
        try {
            validatePrintOptions(print, layout?.pageWidth ?? PG_W, layout?.pageHeight ?? PG_H, tagged);
        } catch (error) {
            out.push(
                finding('L_PRINT_BOXES', error instanceof Error ? error.message : String(error), {
                    hint: 'Fix layout.print / the <Document print> prop before rendering.',
                }),
            );
        }
    }

    const prefs = layout?.viewerPreferences;
    if (prefs?.printPageRange !== undefined) {
        for (const [first, last] of prefs.printPageRange) {
            if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) {
                out.push(
                    finding(
                        'L_VIEWER_PRINT_RANGE',
                        `viewerPreferences.printPageRange entry [${String(first)}, ${String(last)}] is invalid.`,
                        { hint: 'Entries are 1-based [first, last] pairs with last >= first.' },
                    ),
                );
            }
        }
    }
    if (
        prefs?.numCopies !== undefined
        && (!Number.isInteger(prefs.numCopies) || prefs.numCopies < 1)
    ) {
        out.push(
            finding(
                'L_VIEWER_PRINT_RANGE',
                `viewerPreferences.numCopies must be a positive integer, got ${String(prefs.numCopies)}.`,
                { hint: 'Use a whole number >= 1, or omit it.' },
            ),
        );
    }

    // Under `pdfx` the output intent is mandatory, not ignored — that case is
    // the `L_PDFX_OUTPUT_INTENT` rule's.
    if (
        layout?.outputIntent !== undefined
        && (tagged === undefined || tagged === false)
        && layout.pdfx === undefined
    ) {
        out.push(
            finding(
                'L_OUTPUT_INTENT_IGNORED',
                'layout.outputIntent is set but the document is not tagged — the engine '
                    + 'silently ignores it.',
                { hint: "Set tagged (e.g. 'pdfa2b') or pdfx, or drop the outputIntent." },
            ),
        );
    }

    // Engine 1.8.0: output-intent profiles are validated before any byte is
    // written; the same four checks here, with the engine's messages.
    if (layout?.outputIntent !== undefined) {
        const problem = outputIntentProblem(layout.outputIntent);
        if (problem !== undefined) {
            out.push(
                finding('L_OUTPUT_INTENT_PROFILE', problem, {
                    hint: 'Pass the full .icc file of the output condition; a hand-made stub is rejected.',
                }),
            );
        }
    }

    lintPdfX(params, out);

    if (layout?.typography !== undefined) {
        lintTypography(
            layout.typography,
            params.fontEntries !== undefined && params.fontEntries.length > 0,
            out,
        );
    }

    if (print !== undefined) lintColourBars(print, out);

    lintCmykIntent(params, out);

    const maxBlocks = layout?.maxBlocks ?? DEFAULT_MAX_BLOCKS;
    const blockCount = params.blocks.length;
    if (blockCount > maxBlocks) {
        out.push(
            finding(
                'L_MAX_BLOCKS_EXCEEDED',
                `${String(blockCount)} blocks exceeds the maxBlocks ceiling of ${String(maxBlocks)}`
                    + `${layout?.maxBlocks === undefined ? ' (the engine default)' : ''}.`,
                { hint: 'Raise layout.maxBlocks, or split the document.' },
            ),
        );
    } else if (blockCount > maxBlocks * 0.9) {
        out.push(
            finding(
                'L_MAX_BLOCKS',
                `${String(blockCount)} blocks is within 10% of the maxBlocks ceiling (${String(maxBlocks)}).`,
                { hint: 'Raise layout.maxBlocks, or split the document.' },
            ),
        );
    }

    lintBlocks(params.blocks, out);
}

/**
 * Geometric overflow, via a real layout pass.
 *
 * pdfnative's y-axis increases upward: a block occupies `[top - height, top]`,
 * and the content box spans `[margins.b, pageHeight - margins.t]`. A block that
 * is simply taller than that box can never fit on any page — that is the case
 * worth reporting (an oversized `<Chart>` or `<Image>` is the usual cause).
 */
function overflowFindings(node: ReactNode, options: LintOptions | undefined): LintFinding[] {
    const out: LintFinding[] = [];
    const inspection = inspectDocument(node, options);
    const contentHeight = inspection.pageHeight - inspection.margins.t - inspection.margins.b;
    const floor = inspection.margins.b;
    const epsilon = 0.5; // points — absorbs measurement rounding

    for (const page of inspection.pages) {
        for (const block of page.blocks) {
            const tooTall = block.height > contentHeight + epsilon;
            const belowFloor = block.top - block.height < floor - epsilon;
            if (!tooTall && !belowFloor) continue;

            out.push(
                finding(
                    'L_OVERFLOW',
                    tooTall
                        ? `A ${block.type} block is ${block.height.toFixed(0)}pt tall but the content box `
                              + `is only ${contentHeight.toFixed(0)}pt — it cannot fit on any page.`
                        : `A ${block.type} block on page ${String(page.index + 1)} extends below the bottom margin.`,
                    {
                        hint: tooTall
                            ? 'Reduce the block height, or enlarge the page / shrink the margins.'
                            : 'Let the block flow onto the next page, or reduce its height.',
                    },
                ),
            );
        }
    }
    return out;
}

function report(findings: readonly LintFinding[], rules?: readonly LintRuleCode[]): LintReport {
    const filtered =
        rules === undefined ? findings : findings.filter((f) => rules.includes(f.code));
    const counts = { error: 0, warning: 0, info: 0 };
    for (const f of filtered) counts[f.severity] += 1;
    return { ok: counts.error === 0, findings: filtered, counts };
}

/**
 * Check a document for accessibility and layout problems without rendering it.
 *
 * @param node - A React element whose root is `<Document>`.
 * @param options - Render options, plus `overflow` and `rules` filters.
 * @returns A report; `ok` is `true` when nothing of severity `'error'` was found.
 */
export function lintDocument(node: ReactNode, options?: LintOptions): LintReport {
    const findings: LintFinding[] = [];
    lintDocumentParams(compileDocument(node), findings);
    if (options?.overflow === true) findings.push(...overflowFindings(node, options));
    return report(findings, options?.rules);
}
