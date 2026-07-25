/**
 * Shape validation for a {@link DocSpec}, without a JSON-Schema engine.
 *
 * This is the library's `--dry-run`: an agent (or a config loader) hands over
 * JSON of unknown provenance, and gets back precise, path-anchored findings —
 * *before* anything is compiled or rendered. Zero runtime dependencies, so
 * validation stays available in edge and sandboxed runtimes where bundling a
 * validator is not an option.
 *
 * The rules derive from `BLOCK_REGISTRY`, the same table that builds the JSON
 * Schema, so the two can never disagree about tuple arity or payload types.
 *
 * ### The four dry-run tiers
 *
 * | Tier | Call | Cost | Catches |
 * |---|---|---|---|
 * | 1 | `validateSpec(spec)` | trivial | malformed JSON shape |
 * | 2 | `compileSpec(spec)` | cheap | unmappable structure |
 * | 3 | `lintSpec(spec)` | cheap | a11y & engine-constraint problems |
 * | 4 | `inspectSpec(spec)` | ~a render | pagination & geometry |
 *
 * @packageDocumentation
 */

import { BLOCK_REGISTRY, type BlockPayloadKind } from '../registry.js';
import type { DocSpec } from './types.js';

/** Severity of a {@link SpecFinding}. */
export type SpecFindingSeverity = 'error' | 'warning';

/** Stable validation codes. Branch on these, never on the message. */
export const SpecCode = {
    /** The value is not a plain object. */
    NOT_OBJECT: 'V_NOT_OBJECT',
    /** `blocks` is missing or is not an array. */
    BLOCKS: 'V_BLOCKS',
    /** A block is not a non-empty array. */
    BLOCK_SHAPE: 'V_BLOCK_SHAPE',
    /** A block's first element is not a known tuple kind. */
    UNKNOWN_KIND: 'V_UNKNOWN_KIND',
    /** A block tuple has too few or too many elements. */
    ARITY: 'V_ARITY',
    /** A block's payload has the wrong JavaScript type. */
    PAYLOAD_TYPE: 'V_PAYLOAD_TYPE',
    /** A block's trailing options element is not an object. */
    OPTS_TYPE: 'V_OPTS_TYPE',
    /** An unrecognised top-level field (warning — forward compatibility). */
    UNKNOWN_FIELD: 'V_UNKNOWN_FIELD',
} as const;

/** The value type of {@link SpecCode}. */
export type SpecCodeValue = (typeof SpecCode)[keyof typeof SpecCode];

/** A single validation finding. */
export interface SpecFinding {
    /** Stable machine-readable code. */
    readonly code: SpecCodeValue;
    /** Severity — only `'error'` findings clear `ok`. */
    readonly severity: SpecFindingSeverity;
    /** JSON-path-ish location, e.g. `blocks[3][1]`. */
    readonly path: string;
    /** Human-readable explanation. Not stable across releases. */
    readonly message: string;
}

/** The result of {@link validateSpec}. */
export interface SpecValidation {
    /** `true` when there are no errors. */
    readonly ok: boolean;
    /** Blocking problems. */
    readonly errors: readonly SpecFinding[];
    /** Non-blocking observations. */
    readonly warnings: readonly SpecFinding[];
}

/** Every recognised top-level `DocSpec` field. */
const KNOWN_FIELDS: readonly string[] = [
    'title',
    'footerText',
    'metadata',
    'fontEntries',
    'layout',
    'outline',
    'pageLabels',
    'watermark',
    'header',
    'footer',
    'attachments',
    'tagged',
    'blocks',
];

/** kind → descriptor, flattened from the registry once at module load. */
const BY_KIND = new Map(
    BLOCK_REGISTRY.flatMap((entry) => entry.kinds.map((kind) => [kind as string, entry] as const)),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function payloadMatches(kind: BlockPayloadKind, value: unknown): boolean {
    switch (kind) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'array':
        case 'blocks':
            return Array.isArray(value);
        case 'object':
            return isPlainObject(value);
        case 'none':
            return false;
        default:
            return false;
    }
}

function describe(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function validateBlock(block: unknown, path: string, out: SpecFinding[]): void {
    if (!Array.isArray(block) || block.length === 0) {
        out.push({
            code: SpecCode.BLOCK_SHAPE,
            severity: 'error',
            path,
            message: `Expected a non-empty tuple, got ${describe(block)}.`,
        });
        return;
    }

    const kind: unknown = block[0];
    const descriptor = typeof kind === 'string' ? BY_KIND.get(kind) : undefined;
    if (descriptor === undefined) {
        out.push({
            code: SpecCode.UNKNOWN_KIND,
            severity: 'error',
            path: `${path}[0]`,
            message: `Unknown block kind ${JSON.stringify(kind)}. Valid kinds: ${[...BY_KIND.keys()].join(', ')}.`,
        });
        return;
    }

    if (block.length < descriptor.minItems || block.length > descriptor.maxItems) {
        const expected =
            descriptor.minItems === descriptor.maxItems
                ? String(descriptor.minItems)
                : `${String(descriptor.minItems)}–${String(descriptor.maxItems)}`;
        out.push({
            code: SpecCode.ARITY,
            severity: 'error',
            path,
            message: `${descriptor.tuple} takes ${expected} elements, got ${String(block.length)}.`,
        });
        return;
    }

    // Payload — element [1], when the tuple carries one.
    if (block.length > 1 && descriptor.payload !== 'none') {
        const payload: unknown = block[1];
        if (!payloadMatches(descriptor.payload, payload)) {
            out.push({
                code: SpecCode.PAYLOAD_TYPE,
                severity: 'error',
                path: `${path}[1]`,
                message: `Expected ${descriptor.payload === 'blocks' ? 'an array of blocks' : `a ${descriptor.payload}`}, got ${describe(payload)}.`,
            });
        } else if (descriptor.payload === 'blocks') {
            (payload as readonly unknown[]).forEach((nested, i) => {
                validateBlock(nested, `${path}[1][${String(i)}]`, out);
            });
        }
    }

    // Options — element [2], always an object when present.
    if (block.length > 2 && !isPlainObject(block[2])) {
        out.push({
            code: SpecCode.OPTS_TYPE,
            severity: 'error',
            path: `${path}[2]`,
            message: `Expected an options object, got ${describe(block[2])}.`,
        });
    }
}

/**
 * Validate the *shape* of an untrusted value against the `DocSpec` grammar.
 *
 * Structural only — it deliberately does not check semantics (a pie chart with
 * two series is well-formed here; `lintSpec` is what catches that).
 *
 * Never throws: malformed input produces findings, not exceptions.
 *
 * @example
 * ```ts
 * const result = validateSpec(JSON.parse(untrusted));
 * if (!result.ok) {
 *     for (const e of result.errors) console.error(`${e.path}: ${e.message}`);
 * } else {
 *     const bytes = renderSpecToBytes(untrusted as DocSpec);
 * }
 * ```
 */
export function validateSpec(spec: unknown): SpecValidation {
    const findings: SpecFinding[] = [];

    if (!isPlainObject(spec)) {
        findings.push({
            code: SpecCode.NOT_OBJECT,
            severity: 'error',
            path: '',
            message: `A DocSpec must be an object, got ${describe(spec)}.`,
        });
        return { ok: false, errors: findings, warnings: [] };
    }

    for (const key of Object.keys(spec)) {
        if (!KNOWN_FIELDS.includes(key)) {
            findings.push({
                code: SpecCode.UNKNOWN_FIELD,
                severity: 'warning',
                path: key,
                message: `Unknown top-level field "${key}"; it will be ignored.`,
            });
        }
    }

    const blocks: unknown = spec.blocks;
    if (!Array.isArray(blocks)) {
        findings.push({
            code: SpecCode.BLOCKS,
            severity: 'error',
            path: 'blocks',
            message: `"blocks" is required and must be an array, got ${describe(blocks)}.`,
        });
    } else {
        blocks.forEach((block, i) => {
            validateBlock(block, `blocks[${String(i)}]`, findings);
        });
    }

    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    return { ok: errors.length === 0, errors, warnings };
}

// Re-exported so `validateSpec` users have the type at hand.
export type { DocSpec };
