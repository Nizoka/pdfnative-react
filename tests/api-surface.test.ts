/**
 * The public surface is additive — proven, not asserted.
 *
 * `tests/regression/baselines/api-surface.v<N>.json` was captured from the
 * v<N> tree (every runtime export of the root and `/client` barrels, and every
 * exported type name). Every one of those names must still be exported: a
 * removal or a rename is a breaking change and fails here. Additions are
 * expected — the current list is snapshotted so they are reviewed, and the
 * snapshot becomes the next release's baseline (`CAPTURES` grows by one entry
 * per shipped minor; a capture is never regenerated).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as engine from 'pdfnative';
import * as barrel from '../src/index.js';
import * as client from '../src/client.js';

interface Baseline {
    readonly version: string;
    readonly values: readonly string[];
    readonly client: readonly string[];
    readonly types: readonly string[];
}

/** Every shipped minor whose surface is frozen under `tests/regression/baselines/`. */
const CAPTURES = ['1.2.0', '1.3.0'] as const;

function loadBaseline(version: string): Baseline {
    return JSON.parse(
        readFileSync(join(process.cwd(), 'tests', 'regression', 'baselines', `api-surface.v${version}.json`), 'utf8'),
    ) as Baseline;
}

/** Source text with its `//` and `/* *\/` comments removed, so a comment inside an export block never reads as a name. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Exported type names, read from the source the same way the baselines were. */
function currentTypeNames(): string[] {
    const names = new Set<string>();
    const index = stripComments(readFileSync(join(process.cwd(), 'src', 'index.ts'), 'utf8'));
    for (const m of index.matchAll(/export type \{([^}]*)\}/g)) {
        for (const n of m[1].split(',')) {
            const t = n.trim();
            if (t) names.add(t);
        }
    }
    const components = stripComments(readFileSync(join(process.cwd(), 'src', 'components.tsx'), 'utf8'));
    for (const m of components.matchAll(/^export (?:interface|type) (\w+)/gm)) names.add(m[1]);
    return [...names].sort();
}

describe.each(CAPTURES)('API surface — %s → current is additive', (version) => {
    const baseline = loadBaseline(version);

    it(`the baseline really is the ${version} capture`, () => {
        expect(baseline.version).toBe(version);
        expect(baseline.values.length).toBeGreaterThan(60);
        expect(baseline.types.length).toBeGreaterThan(100);
    });

    it(`keeps every ${version} runtime export of the root barrel`, () => {
        const missing = baseline.values.filter((name) => !(name in barrel));
        expect(missing, `removed from the barrel: ${missing.join(', ')}`).toEqual([]);
    });

    it(`keeps every ${version} runtime export of the /client barrel`, () => {
        const missing = baseline.client.filter((name) => !(name in client));
        expect(missing).toEqual([]);
    });

    it(`keeps every ${version} exported type name`, () => {
        const current = new Set(currentTypeNames());
        const missing = baseline.types.filter((name) => !current.has(name));
        expect(missing, `removed types: ${missing.join(', ')}`).toEqual([]);
    });
});

describe('the captures themselves', () => {
    it('are a chain: every later capture is a superset of the earlier one', () => {
        for (let i = 1; i < CAPTURES.length; i += 1) {
            const earlier = loadBaseline(CAPTURES[i - 1]);
            const later = loadBaseline(CAPTURES[i]);
            for (const key of ['values', 'client', 'types'] as const) {
                const lost = earlier[key].filter((name) => !later[key].includes(name));
                expect(lost, `${CAPTURES[i]} lost ${key} of ${CAPTURES[i - 1]}: ${lost.join(', ')}`).toEqual([]);
            }
        }
    });

    it('snapshots the current surface so additions are reviewed', () => {
        expect({
            values: Object.keys(barrel).sort(),
            client: Object.keys(client).sort(),
            types: currentTypeNames(),
        }).toMatchSnapshot();
    });
});

describe('engine helpers re-exported in 1.3.0', () => {
    it.each([
        'setDeflateRawImpl',
        'wrapZlib',
        'setDefaultCreationDate',
        'getDefaultCreationDate',
        'setHyphenationProvider',
        'getHyphenationProvider',
    ] as const)('%s is the engine’s own function, not a wrapper', (name) => {
        expect(barrel[name]).toBe(engine[name]);
    });

    it('still does not re-export the byte-level validators (golden rule 7)', () => {
        // validatePdfUA and validatePdfX are the engine's; RECIPES.md shows the
        // one-line import. The authoring surface stays authoring-only.
        expect(barrel).not.toHaveProperty('validatePdfX');
        expect(barrel).not.toHaveProperty('validatePdfUA');
    });
});
