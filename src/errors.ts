/**
 * Stable error taxonomy.
 *
 * Every error this package throws carries a machine-readable {@link ErrorCode}
 * alongside its human-readable message, and serializes to the same envelope
 * shape used across the pdfnative ecosystem:
 *
 * ```json
 * { "ok": false, "error": { "code": "E_STRUCTURE", "message": "…" } }
 * ```
 *
 * Agents (and CI) branch on `code`, never on prose — messages may be reworded
 * in any release, codes may not.
 *
 * @packageDocumentation
 */

/** Stable, machine-readable error classes. Codes are part of the public API. */
export const ErrorCode = {
    /** A component tree or spec could not be mapped onto the pdfnative model. */
    STRUCTURE: 'E_STRUCTURE',
    /** Input failed validation (bad prop, malformed `DocSpec`, unknown subject). */
    INPUT: 'E_INPUT',
    /** The requested capability exists but is not available here. */
    UNSUPPORTED: 'E_UNSUPPORTED',
    /** The runtime environment is missing something required (peer, Node, Web API). */
    ENV: 'E_ENV',
    /** An AI-governance policy rule was violated. */
    POLICY: 'E_POLICY',
    /** Anything else. */
    RUNTIME: 'E_RUNTIME',
} as const;

/** The value type of {@link ErrorCode}. */
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** The JSON envelope produced by {@link PdfReactError.toJSON}. */
export interface ErrorEnvelope {
    readonly ok: false;
    readonly error: {
        readonly code: ErrorCodeValue;
        readonly message: string;
    };
}

/**
 * Base class for every error thrown by pdfnative-react.
 *
 * Prefer catching this over the concrete subclasses and branching on
 * {@link PdfReactError.code}.
 *
 * Accepts the standard ES2022 `ErrorOptions`, so a wrapped failure keeps its
 * original error reachable via `error.cause`. The JSON envelope deliberately
 * omits the cause — it may hold non-serializable state.
 */
export class PdfReactError extends Error {
    /** Stable machine-readable classification. */
    public readonly code: ErrorCodeValue;

    constructor(
        message: string,
        code: ErrorCodeValue = ErrorCode.RUNTIME,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'PdfReactError';
        this.code = code;
    }

    /** Serialize to the ecosystem's standard error envelope. */
    public toJSON(): ErrorEnvelope {
        return { ok: false, error: { code: this.code, message: this.message } };
    }
}

/**
 * Thrown when a component tree cannot be mapped onto the pdfnative model —
 * a root that is not `<Document>`, or a component used where a block was
 * expected.
 *
 * Carries `code: 'E_STRUCTURE'`.
 */
export class PdfStructureError extends PdfReactError {
    constructor(
        message: string,
        code: ErrorCodeValue = ErrorCode.STRUCTURE,
        options?: ErrorOptions,
    ) {
        super(message, code, options);
        this.name = 'PdfStructureError';
    }
}

/**
 * Message prefixes of the *input* errors the engine throws at build time —
 * bad print geometry, an incoherent PDF/X request, an unusable output-intent
 * profile, invalid chart data, a PDF/A conflict. The engine serves every one
 * of these messages verbatim in its `docs/data/errors.json` (`buildErrors`),
 * which is where this table is checked against.
 *
 * {@link toErrorEnvelope} classifies a plain `Error` starting with one of them
 * as `E_INPUT` rather than `E_RUNTIME`, so an agent that only reads the
 * envelope can tell "fix the document" from "something broke". Every one of
 * these throws is also pre-empted by a `lintDocument` rule, which is the
 * better place to catch it.
 */
export const ENGINE_INPUT_ERROR_PREFIXES: readonly string[] = [
    'layout.pdfx',
    'PDF/X',
    'PDF/A and encryption',
    'File attachments require',
    'print.',
    'outputIntent.',
    'layout.outputIntent',
    'chart:',
];

/**
 * Build an error envelope from an arbitrary thrown value, so agent-facing code
 * can report *any* failure in the standard shape.
 *
 * An engine build-time input error (see {@link ENGINE_INPUT_ERROR_PREFIXES})
 * is reported as `E_INPUT`; anything else that is not a {@link PdfReactError}
 * is `E_RUNTIME`.
 */
export function toErrorEnvelope(err: unknown): ErrorEnvelope {
    if (err instanceof PdfReactError) return err.toJSON();
    const message = err instanceof Error ? err.message : String(err);
    const code =
        err instanceof Error && ENGINE_INPUT_ERROR_PREFIXES.some((p) => message.startsWith(p))
            ? ErrorCode.INPUT
            : ErrorCode.RUNTIME;
    return { ok: false, error: { code, message } };
}
