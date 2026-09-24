// Pure helpers of the PDF/X corpus gate (scripts/lib/pdfx.ts).

import { describe, it, expect } from 'vitest';

import { detectPdfXClaim, classifyPdfX, pdfxExitCodeFor } from '../../scripts/lib/pdfx.js';

describe('pdfx: detectPdfXClaim', () => {
    it('reads the element form pdfnative writes', () => {
        expect(detectPdfXClaim('<rdf:Description>   <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>')).toEqual({ version: 'PDF/X-4' });
    });

    it('reads the attribute form too', () => {
        expect(detectPdfXClaim('<rdf:Description pdfxid:GTS_PDFXVersion="PDF/X-1a:2003"/>')).toEqual({ version: 'PDF/X-1a:2003' });
    });

    it('returns null for a PDF/A-only or plain file', () => {
        expect(detectPdfXClaim('<pdfaid:part>2</pdfaid:part>')).toBeNull();
        expect(detectPdfXClaim('%PDF-1.7')).toBeNull();
    });
});

describe('pdfx: outcomes and exit codes', () => {
    it('classifies the verdict × expectation matrix', () => {
        expect(classifyPdfX(true, true)).toBe('PASS');
        expect(classifyPdfX(false, false)).toBe('XFAIL');
        expect(classifyPdfX(false, true)).toBe('FAIL');
        expect(classifyPdfX(true, false)).toBe('XPASS');
    });

    it('FAIL or XPASS exits 1, otherwise 0', () => {
        expect(pdfxExitCodeFor({ PASS: 2, FAIL: 0, XFAIL: 1, XPASS: 0 })).toBe(0);
        expect(pdfxExitCodeFor({ PASS: 2, FAIL: 1, XFAIL: 1, XPASS: 0 })).toBe(1);
        expect(pdfxExitCodeFor({ PASS: 2, FAIL: 0, XFAIL: 0, XPASS: 1 })).toBe(1);
    });
});
