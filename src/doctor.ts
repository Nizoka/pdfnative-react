/**
 * Environment pre-flight.
 *
 * `doctor()` answers "will this actually work here?" before you try to render —
 * the library equivalent of `pdfnative doctor`. It is the first call an
 * autonomous agent should make in an unfamiliar environment, and a fast way for
 * a human to see why an install is misbehaving.
 *
 * It is **total**: every check is wrapped, so `doctor()` never throws. It
 * reports rather than raises, which is what makes it safe to call first.
 *
 * One limit worth knowing. `core-bridge` re-exports the engine with a *static*
 * `export … from 'pdfnative'`, so if the peer is not installed at all the module
 * graph fails to resolve and this function is never reached — you get
 * `ERR_MODULE_NOT_FOUND` at import time instead. That is already an unambiguous
 * diagnosis, so we do not contort the architecture to route it through here.
 * What `doctor()` does catch is the subtler case: an engine that resolves but is
 * **older than 1.7.0**, which under a bundler or CJS interop yields an
 * `undefined` export rather than a link error — graded down to 1.6.x and
 * "older still" via two capability probes.
 *
 * @packageDocumentation
 */

import { version as reactVersion } from 'react';
import { estimateChartHeight, validatePrintOptions } from './core-bridge/index.js';
import { version } from './version.js';

/** Outcome of a single {@link doctor} check. */
export type CheckStatus = 'ok' | 'warn' | 'error';

/** One environment check. */
export interface DoctorCheck {
    /** Stable check identifier. */
    readonly name: string;
    /** `'error'` means something will fail; `'warn'` means degraded capability. */
    readonly status: CheckStatus;
    /** The observed value (a version, `'present'`, `'missing'`…). */
    readonly value: string;
    /** What the check means, and what to do when it is not `'ok'`. */
    readonly detail: string;
}

/** The full pre-flight report. */
export interface DoctorReport {
    /** `true` when no check has status `'error'`. */
    readonly ok: boolean;
    /** Checks in a stable order. */
    readonly checks: readonly DoctorCheck[];
}

/** Minimum engine major.minor this release is built against. */
const REQUIRED_ENGINE = '1.7.0';
/** Minimum Node version, inherited from the engine. */
const REQUIRED_NODE_MAJOR = 22;

function check(
    name: string,
    detail: string,
    probe: () => { status: CheckStatus; value: string },
): DoctorCheck {
    try {
        const { status, value } = probe();
        return { name, status, value, detail };
    } catch (err) {
        return {
            name,
            status: 'error',
            value: 'probe failed',
            detail: `${detail} (${err instanceof Error ? err.message : String(err)})`,
        };
    }
}

function nodeCheck(): DoctorCheck {
    return check(
        'node',
        `Node ${String(REQUIRED_NODE_MAJOR)}+ is required by the pdfnative engine. `
            + 'Not applicable in a browser.',
        () => {
            const raw = globalThis.process?.versions?.node;
            if (raw === undefined) return { status: 'ok', value: 'n/a (non-Node runtime)' };
            const major = Number.parseInt(raw.split('.')[0] ?? '0', 10);
            return {
                status: major >= REQUIRED_NODE_MAJOR ? 'ok' : 'error',
                value: raw,
            };
        },
    );
}

function reactCheck(): DoctorCheck {
    return check(
        'react',
        'React 19 is required — the reconciler is bound to a single, pinned version contract.',
        () => {
            const major = Number.parseInt(reactVersion.split('.')[0] ?? '0', 10);
            return { status: major === 19 ? 'ok' : 'error', value: reactVersion };
        },
    );
}

function engineCheck(): DoctorCheck {
    return check(
        'pdfnative',
        `The pdfnative peer dependency must be at ${REQUIRED_ENGINE} or later (probed via `
            + 'capabilities that first ship in 1.7.0 and 1.6.0, newest first). A peer that '
            + 'is absent entirely fails earlier, at module resolution.',
        () => {
            // Probe newest-first: `validatePrintOptions` first ships in 1.7.0
            // (print production), `estimateChartHeight` in 1.6.0 (charts).
            if (typeof validatePrintOptions === 'function') {
                return { status: 'ok', value: `>= ${REQUIRED_ENGINE}` };
            }
            if (typeof estimateChartHeight === 'function') {
                return {
                    status: 'error',
                    value: `1.6.x — this release needs >= ${REQUIRED_ENGINE}; upgrade the pdfnative peer`,
                };
            }
            return { status: 'error', value: 'missing or older than 1.6.0' };
        },
    );
}

function webCryptoCheck(): DoctorCheck {
    return check(
        'web-crypto',
        'A CSPRNG is required for encrypted output (layout.encryption).',
        () => {
            const ok = typeof globalThis.crypto?.getRandomValues === 'function';
            return { status: ok ? 'ok' : 'warn', value: ok ? 'available' : 'unavailable' };
        },
    );
}

function fetchApiCheck(): DoctorCheck {
    return check(
        'fetch-api',
        'Response + ReadableStream are required by renderToResponse.',
        () => {
            const ok =
                typeof globalThis.Response === 'function'
                && typeof globalThis.ReadableStream === 'function';
            return { status: ok ? 'ok' : 'warn', value: ok ? 'available' : 'unavailable' };
        },
    );
}

function blobCheck(): DoctorCheck {
    return check(
        'blob',
        'Blob is required by renderToBlob, usePdf and the viewer components.',
        () => {
            const ok = typeof globalThis.Blob === 'function';
            return { status: ok ? 'ok' : 'warn', value: ok ? 'available' : 'unavailable' };
        },
    );
}

/**
 * Run every environment check and return a structured report.
 *
 * Never throws. `ok` is `false` when any check has status `'error'`. See the
 * module docs for the one case it cannot reach (a peer that is absent entirely).
 *
 * @example
 * ```ts
 * const report = doctor();
 * if (!report.ok) {
 *     for (const c of report.checks.filter((c) => c.status === 'error')) {
 *         console.error(`${c.name}: ${c.value} — ${c.detail}`);
 *     }
 * }
 * ```
 */
export function doctor(): DoctorReport {
    const checks: readonly DoctorCheck[] = [
        {
            name: 'pdfnative-react',
            status: 'ok',
            value: version,
            detail: 'Installed pdfnative-react version.',
        },
        nodeCheck(),
        reactCheck(),
        engineCheck(),
        webCryptoCheck(),
        fetchApiCheck(),
        blobCheck(),
    ];

    return { ok: checks.every((c) => c.status !== 'error'), checks };
}
