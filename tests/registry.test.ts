/**
 * Locks the single-source-of-truth registries.
 *
 * `src/registry.ts` feeds the JSON Schema, `validateSpec`, and the capability
 * manifest. If any of those ever restates the tables instead of deriving from
 * them, the assertions here go stale silently — so this file pins the exact,
 * ordered contents, and cross-checks each derived artifact against the source.
 *
 * The companion guarantee is a *compile-time* one: `src/registry.ts` ends with
 * `Assert<Equals<…>>` types, so removing an entry fails `npm run typecheck`
 * before these tests even run. Both halves matter — see the "acceptance
 * criteria" section of the v1.1.0 release notes.
 */
import { describe, expect, it } from 'vitest';
import {
    BLOCK_REGISTRY,
    COMPONENT_REGISTRY,
    LINT_RULES,
    LINT_RULE_CODES,
} from '../src/registry.js';
import { docSpecSchema } from '../src/index.js';

describe('BLOCK_REGISTRY', () => {
    it('lists every DocSpec tuple kind, in schema order', () => {
        expect(BLOCK_REGISTRY.map((b) => b.id)).toEqual([
            'heading',
            'paragraph',
            'list',
            'table',
            'image',
            'link',
            'spacer',
            'pageBreak',
            'page',
            'toc',
            'barcode',
            'svg',
            'chart',
            'field',
        ]);
    });

    it('covers exactly the 21 tuple kinds of the grammar', () => {
        expect(BLOCK_REGISTRY.flatMap((b) => [...b.kinds])).toEqual([
            'h1',
            'h2',
            'h3',
            'p',
            'ul',
            'ol',
            'table',
            'img',
            'link',
            'sp',
            'br',
            'page',
            'toc',
            'qr',
            'code128',
            'ean13',
            'pdf417',
            'datamatrix',
            'svg',
            'chart',
            'field',
        ]);
    });

    it('declares a coherent arity for every entry', () => {
        for (const entry of BLOCK_REGISTRY) {
            expect(entry.minItems).toBeGreaterThanOrEqual(1);
            expect(entry.maxItems).toBeGreaterThanOrEqual(entry.minItems);
            expect(entry.maxItems).toBeLessThanOrEqual(3);
            expect(entry.summary.length).toBeGreaterThan(0);
            expect(entry.tuple).toContain('[');
        }
    });

    it("is what the JSON Schema's $defs.block is built from", () => {
        const defs = docSpecSchema()['$defs'] as { block: { oneOf: Record<string, unknown>[] } };
        expect(defs.block.oneOf).toHaveLength(BLOCK_REGISTRY.length);

        // Arity, description AND the kind discriminator come from the registry,
        // not from the builders. The discriminator is the one that used to drift:
        // the `satisfies` lock covers group ids, not kinds, so a new kind could
        // be accepted by validateSpec while the schema still advertised the old
        // enum — both claiming to derive from one source while disagreeing.
        defs.block.oneOf.forEach((branch, i) => {
            const entry = BLOCK_REGISTRY[i];
            expect(branch['minItems']).toBe(entry.minItems);
            expect(branch['maxItems']).toBe(entry.maxItems);
            expect(branch['description']).toBe(entry.summary);

            const discriminator = (branch['prefixItems'] as Record<string, unknown>[])[0];
            const advertised =
                'const' in discriminator
                    ? [discriminator['const']]
                    : (discriminator['enum'] as string[]);
            expect(advertised, `kinds for ${entry.id}`).toEqual([...entry.kinds]);
        });
    });

    it('includes the chart block introduced in 1.1.0', () => {
        const chart = BLOCK_REGISTRY.find((b) => b.id === 'chart');
        expect(chart).toBeDefined();
        expect(chart?.kinds).toEqual(['chart']);
        expect(chart?.component).toBe('Chart');
        expect(chart?.payload).toBe('object');
    });
});

describe('COMPONENT_REGISTRY', () => {
    it('lists every public component, in barrel order', () => {
        expect(COMPONENT_REGISTRY.map((c) => c.name)).toEqual([
            'Document',
            'Page',
            'Section',
            'Heading',
            'Paragraph',
            'List',
            'Item',
            'Table',
            'Row',
            'Cell',
            'Image',
            'Link',
            'Spacer',
            'PageBreak',
            'TableOfContents',
            'Barcode',
            'Svg',
            'Chart',
            'FormField',
        ]);
    });

    it('marks <Section> as the one composite with no host tag', () => {
        const composites = COMPONENT_REGISTRY.filter((c) => c.tag === null);
        expect(composites.map((c) => c.name)).toEqual(['Section']);
    });

    it('maps every other component onto a distinct host tag', () => {
        const tags = COMPONENT_REGISTRY.map((c) => c.tag).filter((t) => t !== null);
        expect(new Set(tags).size).toBe(tags.length);
        expect(tags).toContain('chart');
    });
});

describe('LINT_RULES', () => {
    it('exposes the full rule set, in registry order', () => {
        expect(LINT_RULE_CODES).toEqual([
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
        ]);
    });

    it('gives every rule a severity and a description', () => {
        for (const code of LINT_RULE_CODES) {
            const rule = LINT_RULES[code];
            expect(['error', 'warning', 'info']).toContain(rule.severity);
            expect(rule.description.length).toBeGreaterThan(10);
        }
    });
});
