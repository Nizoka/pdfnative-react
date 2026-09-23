// scripts/lib/json-schema-lite.ts holds the DocSpec fixtures to the package's
// own JSON Schemas (the frozen 1.2.0 capture and the current one) inside the
// test suite. It is a Draft 2020-12 subset on purpose; what these tests pin
// is that the subset can never turn into a silent pass — an unimplemented
// keyword is a failure — and that the real fixtures validate against the
// real schema.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { schema } from '../../src/index.js';
import { validate, type Json } from '../../scripts/lib/json-schema-lite.js';

type Obj = { readonly [key: string]: Json };
const ROOT = resolve(import.meta.dirname, '..', '..');

describe('json-schema-lite: keywords', () => {
    it('checks type, with integer ⊂ number', () => {
        expect(validate(3, { type: 'integer' })).toEqual([]);
        expect(validate(3, { type: 'number' })).toEqual([]);
        expect(validate(3.5, { type: 'integer' })).toHaveLength(1);
        expect(validate('3', { type: 'number' })).toHaveLength(1);
        expect(validate(null, { type: 'null' })).toEqual([]);
        expect(validate([], { type: 'object' })).toHaveLength(1);
    });

    it('checks required, properties and additionalProperties: false, with JSON-pointer-style paths', () => {
        const schema: Obj = { type: 'object', required: ['name'], properties: { name: { type: 'string' }, n: { type: 'integer' } }, additionalProperties: false };
        expect(validate({ name: 'x', n: 1 }, schema)).toEqual([]);
        const failures = validate({ n: 'one', extra: true }, schema);
        expect(failures.join('\n')).toMatch(/name/);
        expect(failures.join('\n')).toMatch(/\$\.n/);
        expect(failures.join('\n')).toMatch(/extra/);
    });

    it('checks string and array bounds, pattern, enum, const and uniqueItems', () => {
        expect(validate('abc', { type: 'string', minLength: 2, maxLength: 3, pattern: '^[a-c]+$' })).toEqual([]);
        expect(validate('abcd', { type: 'string', maxLength: 3 })).toHaveLength(1);
        expect(validate('xyz', { type: 'string', pattern: '^[a-c]+$' })).toHaveLength(1);
        expect(validate('b', { enum: ['a', 'b'] })).toEqual([]);
        expect(validate('c', { enum: ['a', 'b'] })).toHaveLength(1);
        expect(validate('a', { const: 'a' })).toEqual([]);
        expect(validate('b', { const: 'a' })).toHaveLength(1);
        expect(validate([1, 2], { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 2, uniqueItems: true })).toEqual([]);
        expect(validate([1, 1], { type: 'array', uniqueItems: true })).toHaveLength(1);
        expect(validate([1, 'x'], { type: 'array', items: { type: 'integer' } })).toHaveLength(1);
        expect(validate(5, { minimum: 1, maximum: 4 })).toHaveLength(1);
    });

    it('checks anyOf, oneOf, allOf and not', () => {
        expect(validate('x', { anyOf: [{ type: 'string' }, { type: 'integer' }] })).toEqual([]);
        expect(validate(true, { anyOf: [{ type: 'string' }, { type: 'integer' }] })).not.toEqual([]);
        expect(validate(3, { oneOf: [{ type: 'integer' }, { type: 'number' }] })).not.toEqual([]);
        expect(validate(3.5, { oneOf: [{ type: 'integer' }, { type: 'number' }] })).toEqual([]);
        expect(validate('ab', { allOf: [{ minLength: 1 }, { maxLength: 1 }] })).not.toEqual([]);
        expect(validate('a', { not: { type: 'string' } })).not.toEqual([]);
    });

    it('resolves local $ref pointers and fails on one it cannot resolve', () => {
        const schema: Obj = { definitions: { id: { type: 'string', minLength: 1 } }, type: 'object', properties: { id: { $ref: '#/definitions/id' } } };
        expect(validate({ id: 'a' }, schema)).toEqual([]);
        expect(validate({ id: '' }, schema)).toHaveLength(1);
        expect(validate('x', { $ref: '#/definitions/missing' })).not.toEqual([]);
        expect(validate('x', { $ref: 'https://example.com/other.json' })).not.toEqual([]);
    });
});

describe('json-schema-lite: never a silent pass', () => {
    it('reports a keyword it does not implement instead of ignoring it', () => {
        const failures = validate({ a: 1 }, { type: 'object', patternProperties: { '^a': { type: 'string' } } });
        expect(failures.join('\n')).toMatch(/patternProperties/);
        expect(validate('x', { type: 'string', if: { minLength: 1 } }).join('\n')).toMatch(/\bif\b/);
    });

    it('accepts annotations, including format, without checking them', () => {
        expect(validate('not-a-uri', { type: 'string', format: 'uri', title: 't', description: 'd', examples: ['x'], default: 'y', $comment: 'c' })).toEqual([]);
    });
});

describe('json-schema-lite: the real DocSpec schema', () => {
    const docSpec = schema('doc-spec') as unknown as Obj;
    const fixturesDir = resolve(ROOT, 'tests', 'regression', 'fixtures', 'specs');
    const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort();

    it('is a Draft 2020-12 schema the subset can read in full (tuple grammar through prefixItems, $defs)', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(8);
        expect(String(docSpec['$schema'])).toContain('2020-12');
        expect(docSpec['$defs']).toBeTypeOf('object');
    });

    it.each(fixtures)('%s validates — and a perturbed copy does not', (file) => {
        const spec = JSON.parse(readFileSync(resolve(fixturesDir, file), 'utf8')) as { blocks: Json } & Obj;
        expect(validate(spec, docSpec)).toEqual([]);
        expect(validate({ ...spec, blocks: 42 }, docSpec)).not.toEqual([]);
        expect(validate({ ...spec, blocks: [['nope', 'x']] }, docSpec)).not.toEqual([]);
        const { blocks: _dropped, ...withoutBlocks } = spec;
        expect(validate(withoutBlocks, docSpec)).not.toEqual([]);
    });
});
