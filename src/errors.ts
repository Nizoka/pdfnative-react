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
 */
export class PdfReactError extends Error {
    /** Stable machine-readable classification. */
    public readonly code: ErrorCodeValue;

    constructor(message: string, code: ErrorCodeValue = ErrorCode.RUNTIME) {
        super(message);
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
    constructor(message: string, code: ErrorCodeValue = ErrorCode.STRUCTURE) {
        super(message, code);
        this.name = 'PdfStructureError';
    }
}

/**
 * Build an error envelope from an arbitrary thrown value, so agent-facing code
 * can report *any* failure in the standard shape.
 */
export function toErrorEnvelope(err: unknown): ErrorEnvelope {
    if (err instanceof PdfReactError) return err.toJSON();
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { code: ErrorCode.RUNTIME, message } };
}
