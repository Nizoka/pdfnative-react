/**
 * The multi-subject JSON Schema surface.
 *
 * Pins the subject list (a contract an agent enumerates), the versioned `$id`
 * format, and the backward-compatible `docSpecSchema()` alias.
 */
import { describe, expect, it } from 'vitest';
import {
    LINT_RULE_CODES,
    PdfReactError,
    SCHEMA_SUBJECTS,
    capabilityManifest,
    docSpecSchema,
    docSpecSchemaId,
    schema,
    schemaId,
    version,
} from '../src/index.js';
import type { SchemaSubject } from '../src/index.js';
import { validate, type Json } from './helpers/json-schema-lite.js';

/** The validator's schema node type (`scripts/lib/json-schema-lite.ts`). */
type LiteSchema = { readonly [key: string]: Json };

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

describe('subject list', () => {
    it('is the exact, ordered contract', () => {
        expect(SCHEMA_SUBJECTS).toEqual([
            'doc-spec',
            'render-options',
            'lint-report',
            'spec-validation',
            'doctor',
            'manifest',
            'list',
        ]);
    });

    it('is self-describing via schema("list")', () => {
        const list = schema('list');
        expect(list['examples']).toEqual([{ subjects: [...SCHEMA_SUBJECTS] }]);
    });

    it('is the same list the capability manifest advertises', () => {
        expect(capabilityManifest().schemaSubjects).toEqual([...SCHEMA_SUBJECTS]);
    });
});

describe('every subject', () => {
    it.each([...SCHEMA_SUBJECTS])('%s is a well-formed Draft 2020-12 schema', (subject) => {
        const doc = schema(subject);
        expect(doc['$schema']).toBe(DRAFT);
        expect(typeof doc['title']).toBe('string');
        expect(typeof doc['description']).toBe('string');
        expect(doc['$id']).toBe(
            `https://pdfnative.dev/schema/react/${version}/${subject}.schema.json`,
        );
    });

    it('embeds the current package version in every $id', () => {
        for (const subject of SCHEMA_SUBJECTS) {
            expect(schemaId(subject)).toMatch(
                /^https:\/\/pdfnative\.dev\/schema\/react\/\d+\.\d+\.\d+\/[a-z-]+\.schema\.json$/,
            );
        }
    });

    it('defaults to doc-spec', () => {
        expect(schema()).toEqual(schema('doc-spec'));
        expect(schemaId()).toBe(schemaId('doc-spec'));
    });

    it('rejects an unknown subject with E_INPUT', () => {
        try {
            schema('nope' as SchemaSubject);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(PdfReactError);
            expect((err as PdfReactError).code).toBe('E_INPUT');
            expect((err as PdfReactError).message).toContain('doc-spec');
        }
    });
});

describe('backward compatibility', () => {
    it('docSpecSchema() still returns the doc-spec schema', () => {
        expect(docSpecSchema()).toEqual(schema('doc-spec'));
    });

    it('docSpecSchemaId() still returns the doc-spec $id', () => {
        expect(docSpecSchemaId()).toBe(schemaId('doc-spec'));
        expect(docSpecSchemaId()).toContain(`/${version}/`);
    });
});

describe('doc-spec schema content', () => {
    const doc = docSpecSchema();

    it('requires blocks and describes the layout sugar', () => {
        expect(doc['required']).toEqual(['blocks']);
        const props = doc['properties'] as Record<string, unknown>;
        for (const key of ['watermark', 'header', 'footer', 'attachments', 'tagged', 'blocks']) {
            expect(props, key).toHaveProperty(key);
        }
    });

    it('defines the recursive and shared $defs', () => {
        const defs = doc['$defs'] as Record<string, unknown>;
        expect(Object.keys(defs)).toEqual([
            'color',
            'processColor',
            'listItem',
            'outlineItem',
            'pageTemplate',
            'typography',
            'outputIntent',
            'block',
        ]);
    });

    it('keeps outline bookmark colours process-only (the engine refuses a spot or ink mix there)', () => {
        const defs = doc['$defs'] as Record<string, Record<string, unknown>>;
        const outline = defs['outlineItem']['properties'] as Record<string, Record<string, unknown>>;
        expect(outline['color']).toEqual({ $ref: '#/$defs/processColor' });
        const process = defs['processColor']['anyOf'] as Record<string, unknown>[];
        expect(process.map((b) => b['type'])).toEqual(['string', 'array']);
        expect(defs['processColor']['description']).toContain('do not apply');

        // validateSpec is the tier-1 shape check (tuples, from the registry); the
        // JSON Schema is where the colour forms live, so the proof runs there.
        const schemaDoc = doc as unknown as LiteSchema;
        const cmyk = { blocks: [['p', 'x']], outline: [{ title: 'A', pageIndex: 0, color: [0, 60, 100, 0] }] } as Json;
        expect(validate(cmyk, schemaDoc)).toEqual([]);
        const spot = { blocks: [['p', 'x']], outline: [{ title: 'A', pageIndex: 0, color: { spot: 'Brand Blue' } }] } as Json;
        expect(validate(spot, schemaDoc).join(' ')).toContain('outline');
    });

    it('requires a non-empty ink name in a { spot } colour (the engine refuses an empty one)', () => {
        const colour = (doc['$defs'] as Record<string, { anyOf: Record<string, unknown>[] }>)['color'];
        const spotBranch = colour.anyOf.find((b) => b['type'] === 'object' && 'spot' in (b['properties'] as object));
        expect((spotBranch?.['properties'] as Record<string, Record<string, unknown>>)['spot']?.['minLength']).toBe(1);
        const empty = { blocks: [['p', 'x', { color: { spot: '' } }]] } as Json;
        expect(validate(empty, doc as unknown as LiteSchema).length).toBeGreaterThan(0);
    });

    it('describes the 1.8.0 document-level sugar', () => {
        const props = doc['properties'] as Record<string, Record<string, unknown>>;
        expect(props['pdfx']?.['const']).toBe('pdfx4');
        expect(props['outputIntent']?.['$ref']).toBe('#/$defs/outputIntent');
        expect(props['typography']?.['$ref']).toBe('#/$defs/typography');
        expect(props['creationDate']?.['format']).toBe('date-time');
    });

    it('describes the 1.9.0 document-level sugar: direction, spot inks, per-value series colours', () => {
        const props = doc['properties'] as Record<string, Record<string, unknown>>;
        expect(props['direction']?.['enum']).toEqual(['auto', 'ltr', 'rtl']);
        const print = props['print']?.['properties'] as Record<string, Record<string, unknown>>;
        const spot = print['spotColours'];
        expect(spot?.['type']).toBe('array');
        expect((spot?.['items'] as Record<string, unknown>)['required']).toEqual(['name', 'alternate']);

        const colour = (doc['$defs'] as Record<string, { anyOf: Record<string, unknown>[] }>)['color'];
        const objectBranches = colour.anyOf.filter((b) => b['type'] === 'object').map((b) => b['required']);
        expect(objectBranches).toEqual([['spot'], ['inks']]);

        const defs = doc['$defs'] as { block: { oneOf: Record<string, unknown>[] } };
        const chart = defs.block.oneOf.find((b) => b['title'] === 'ChartSpec');
        const body = (chart?.['prefixItems'] as Record<string, Record<string, unknown>>[])[1];
        const series = (body['properties'] as Record<string, Record<string, unknown>>)['series'];
        const item = series['items'] as Record<string, unknown>;
        expect(item['required']).toEqual(['values']); // label is optional since engine 1.9.0
        expect(item['properties']).toHaveProperty('colors');

        const paragraph = defs.block.oneOf.find((b) => b['title'] === 'ParagraphSpec');
        const opts = (paragraph?.['prefixItems'] as Record<string, Record<string, unknown>>[])[2];
        expect((opts['properties'] as Record<string, Record<string, unknown>>)['direction']?.['enum']).toEqual(['auto', 'ltr', 'rtl']);
    });

    it('routes every colour position through the shared $defs.color', () => {
        // Every colour the grammar accepts must admit the CMYK forms the
        // engine takes since 1.8.0 — one definition, referenced everywhere.
        const text = JSON.stringify(doc);
        expect(text.match(/#\/\$defs\/color/g)?.length).toBeGreaterThanOrEqual(8);
        expect(text).not.toContain('"type":["string","array"]');
    });

    it('includes a chart branch with its own required fields', () => {
        const defs = doc['$defs'] as { block: { oneOf: Record<string, unknown>[] } };
        const chart = defs.block.oneOf.find((b) => b['title'] === 'ChartSpec');
        expect(chart).toBeDefined();
        const body = (chart?.['prefixItems'] as Record<string, unknown>[])[1];
        expect(body['required']).toEqual(['chartType', 'series']);
    });
});

describe('report schemas', () => {
    it('lint-report enumerates exactly the implemented rule codes', () => {
        const doc = schema('lint-report');
        const props = doc['properties'] as {
            findings: { items: { properties: { code: { enum: string[] } } } };
        };
        expect(props.findings.items.properties.code.enum).toEqual([...LINT_RULE_CODES]);
    });

    it('doctor describes the check shape', () => {
        const doc = schema('doctor');
        expect(doc['required']).toEqual(['ok', 'checks']);
    });

    it('manifest describes the capability-manifest shape', () => {
        const doc = schema('manifest');
        const props = doc['properties'] as { kind: { const: string } };
        expect(props.kind.const).toBe('capability-manifest');
    });

    it('manifest schema describes EVERY property the manifest emits', () => {
        // A manifest property the schema does not describe is invisible to an
        // agent that discovers the API through the schema — which is the
        // documented path. `clientComponents`, `errorClasses` and
        // `schemaSubjects` were all missing until this test existed.
        const emitted = Object.keys(capabilityManifest()).sort();
        const described = Object.keys(
            schema('manifest')['properties'] as Record<string, unknown>,
        ).sort();
        expect(described).toEqual(emitted);
        expect(schema('manifest')['required']).toEqual(Object.keys(capabilityManifest()));
    });

    it('spec-validation enumerates the validation codes', () => {
        const doc = schema('spec-validation');
        const defs = doc['$defs'] as { finding: { properties: { code: { enum: string[] } } } };
        expect(defs.finding.properties.code.enum).toContain('V_UNKNOWN_KIND');
    });
});
