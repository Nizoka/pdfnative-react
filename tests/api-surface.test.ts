/**
 * The public surface is additive — proven, not asserted.
 *
 * `tests/regression/baselines/api-surface.v1.2.0.json` was captured from the
 * v1.2.0 tree (every runtime export of the root and `/client` barrels, and
 * every exported type name). Every one of those names must still be exported:
 * a removal or a rename is a breaking change and fails here. Additions are
 * expected — the current list is snapshotted so they are reviewed, and the
 * snapshot becomes the next release's baseline.
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

const baseline = JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'regression', 'baselines', 'api-surface.v1.2.0.json'), 'utf8'),
) as Baseline;

/** Exported type names, read from the source the same way the baseline was. */
function currentTypeNames(): string[] {
    const names = new Set<string>();
    const index = readFileSync(join(process.cwd(), 'src', 'index.ts'), 'utf8');
    for (const m of index.matchAll(/export type \{([^}]*)\}/g)) {
        for (const n of m[1].split(',')) {
            const t = n.trim();
            if (t) names.add(t);
        }
    }
    const components = readFileSync(join(process.cwd(), 'src', 'components.tsx'), 'utf8');
    for (const m of components.matchAll(/^export (?:interface|type) (\w+)/gm)) names.add(m[1]);
    return [...names].sort();
}

describe('API surface — 1.2.0 → current is additive', () => {
    it('the baseline really is the 1.2.0 capture', () => {
        expect(baseline.version).toBe('1.2.0');
        expect(baseline.values.length).toBeGreaterThan(60);
        expect(baseline.types.length).toBeGreaterThan(100);
    });

    it('keeps every 1.2.0 runtime export of the root barrel', () => {
        const missing = baseline.values.filter((name) => !(name in barrel));
        expect(missing, `removed from the barrel: ${missing.join(', ')}`).toEqual([]);
    });

    it('keeps every 1.2.0 runtime export of the /client barrel', () => {
        const missing = baseline.client.filter((name) => !(name in client));
        expect(missing).toEqual([]);
    });

    it('keeps every 1.2.0 exported type name', () => {
        const current = new Set(currentTypeNames());
        const missing = baseline.types.filter((name) => !current.has(name));
        expect(missing, `removed types: ${missing.join(', ')}`).toEqual([]);
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
