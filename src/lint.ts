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
 * Eight of the eighteen rules pre-empt an exception the engine raises
 * mid-render — the five `L_CHART_*` errors, `L_ATTACHMENTS_NEED_PDFA3`,
 * `L_TAGGED_ENCRYPTED` and `L_MAX_BLOCKS_EXCEEDED` — turning a runtime throw
 * into a finding you can act on beforehand. Two more (`L_EMPTY_DOCUMENT`,
 * `L_TAGGED_NO_FONTS`) catch output that renders successfully but is wrong.
 *
 * The function is pure: it never writes to the console and never throws for a
 * lint failure. What you do with the report is your call.
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import { compileDocument, inspectDocument } from './render.js';
import {
    LINT_RULES,
    LINT_RULE_CODES,
    type LintRuleCode,
    type LintSeverity,
} from './registry.js';
import type {
    ChartBlock,
    DocumentBlock,
    DocumentParams,
    RenderOptions,
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
    'L_OVERFLOW',
];

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

    let points = 0;
    for (const s of series) {
        points += s.values.length;

        if (categories !== undefined && s.values.length !== categories.length) {
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
