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
        expect(Object.keys(defs)).toEqual(['listItem', 'outlineItem', 'pageTemplate', 'block']);
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

    it('spec-validation enumerates the validation codes', () => {
        const doc = schema('spec-validation');
        const defs = doc['$defs'] as { finding: { properties: { code: { enum: string[] } } } };
        expect(defs.finding.properties.code.enum).toContain('V_UNKNOWN_KIND');
    });
});
