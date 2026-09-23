/**
 * pdfnative-mcp — PDF/X corpus plumbing (pure)
 * =============================================
 * Shared by scripts/validate-pdfx.ts and its unit tests. The verdict itself
 * comes from pdfnative's `validatePdfX()` (structural ISO 15930-7 check);
 * this module only detects the claim and classifies the outcome, exactly
 * like scripts/lib/verapdf.ts does for the veraPDF run.
 *
 * veraPDF does not cover PDF/X, and no open reference validator exists, so a
 * `valid` verdict means the structural prerequisites hold — a certified
 * preflight (callas pdfToolbox, Acrobat Preflight) remains necessary before
 * a file goes to press. The negative canary in the corpus proves the
 * validator still rejects a file it must reject.
 */

export interface PdfXClaim {
    /** e.g. `PDF/X-4` — the XMP `pdfxid:GTS_PDFXVersion` text. */
    readonly version: string;
}

/**
 * Returns the PDF/X claim or null. Reads the XMP property in either its
 * element form (`<pdfxid:GTS_PDFXVersion>PDF/X-4</…>`, what pdfnative
 * writes) or its attribute form (`pdfxid:GTS_PDFXVersion="PDF/X-4"`).
 */
export function detectPdfXClaim(latin1: string): PdfXClaim | null {
    const element = /<pdfxid:GTS_PDFXVersion>\s*([^<]+?)\s*<\/pdfxid:GTS_PDFXVersion>/.exec(latin1)?.[1];
    if (element !== undefined) return { version: element };
    const attribute = /\bpdfxid:GTS_PDFXVersion="([^"]+)"/.exec(latin1)?.[1];
    if (attribute !== undefined) return { version: attribute };
    return null;
}

export type PdfXOutcome = 'PASS' | 'FAIL' | 'XFAIL' | 'XPASS';

/** The verdict × expectation matrix; XPASS means the validator accepts everything. */
export function classifyPdfX(valid: boolean, expectCompliant: boolean): PdfXOutcome {
    if (valid && expectCompliant) return 'PASS';
    if (!valid && !expectCompliant) return 'XFAIL';
    if (!valid) return 'FAIL';
    return 'XPASS';
}

export interface PdfXCounts {
    readonly PASS: number;
    readonly FAIL: number;
    readonly XFAIL: number;
    readonly XPASS: number;
}

export const PDFX_EXIT_OK = 0;
export const PDFX_EXIT_CONFORMANCE = 1;
export const PDFX_EXIT_INFRA = 2;

export function pdfxExitCodeFor(counts: PdfXCounts): number {
    return counts.XPASS > 0 || counts.FAIL > 0 ? PDFX_EXIT_CONFORMANCE : PDFX_EXIT_OK;
}
