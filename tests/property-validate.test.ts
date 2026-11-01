// @vitest-environment node
/**
 * Property-based tests of the untrusted-input surface.
 *
 * `tests/fuzz-validate.test.ts` replays a fixed, seeded corpus of *malformed*
 * specs through `validateSpec`. This file is the complementary tier: fast-check
 * searches the input space (and shrinks a failure to its smallest witness) for
 * the four functions an agent calls before — or instead of — rendering, and
 * asserts their documented contracts hold for *every* input:
 *
 *   - `validateSpec(unknown)` never throws and returns `{ ok, errors, warnings }`;
 *   - `lintSpec(spec)` never throws on a spec `validateSpec` accepts, and returns
 *     `{ ok, findings, counts }` with registry codes only;
 *   - `toErrorEnvelope(unknown)` never throws and returns `{ ok: false, error }`
 *     with one of the six documented codes;
 *   - `doctor()` never throws and returns `{ ok, checks }`.
 *
 * Runs are bounded (`numRuns`) so the suite stays fast; a failure prints the
 * shrunk counter-example and the seed to replay it.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
    ErrorCode,
    LINT_RULE_CODES,
    doctor,
    lintSpec,
    toErrorEnvelope,
    validateSpec,
} from '../src/index.js';
import type { DocSpec, LintReport, SpecValidation } from '../src/index.js';

const NUM_RUNS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Shape checks — plain functions, so a failure names the broken invariant and
// fast-check can shrink the input that caused it.
// ─────────────────────────────────────────────────────────────────────────────

function validationShapeProblem(report: SpecValidation): string | null {
    if (typeof report !== 'object' || report === null) return 'report is not an object';
    if (typeof report.ok !== 'boolean') return 'ok is not a boolean';
    if (!Array.isArray(report.errors)) return 'errors is not an array';
    if (!Array.isArray(report.warnings)) return 'warnings is not an array';
    if (report.ok !== (report.errors.length === 0)) return 'ok disagrees with errors';
    for (const f of [...report.errors, ...report.warnings]) {
        if (typeof f.code !== 'string' || !f.code.startsWith('V_')) return `code ${String(f.code)} is not a V_* code`;
        if (f.severity !== 'error' && f.severity !== 'warning') return `severity ${String(f.severity)}`;
        if (typeof f.path !== 'string') return 'path is not a string';
        if (typeof f.message !== 'string' || f.message.length === 0) return 'message is empty';
    }
    return null;
}

const LINT_CODES: ReadonlySet<string> = new Set(LINT_RULE_CODES);

function lintShapeProblem(report: LintReport): string | null {
    if (typeof report !== 'object' || report === null) return 'report is not an object';
    if (typeof report.ok !== 'boolean') return 'ok is not a boolean';
    if (!Array.isArray(report.findings)) return 'findings is not an array';
    if (typeof report.counts !== 'object' || report.counts === null) return 'counts is not an object';
    let errors = 0;
    for (const f of report.findings) {
        if (!LINT_CODES.has(f.code)) return `code ${String(f.code)} is not a LINT_RULE_CODES member`;
        if (f.severity !== 'error' && f.severity !== 'warning' && f.severity !== 'info') return `severity ${String(f.severity)}`;
        if (typeof f.message !== 'string' || f.message.length === 0) return 'message is empty';
        if (f.severity === 'error') errors += 1;
    }
    if (report.ok !== (errors === 0)) return 'ok disagrees with the error findings';
    if (report.counts.error !== errors) return 'counts.error disagrees with the findings';
    return null;
}

const ERROR_CODES: ReadonlySet<string> = new Set(Object.values(ErrorCode));

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/** A DocSpec-shaped value: a title and an array of plausible block tuples. */
const docSpecArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
    block: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        fc.tuple(fc.constantFrom('h1', 'h2', 'h3'), fc.string({ maxLength: 40 })),
        fc.tuple(fc.constantFrom('h1', 'h2', 'h3'), fc.string({ maxLength: 40 }), fc.record({ keepWithNext: fc.boolean() })),
        fc.tuple(fc.constant('p'), fc.string({ maxLength: 120 })),
        fc.tuple(
            fc.constant('p'),
            fc.string({ maxLength: 120 }),
            fc.record({ align: fc.constantFrom('left', 'center', 'right', 'justify'), splittable: fc.boolean() }, { requiredKeys: [] }),
        ),
        fc.tuple(fc.constantFrom('ul', 'ol'), fc.array(fc.string({ maxLength: 30 }), { maxLength: 6 })),
        fc.tuple(fc.constant('sp'), fc.integer({ min: 0, max: 200 })),
        fc.tuple(fc.constant('br')),
        fc.tuple(fc.constant('page'), fc.array(tie('block'), { maxLength: 4 })),
    ),
    spec: fc.record(
        {
            title: fc.string({ maxLength: 60 }),
            footerText: fc.string({ maxLength: 60 }),
            blocks: fc.array(tie('block'), { maxLength: 8 }),
        },
        { requiredKeys: ['blocks'] },
    ),
})).spec;

/** Anything JSON could carry, plus every JavaScript oddity `fc.anything()` knows. */
const untrustedArb: fc.Arbitrary<unknown> = fc.oneof(
    fc.anything(),
    fc.jsonValue(),
    fc.dictionary(fc.string(), fc.anything()),
    fc.dictionary(fc.constantFrom('blocks', 'title', 'metadata', 'fonts', 'outline', 'typography'), fc.anything()),
    docSpecArb,
);

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSpec — total over every input', () => {
    it('never throws and returns a well-formed report', () => {
        fc.assert(
            fc.property(untrustedArb, (input) => {
                const report = validateSpec(input);
                expect(validationShapeProblem(report)).toBeNull();
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it('rejects every non-object input', () => {
        fc.assert(
            fc.property(fc.oneof(fc.string(), fc.double(), fc.boolean(), fc.constant(null), fc.array(fc.anything())), (input) => {
                expect(validateSpec(input).ok).toBe(false);
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it('accepts every DocSpec-shaped document and reports it idempotently', () => {
        fc.assert(
            fc.property(docSpecArb, (spec) => {
                const first = validateSpec(spec);
                expect(validationShapeProblem(first)).toBeNull();
                expect(first.ok).toBe(true);
                expect(validateSpec(spec)).toEqual(first);
            }),
            { numRuns: NUM_RUNS },
        );
    });
});

describe('lintSpec — never throws on a spec validateSpec accepts', () => {
    it('returns a well-formed report with registry codes only', () => {
        fc.assert(
            fc.property(docSpecArb, (spec) => {
                fc.pre(validateSpec(spec).ok);
                const report = lintSpec(spec as DocSpec);
                expect(lintShapeProblem(report)).toBeNull();
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it('is deterministic', () => {
        fc.assert(
            fc.property(docSpecArb, (spec) => {
                fc.pre(validateSpec(spec).ok);
                expect(lintSpec(spec as DocSpec)).toEqual(lintSpec(spec as DocSpec));
            }),
            { numRuns: 50 },
        );
    });
});

describe('toErrorEnvelope — total over every thrown value', () => {
    it('never throws and returns { ok: false, error: { code, message } } with a documented code', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    untrustedArb,
                    fc.string().map((m) => new Error(m)),
                    fc.string().map((m) => new TypeError(m)),
                    fc.constantFrom('PDF/X', 'layout.pdfx', 'chart:', 'print.', 'outputIntent.').chain((p) => fc.string().map((m) => new Error(`${p}${m}`))),
                ),
                (thrown) => {
                    const envelope = toErrorEnvelope(thrown);
                    expect(envelope.ok).toBe(false);
                    expect(ERROR_CODES.has(envelope.error.code)).toBe(true);
                    expect(typeof envelope.error.message).toBe('string');
                },
            ),
            { numRuns: NUM_RUNS },
        );
    });

    it('survives a thrown value with no primitive conversion', () => {
        // `String(x)` throws a TypeError for these — fast-check finds them
        // through `fc.anything()`; pinned here so the failure names the cause.
        const hostile: Array<[string, unknown]> = [
            ['null prototype', Object.create(null) as unknown],
            ['non-callable toString', { toString: 5 }],
            ['non-callable toString and valueOf', { toString: 1, valueOf: 1 }],
        ];
        for (const [label, value] of hostile) {
            expect(() => toErrorEnvelope(value), label).not.toThrow();
            expect(toErrorEnvelope(value).error.code, label).toBe(ErrorCode.RUNTIME);
        }
    });

    it('classifies an engine input-error prefix as E_INPUT and anything else as E_RUNTIME', () => {
        fc.assert(
            fc.property(fc.string(), (message) => {
                const engineLike = toErrorEnvelope(new Error(`PDF/X ${message}`));
                expect(engineLike.error.code).toBe(ErrorCode.INPUT);
                const plain = toErrorEnvelope(new Error(`unrelated ${message}`));
                expect(plain.error.code).toBe(ErrorCode.RUNTIME);
            }),
            { numRuns: 50 },
        );
    });
});

describe('doctor — total', () => {
    it('never throws and returns { ok, checks } with ok agreeing with the checks', () => {
        for (let i = 0; i < 3; i += 1) {
            const report = doctor();
            expect(typeof report.ok).toBe('boolean');
            expect(Array.isArray(report.checks)).toBe(true);
            expect(report.checks.length).toBeGreaterThan(0);
            for (const c of report.checks) {
                expect(typeof c.name).toBe('string');
                expect(['ok', 'warn', 'error']).toContain(c.status);
                expect(typeof c.value).toBe('string');
                expect(typeof c.detail).toBe('string');
            }
            expect(report.ok).toBe(report.checks.every((c) => c.status !== 'error'));
        }
    });
});
