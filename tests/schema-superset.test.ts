/**
 * The DocSpec schema is a superset of its 1.2.0 self.
 *
 * Two proofs. Instance-level: every fixture spec under
 * `tests/regression/fixtures/specs/` (valid 1.2.0 documents) validates under
 * the frozen 1.2.0 schema, under the current schema, and through
 * `validateSpec`. Structural: every property, enum member and block branch the
 * 1.2.0 schema described is still described, and nothing became required.
 *
 * The validator is `tests/helpers/json-schema-lite.ts`, which fails on any
 * keyword it does not implement — so a schema that starts relying on a new
 * keyword goes red here instead of validating vacuously.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileSpec, docSpecSchema, validateSpec, version } from '../src/index.js';
import type { DocSpec } from '../src/index.js';
import { validate, type Json } from './helpers/json-schema-lite.js';

type Schema = { readonly [key: string]: Json };

const ROOT = process.cwd();
const FIXTURES = join(ROOT, 'tests', 'regression', 'fixtures', 'specs');
const frozen = JSON.parse(
    readFileSync(join(ROOT, 'tests', 'regression', 'baselines', 'doc-spec.schema.v1.2.0.json'), 'utf8'),
) as Schema;
const current = docSpecSchema() as Schema;

const fixtures = readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')) as Json] as const);

describe('every 1.2.0 fixture spec', () => {
    it('exists in sufficient number to mean something', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(6);
    });

    it.each(fixtures)('%s validates under the frozen 1.2.0 schema', (_name, spec) => {
        expect(validate(spec, frozen)).toEqual([]);
    });

    it.each(fixtures)('%s validates under the current schema', (_name, spec) => {
        expect(validate(spec, current)).toEqual([]);
    });

    it.each(fixtures)('%s passes validateSpec and compiles', (_name, spec) => {
        expect(validateSpec(spec)).toEqual({ ok: true, errors: [], warnings: [] });
        expect(() => compileSpec(spec as unknown as DocSpec)).not.toThrow();
    });
});

/** Walk two schema nodes; report every way `now` is narrower than `was`. */
function narrowings(was: Json, now: Json | undefined, at: string, out: string[]): void {
    if (typeof was !== 'object' || was === null || Array.isArray(was)) return;
    if (typeof now !== 'object' || now === null || Array.isArray(now)) {
        out.push(`${at}: node vanished`);
        return;
    }
    const w = was as Schema;
    const n = now as Schema;

    const wasProps = w['properties'];
    if (wasProps && typeof wasProps === 'object' && !Array.isArray(wasProps)) {
        const nowProps = (n['properties'] ?? {}) as Schema;
        for (const key of Object.keys(wasProps)) {
            if (!(key in nowProps)) out.push(`${at}.properties.${key}: property no longer described`);
            else narrowings((wasProps as Schema)[key], nowProps[key], `${at}.properties.${key}`, out);
        }
    }
    const wasReq = w['required'];
    const nowReq = n['required'];
    if (Array.isArray(nowReq)) {
        const before = new Set(Array.isArray(wasReq) ? wasReq : []);
        for (const key of nowReq) if (!before.has(key)) out.push(`${at}: "${String(key)}" became required`);
    }
    const wasEnum = w['enum'];
    if (Array.isArray(wasEnum)) {
        const nowEnum = n['enum'];
        if (Array.isArray(nowEnum)) {
            const set = new Set(nowEnum.map((v) => JSON.stringify(v)));
            for (const v of wasEnum) if (!set.has(JSON.stringify(v))) out.push(`${at}: enum lost ${JSON.stringify(v)}`);
        }
        // An enum that became a $ref or a plain type is wider, not narrower.
    }
    for (const key of ['items', 'additionalProperties'] as const) {
        if (w[key] !== undefined && typeof w[key] === 'object') narrowings(w[key], n[key], `${at}.${key}`, out);
    }
    const wasPrefix = w['prefixItems'];
    const nowPrefix = n['prefixItems'];
    if (Array.isArray(wasPrefix) && Array.isArray(nowPrefix)) {
        if (nowPrefix.length < wasPrefix.length) out.push(`${at}: prefixItems shrank`);
        wasPrefix.forEach((item, i) => narrowings(item, nowPrefix[i], `${at}.prefixItems[${String(i)}]`, out));
    }
    for (const key of ['oneOf', 'anyOf'] as const) {
        const wasList = w[key];
        const nowList = n[key];
        if (Array.isArray(wasList) && Array.isArray(nowList) && nowList.length < wasList.length) {
            out.push(`${at}: ${key} lost a branch`);
        }
    }
}

describe('structurally, the current schema only widens the 1.2.0 one', () => {
    it('keeps every property, every enum member, every block branch; nothing became required', () => {
        const out: string[] = [];
        narrowings(frozen, current, '$', out);
        expect(out).toEqual([]);
    });

    it('describes at least as many block branches', () => {
        const branches = (s: Schema): number =>
            (((s['$defs'] as Schema)['block'] as Schema)['oneOf'] as readonly Json[]).length;
        expect(branches(current)).toBeGreaterThanOrEqual(branches(frozen));
    });

    it('differs in $id only by the version', () => {
        expect(frozen['$id']).toBe('https://pdfnative.dev/schema/react/1.2.0/doc-spec.schema.json');
        expect(current['$id']).toBe(`https://pdfnative.dev/schema/react/${version}/doc-spec.schema.json`);
        expect(current['$schema']).toBe(frozen['$schema']);
    });
});
