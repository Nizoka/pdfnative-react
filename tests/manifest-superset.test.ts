/**
 * The capability manifest and the lint contract are supersets of their 1.2.0
 * selves.
 *
 * `tests/regression/baselines/manifest.v1.2.0.json` is `capabilityManifest()`
 * as v1.2.0 emitted it. Every component, alias, client component, error class,
 * DocSpec block, entry point, error code, lint rule (same severity) and schema
 * subject it listed must still be there; the contract keys are unchanged
 * except for the accepted deltas. And the 1.2.0 fixture documents must lint
 * to the same set of rule codes they did before: a new rule that fires on a
 * legacy document would be a silent behaviour change.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { capabilityManifest, lintSpec } from '../src/index.js';
import type { CapabilityManifest, DocSpec } from '../src/index.js';

const ROOT = process.cwd();
const was = JSON.parse(
    readFileSync(join(ROOT, 'tests', 'regression', 'baselines', 'manifest.v1.2.0.json'), 'utf8'),
) as CapabilityManifest;
const now = capabilityManifest();

/** Contract fields allowed to change between 1.2.0 and now, with their new value. */
const ACCEPTED_CONTRACT_DELTAS: Readonly<Record<string, unknown>> = {
    engine: '^1.8.0',
};

describe('capabilityManifest — 1.2.0 ⊆ current', () => {
    it('is the 1.2.0 capture', () => {
        expect(was.version).toBe('1.2.0');
        expect(now.version).not.toBe('1.2.0');
    });

    it('keeps the identity fields', () => {
        expect(now.kind).toBe(was.kind);
        expect(now.name).toBe(was.name);
    });

    it('keeps every contract key, with only the accepted deltas changing', () => {
        for (const [key, value] of Object.entries(was.contract)) {
            const expected = key in ACCEPTED_CONTRACT_DELTAS ? ACCEPTED_CONTRACT_DELTAS[key] : value;
            expect((now.contract as Record<string, unknown>)[key], `contract.${key}`).toEqual(expected);
        }
    });

    it('keeps every component, tag and alias', () => {
        for (const c of was.components) {
            const match = now.components.find((x) => x.name === c.name);
            expect(match, c.name).toBeDefined();
            expect(match?.tag).toBe(c.tag);
            for (const alias of c.aliases ?? []) expect(match?.aliases ?? []).toContain(alias);
        }
    });

    it('keeps every client component, error class and schema subject', () => {
        for (const c of was.clientComponents) {
            expect(now.clientComponents.map((x) => x.name)).toContain(c.name);
        }
        for (const cls of was.errorClasses) expect(now.errorClasses).toContain(cls);
        for (const s of was.schemaSubjects) expect(now.schemaSubjects).toContain(s);
    });

    it('keeps every DocSpec block, its kinds and its component', () => {
        for (const b of was.specBlocks) {
            const match = now.specBlocks.find((x) => x.component === b.component);
            expect(match, b.component).toBeDefined();
            expect(match?.kinds).toEqual(b.kinds);
            expect(match?.tuple).toBe(b.tuple);
        }
    });

    it('keeps every entry point with the same signature and kind', () => {
        for (const e of was.entrypoints) {
            const match = now.entrypoints.find((x) => x.name === e.name);
            expect(match, e.name).toBeDefined();
            expect(match?.signature).toBe(e.signature);
            expect(match?.kind).toBe(e.kind);
            expect(match?.nodeOnly ?? false).toBe(e.nodeOnly ?? false);
        }
    });

    it('keeps every error code, in order, as a prefix', () => {
        expect(now.errorCodes.slice(0, was.errorCodes.length)).toEqual(was.errorCodes);
    });

    it('keeps every lint rule with the same severity, in order, as a prefix', () => {
        expect(now.lintRules.slice(0, was.lintRules.length).map((r) => [r.code, r.severity])).toEqual(
            was.lintRules.map((r) => [r.code, r.severity]),
        );
    });
});

describe('lint — no new rule fires on a 1.2.0 document', () => {
    const codes12 = new Set(was.lintRules.map((r) => r.code));
    const FIXTURES = join(ROOT, 'tests', 'regression', 'fixtures', 'specs');
    const fixtures = readdirSync(FIXTURES)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')) as DocSpec] as const);

    it.each(fixtures)('%s lints to 1.2.0 rule codes only', (_name, spec) => {
        const report = lintSpec(spec);
        const fresh = report.findings.map((f) => f.code).filter((c) => !codes12.has(c));
        expect(fresh, `new rules firing on a legacy document: ${fresh.join(', ')}`).toEqual([]);
    });
});
