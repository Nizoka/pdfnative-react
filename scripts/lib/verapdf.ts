/**
 * pdfnative-react — veraPDF plumbing (pure parts + the one spawn)
 * ==================================================================
 * Shared by scripts/validate-pdfa.ts and scripts/gate.ts (skip condition).
 * Everything except `runVeraPdf` is a pure function over strings so it can
 * be unit-tested with inline fixtures (tests/tools/verapdf.test.ts). Ported
 * verbatim from pdfnative-mcp 1.7.0; the `.bat` handling is what this
 * repository's 1.2.0 validate-pdfa.mjs already carried.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Corpus manifest (written by scripts/generate-pdfa-corpus.ts) ─────

export interface CorpusFile {
    readonly file: string;
    /** The authoring door the file was rendered through. */
    readonly door: 'jsx' | 'spec';
    /** One line describing the entry. */
    readonly entry: string;
    readonly bytes: number;
    readonly sha256: string;
    /** The file claims PDF/A in its XMP (`pdfaid:part` + `pdfaid:conformance`). */
    readonly expectPdfAClaim: boolean;
    /** Under a PDF/A claim: veraPDF must accept it (false = negative canary). */
    readonly expectCompliant: boolean;
    /** The file claims PDF/X-4 in its XMP (`pdfxid:GTS_PDFXVersion`). */
    readonly expectPdfXClaim: boolean;
    /** Under a PDF/X claim: validatePdfX() must accept it (false = negative canary). */
    readonly expectPdfXCompliant: boolean;
}

export interface CorpusManifest {
    readonly generatedBy: string;
    readonly files: readonly CorpusFile[];
}

// ── Locate the launcher ─────────────────────────────────────────────

export interface LocateDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly exists: (p: string) => boolean;
    /** `which`/`where verapdf` — returns the first path or null. */
    readonly probePath: () => string | null;
}

const DEFAULT_LOCATE: LocateDeps = {
    env: process.env,
    exists: existsSync,
    probePath: () => {
        const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['verapdf'], { encoding: 'utf8', windowsHide: true });
        if (probe.status === 0 && probe.stdout.trim().length > 0) return probe.stdout.trim().split(/\r?\n/)[0] ?? null;
        return null;
    },
};

/**
 * `VERAPDF_HOME` first (`verapdf` / `verapdf.bat` at the root or under
 * `bin/`), then whatever `verapdf` is on PATH. Null when nothing is found.
 */
export function locateVeraPdf(deps: LocateDeps = DEFAULT_LOCATE): string | null {
    const home = deps.env.VERAPDF_HOME;
    if (home) {
        for (const c of ['verapdf', 'verapdf.bat', join('bin', 'verapdf'), join('bin', 'verapdf.bat')]) {
            const candidate = join(home, c);
            if (deps.exists(candidate)) return candidate;
        }
    }
    return deps.probePath();
}

// ── Claim detection (XMP) ───────────────────────────────────────────

export interface PdfAClaim {
    readonly part: number;
    readonly conformance: string;
    /** veraPDF flavour id: 1b / 2b / 2u / 3b / … */
    readonly profile: string;
}

/** Returns the PDF/A claim or null when the file makes none. */
export function detectPdfAClaim(latin1: string): PdfAClaim | null {
    const part = /<pdfaid:part>(\d)<\/pdfaid:part>/.exec(latin1)?.[1];
    const conf = /<pdfaid:conformance>([A-Z])<\/pdfaid:conformance>/.exec(latin1)?.[1];
    if (part === undefined || conf === undefined) return null;
    return { part: Number.parseInt(part, 10), conformance: conf, profile: `${part}${conf.toLowerCase()}` };
}

// ── Report parsing ──────────────────────────────────────────────────

export type ReportParse =
    | { readonly kind: 'infra'; readonly detail: string }
    | { readonly kind: 'verdict'; readonly compliant: boolean; readonly flavour: string; readonly failedRules: readonly string[] };

/**
 * Parse ONE veraPDF XML report. veraPDF runs with exactly one input file, so
 * the report must contain exactly one <validationReport …> element; anything
 * else (none, several) is an INFRA outcome rather than a verdict. The
 * `isCompliant` attribute is read from that element only — never matched
 * globally across the document.
 */
export function parseReport(xml: string): ReportParse {
    const reports = Array.from(xml.matchAll(/<validationReport\b([^>]*)>/g));
    if (reports.length !== 1) {
        return { kind: 'infra', detail: `expected exactly one <validationReport>, found ${reports.length}` };
    }
    const attrs = reports[0][1] ?? '';
    const compliant = /\bisCompliant="(true|false)"/.exec(attrs)?.[1];
    if (compliant === undefined) {
        return { kind: 'infra', detail: '<validationReport> has no isCompliant attribute' };
    }
    const flavour = /\bprofileName="([^"]*)"/.exec(attrs)?.[1] ?? '';
    // Attribute order inside <rule> is not guaranteed by veraPDF, so each
    // attribute is read independently from the element's attribute string.
    const failedRules: string[] = [];
    for (const m of xml.matchAll(/<rule\b([^>]*)>/gi)) {
        const a = m[1] ?? '';
        if (!/\bstatus="failed"/i.test(a)) continue;
        const clause = /\bclause="([^"]+)"/.exec(a)?.[1] ?? '?';
        const test = /\btestNumber="([^"]+)"/.exec(a)?.[1] ?? '?';
        failedRules.push(`${clause} t${test}`);
    }
    return { kind: 'verdict', compliant: compliant === 'true', flavour, failedRules: Array.from(new Set(failedRules)) };
}

// ── Outcomes ────────────────────────────────────────────────────────

export type Outcome = 'PASS' | 'FAIL' | 'XFAIL' | 'XPASS';

/** The verdict × expectation matrix; XPASS means the validator accepts everything. */
export function classify(compliant: boolean, expectCompliant: boolean): Outcome {
    if (compliant && expectCompliant) return 'PASS';
    if (!compliant && !expectCompliant) return 'XFAIL';
    if (!compliant) return 'FAIL';
    return 'XPASS';
}

export interface Counts {
    readonly PASS: number;
    readonly FAIL: number;
    readonly XFAIL: number;
    readonly XPASS: number;
    readonly INFRA: number;
}

export const EXIT_OK = 0;
export const EXIT_CONFORMANCE = 1;
export const EXIT_INFRA = 2;

/**
 * Exit code for a completed run: INFRA (no usable report) is 2 because it
 * is not a conformance verdict; XPASS is 1 and taints every PASS line.
 */
export function exitCodeFor(counts: Counts): number {
    if (counts.INFRA > 0) return EXIT_INFRA;
    if (counts.XPASS > 0 || counts.FAIL > 0) return EXIT_CONFORMANCE;
    return EXIT_OK;
}

// ── The spawn ───────────────────────────────────────────────────────

export interface VeraRun {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly error: string | null;
}

/**
 * Windows: a `.bat` launcher cannot be spawned without a shell (Node rejects
 * it with EINVAL since the CVE-2024-27980 hardening); shell mode performs no
 * escaping, so every argument is quoted explicitly.
 */
export function runVeraPdf(verapdf: string, args: readonly string[]): VeraRun {
    const isBatch = /\.(bat|cmd)$/i.test(verapdf);
    const quote = (s: string): string => (isBatch ? `"${s}"` : s);
    const r = spawnSync(quote(verapdf), args.map(quote), {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isBatch,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ? String(r.error.message ?? r.error) : null };
}

/** Run `verapdf --version`; returns the version line or an error string (never throws). */
export function probeVeraPdf(verapdf: string): { ok: true; detail: string } | { ok: false; detail: string } {
    const r = runVeraPdf(verapdf, ['--version']);
    if (r.error) return { ok: false, detail: r.error };
    const line = r.stdout.split(/\r?\n/).find((l) => /verapdf/i.test(l));
    if (r.status !== 0 || line === undefined) {
        return { ok: false, detail: `exit ${r.status}; stderr: ${r.stderr.trim().slice(0, 400) || '(empty)'}` };
    }
    return { ok: true, detail: line.trim() };
}
