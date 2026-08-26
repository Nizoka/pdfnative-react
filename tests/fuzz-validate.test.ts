/**
 * Deterministic structural fuzzing of `validateSpec`.
 *
 * `validateSpec` is the gate for *untrusted* input — a model or a config
 * loader hands over JSON of unknown provenance, and the JSDoc promises it
 * never throws. Example-based tests cannot hold that promise across the whole
 * input space, so this file generates a few hundred randomized malformed
 * inputs (wrong types at every level, wrong tuple arities, unknown kinds,
 * nesting past the depth bound, prototype-polluted objects) from a **fixed**
 * PRNG seed — the corpus is identical on every run, so a failure is always
 * reproducible from the reported case index.
 *
 * Three invariants, for every input:
 *   1. `validateSpec` never throws;
 *   2. the report is well-formed `{ ok, errors, warnings }` with V_* codes;
 *   3. every seeded-invalid input is flagged `!ok` (or, for merely-unknown
 *      top-level fields, with warnings).
 */
import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/index.js';
import type { SpecValidation } from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded PRNG — mulberry32 with a fixed literal seed. No Date.now, no
// Math.random: the corpus must be byte-identical on every run.
// ─────────────────────────────────────────────────────────────────────────────

const SEED = 0x5eed1200; // fixed forever — changing it changes the corpus

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Rng = () => number;

function int(rng: Rng, max: number): number {
    return Math.floor(rng() * max);
}

function pick<T>(rng: Rng, items: readonly T[]): T {
    return items[int(rng, items.length)];
}

const KINDS = [
    'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'table', 'img', 'link', 'sp', 'br',
    'page', 'toc', 'qr', 'code128', 'ean13', 'pdf417', 'datamatrix', 'svg',
    'chart', 'field',
] as const;

/** A random value of a deliberately wrong JavaScript type. */
function junk(rng: Rng, depth = 0): unknown {
    const flat = [
        () => int(rng, 1000) - 500,
        () => rng() * 1e9,
        () => Number.NaN,
        () => Number.POSITIVE_INFINITY,
        () => `junk-${String(int(rng, 1_000_000))}`,
        () => '',
        () => null,
        () => undefined,
        () => rng() < 0.5,
        () => Symbol('junk'),
        () => () => 'callable junk',
    ];
    const nested = [
        () => Array.from({ length: int(rng, 4) }, () => junk(rng, depth + 1)),
        () => ({ [`k${String(int(rng, 100))}`]: junk(rng, depth + 1) }),
    ];
    const makers = depth < 3 ? [...flat, ...nested] : flat;
    return pick(rng, makers)();
}

/** A block that is malformed by construction, in one randomly chosen way. */
function malformedBlock(rng: Rng): unknown {
    switch (int(rng, 6)) {
        case 0: // not an array at all
            return junk(rng);
        case 1: // empty tuple
            return [];
        case 2: // unknown kind
            return [`nope-${String(int(rng, 1000))}`, 'payload'];
        case 3: // kind is not even a string
            return [junk(rng), 'payload'];
        case 4: // wrong payload type: 'p' wants a string
            return ['p', pick(rng, [42, null, true, { text: 'x' }, ['x']])];
        case 5: // non-object options element
        default:
            return ['p', 'ok', pick(rng, [42, 'opts', null, true])];
    }
}

/** `['page', ['page', … ]]` nested `levels` deep, with a leaf paragraph. */
function nestedPages(levels: number): unknown {
    let blocks: unknown[] = [['p', 'leaf']];
    for (let i = 0; i < levels; i += 1) blocks = [['page', blocks]];
    return { blocks };
}

/**
 * Returns `null` when the report is structurally sound, else a description.
 * A plain function (not a heap of `expect`s) keeps hundreds of corpus checks
 * fast and the failure message anchored to the offending case.
 */
function malformation(report: SpecValidation): string | null {
    if (typeof report !== 'object') return 'report is not an object';
    if (typeof report.ok !== 'boolean') return 'ok is not a boolean';
    if (!Array.isArray(report.errors)) return 'errors is not an array';
    if (!Array.isArray(report.warnings)) return 'warnings is not an array';
    if (report.ok !== (report.errors.length === 0)) return 'ok disagrees with errors';
    for (const f of report.errors) {
        if (f.severity !== 'error') return `error finding has severity ${String(f.severity)}`;
    }
    for (const f of report.warnings) {
        if (f.severity !== 'warning') return `warning finding has severity ${String(f.severity)}`;
    }
    for (const f of [...report.errors, ...report.warnings]) {
        if (typeof f.code !== 'string' || !f.code.startsWith('V_')) {
            return `finding code ${String(f.code)} is not a V_* code`;
        }
        if (typeof f.path !== 'string') return 'finding path is not a string';
        if (typeof f.message !== 'string' || f.message.length === 0) {
            return 'finding message is empty';
        }
    }
    return null;
}

function runNeverThrowing(input: unknown, context: string): SpecValidation {
    try {
        return validateSpec(input);
    } catch (error) {
        throw new Error(`validateSpec threw on ${context}: ${String(error)}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// The corpora
// ─────────────────────────────────────────────────────────────────────────────

describe('fuzzing validateSpec with seeded-malformed inputs', () => {
    it('never throws and flags every malformed input (400 cases)', () => {
        const rng = mulberry32(SEED);

        for (let i = 0; i < 400; i += 1) {
            let input: unknown;
            switch (int(rng, 4)) {
                case 0: // not an object at all
                    input = pick(rng, [
                        junk(rng),
                        [],
                        [['p', 'x']],
                        'a string that looks like nothing',
                        12345,
                        null,
                    ]);
                    // an object made by the junk generator would be a valid
                    // (empty-ish) spec candidate; force non-object shapes
                    if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
                        input = int(rng, 2) === 0 ? null : String(i);
                    }
                    break;
                case 1: // blocks has the wrong type
                    input = { blocks: pick(rng, [junk(rng), 'nope', 7, null, {}, true]) };
                    if (Array.isArray((input as { blocks: unknown }).blocks)) {
                        input = { blocks: 'definitely not an array' };
                    }
                    break;
                case 2: // an array of malformed blocks
                    input = {
                        blocks: Array.from({ length: 1 + int(rng, 5) }, () => malformedBlock(rng)),
                    };
                    break;
                case 3: // nesting past the depth bound
                default:
                    input = nestedPages(66 + int(rng, 40));
                    break;
            }

            const report = runNeverThrowing(input, `malformed case #${String(i)}`);
            expect(malformation(report), `case #${String(i)}`).toBeNull();
            expect(report.ok, `case #${String(i)} was not flagged`).toBe(false);
        }
    });

    it('extreme nesting (depth 200) is flagged V_TOO_DEEP, not a stack overflow', () => {
        const report = runNeverThrowing(nestedPages(200), 'depth-200 nesting');
        expect(report.ok).toBe(false);
        expect(report.errors.some((e) => e.code === 'V_TOO_DEEP')).toBe(true);
    });

    it('nesting around the 64-level boundary never throws', () => {
        for (const levels of [60, 63, 64, 65, 66]) {
            const report = runNeverThrowing(nestedPages(levels), `depth-${String(levels)}`);
            expect(malformation(report), `depth ${String(levels)}`).toBeNull();
        }
    });

    it('unknown top-level fields warn without failing (50 cases)', () => {
        const rng = mulberry32(SEED ^ 0xa5a5a5a5);
        for (let i = 0; i < 50; i += 1) {
            const input = {
                blocks: [['p', 'x']],
                [`unknown_${String(int(rng, 1_000_000))}`]: junk(rng),
            };
            const report = runNeverThrowing(input, `unknown-field case #${String(i)}`);
            expect(malformation(report), `case #${String(i)}`).toBeNull();
            expect(report.ok).toBe(true);
            expect(report.warnings.length).toBeGreaterThan(0);
            expect(report.warnings[0].code).toBe('V_UNKNOWN_FIELD');
        }
    });

    it('prototype-polluted JSON is handled inertly', () => {
        // JSON.parse creates a real own "__proto__" property (it never walks
        // the prototype chain), so this is the exact shape hostile JSON takes.
        const polluted = JSON.parse(
            '{"__proto__": {"polluted": true}, "constructor": {"prototype": {}}, "blocks": "nope"}',
        ) as unknown;
        const report = runNeverThrowing(polluted, 'polluted spec');
        expect(malformation(report)).toBeNull();
        expect(report.ok).toBe(false); // blocks is not an array
        expect(report.warnings.some((w) => w.code === 'V_UNKNOWN_FIELD')).toBe(true);

        const validButPolluted = JSON.parse(
            '{"__proto__": {"polluted": true}, "blocks": [["p", "x"]]}',
        ) as unknown;
        const report2 = runNeverThrowing(validButPolluted, 'polluted-but-valid spec');
        expect(malformation(report2)).toBeNull();
        expect(report2.ok).toBe(true);
        expect(report2.warnings.some((w) => w.code === 'V_UNKNOWN_FIELD')).toBe(true);

        // And Object.prototype itself stayed clean throughout.
        expect('polluted' in {}).toBe(false);
    });
});

describe('fuzz-mutating a valid spec', () => {
    /** A small spec that validates clean — the mutation baseline. */
    function validSpec(): Record<string, unknown> {
        return JSON.parse(
            JSON.stringify({
                title: 'Fuzz baseline',
                blocks: [
                    ['h1', 'Title'],
                    ['p', 'Body.', { align: 'left' }],
                    ['ul', ['one', 'two']],
                    ['page', [['p', 'inner']]],
                    ['sp', 12],
                    ['br'],
                ],
            }),
        ) as Record<string, unknown>;
    }

    it('the baseline really is valid', () => {
        expect(validateSpec(validSpec())).toEqual({ ok: true, errors: [], warnings: [] });
    });

    it('one random mutation never makes validateSpec throw (250 cases)', () => {
        const rng = mulberry32(SEED ^ 0x0badf00d);

        for (let i = 0; i < 250; i += 1) {
            const spec = validSpec();
            const blocks = spec.blocks as unknown[];
            const at = int(rng, blocks.length);

            switch (int(rng, 8)) {
                case 0: // clobber the whole blocks array
                    spec.blocks = junk(rng);
                    break;
                case 1: // replace one block with junk
                    blocks[at] = junk(rng);
                    break;
                case 2: // rename a kind to garbage
                    (blocks[at] as unknown[])[0] = `mut-${String(int(rng, 1000))}`;
                    break;
                case 3: // break a tuple's arity
                    (blocks[at] as unknown[]).push(junk(rng), junk(rng), junk(rng));
                    break;
                case 4: // wrong payload type
                    (blocks[at] as unknown[])[1] = junk(rng);
                    break;
                case 5: // add an unknown top-level field
                    spec[`mut_${String(i)}`] = junk(rng);
                    break;
                case 6: // drop blocks entirely
                    delete spec.blocks;
                    break;
                case 7: // wrap everything in extra page nesting
                default:
                    spec.blocks = (nestedPages(1 + int(rng, 80)) as { blocks: unknown[] }).blocks;
                    break;
            }

            const report = runNeverThrowing(spec, `mutation #${String(i)}`);
            expect(malformation(report), `mutation #${String(i)}`).toBeNull();
        }
    });
});
