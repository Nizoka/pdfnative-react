/**
 * The DocSpec schema is a superset of every shipped minor's schema.
 *
 * Two proofs, run once per frozen capture (`CAPTURES`). Instance-level: every
 * fixture spec under `tests/regression/fixtures/specs/` (valid 1.2.0 documents)
 * validates under each frozen schema, under the current schema, and through
 * `validateSpec`. Structural: every property, enum member and block branch a
 * frozen schema described is still described, and nothing became required —
 * the walk enters `$defs` and every `oneOf` / `anyOf` branch by position
 * (branches are appended, never reordered), so the blocks, the colour forms,
 * the outline items and the chart series are inside the proof, not beside it.
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

/** Every shipped minor whose schema is frozen under `tests/regression/baselines/`. */
const CAPTURES = ['1.2.0', '1.3.0'] as const;

function loadFrozen(captured: string): Schema {
    return JSON.parse(
        readFileSync(join(ROOT, 'tests', 'regression', 'baselines', `doc-spec.schema.v${captured}.json`), 'utf8'),
    ) as Schema;
}
const current = docSpecSchema() as Schema;

const fixtures = readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')) as Json] as const);

describe('every 1.2.0 fixture spec', () => {
    it('exists in sufficient number to mean something', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(6);
    });

    describe.each(CAPTURES)('under the frozen %s schema', (captured) => {
        const frozen = loadFrozen(captured);
        it.each(fixtures)('%s validates', (_name, spec) => {
            expect(validate(spec, frozen)).toEqual([]);
        });
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
        if (Array.isArray(wasList) && Array.isArray(nowList)) {
            if (nowList.length < wasList.length) out.push(`${at}: ${key} lost a branch`);
            // Branches are appended, never reordered: compare by position.
            wasList.forEach((branch, i) => narrowings(branch, nowList[i], `${at}.${key}[${String(i)}]`, out));
        }
    }
    // Shared definitions: a `$ref` target that narrowed narrows every site.
    const wasDefs = w['$defs'];
    if (wasDefs && typeof wasDefs === 'object' && !Array.isArray(wasDefs)) {
        const nowDefs = (n['$defs'] ?? {}) as Schema;
        for (const key of Object.keys(wasDefs)) {
            if (!(key in nowDefs)) out.push(`${at}.$defs.${key}: definition vanished`);
            else narrowings((wasDefs as Schema)[key], nowDefs[key], `${at}.$defs.${key}`, out);
        }
    }
}

const branches = (s: Schema): number =>
    (((s['$defs'] as Schema)['block'] as Schema)['oneOf'] as readonly Json[]).length;

describe.each(CAPTURES)('structurally, the current schema only widens the %s one', (captured) => {
    const frozen = loadFrozen(captured);

    it('keeps every property, every enum member, every block branch; nothing became required', () => {
        const out: string[] = [];
        narrowings(frozen, current, '$', out);
        expect(out).toEqual([]);
    });

    it('describes at least as many block branches', () => {
        expect(branches(current)).toBeGreaterThanOrEqual(branches(frozen));
    });

    it('differs in $id only by the version', () => {
        expect(frozen['$id']).toBe(`https://pdfnative.dev/schema/react/${captured}/doc-spec.schema.json`);
        expect(current['$id']).toBe(`https://pdfnative.dev/schema/react/${version}/doc-spec.schema.json`);
        expect(current['$schema']).toBe(frozen['$schema']);
    });
});

describe('the captures themselves form a chain', () => {
    it('each later capture only widens the earlier one', () => {
        for (let i = 1; i < CAPTURES.length; i += 1) {
            const out: string[] = [];
            narrowings(loadFrozen(CAPTURES[i - 1]), loadFrozen(CAPTURES[i]), '$', out);
            expect(out, `${CAPTURES[i]} narrows ${CAPTURES[i - 1]}`).toEqual([]);
        }
    });
});
