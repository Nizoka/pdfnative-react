// Pure helpers of the veraPDF runner (scripts/lib/verapdf.ts).

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { locateVeraPdf, detectPdfAClaim, parseReport, classify, exitCodeFor } from '../../scripts/lib/verapdf.js';

describe('verapdf: locateVeraPdf', () => {
    it('prefers VERAPDF_HOME candidates in order', () => {
        const found = locateVeraPdf({
            env: { VERAPDF_HOME: '/opt/verapdf' },
            exists: (p) => p === join('/opt/verapdf', 'bin', 'verapdf'),
            probePath: () => '/usr/bin/verapdf',
        });
        expect(found).toBe(join('/opt/verapdf', 'bin', 'verapdf'));
    });

    it('falls back to PATH, then null', () => {
        expect(locateVeraPdf({ env: {}, exists: () => false, probePath: () => '/usr/local/bin/verapdf' })).toBe('/usr/local/bin/verapdf');
        expect(locateVeraPdf({ env: {}, exists: () => false, probePath: () => null })).toBeNull();
    });
});

describe('verapdf: detectPdfAClaim', () => {
    it('reads part + conformance from XMP and derives the veraPDF flavour', () => {
        const xmp = '<pdfaid:part>2</pdfaid:part><pdfaid:conformance>U</pdfaid:conformance>';
        expect(detectPdfAClaim(xmp)).toEqual({ part: 2, conformance: 'U', profile: '2u' });
    });

    it('returns null without a full claim', () => {
        expect(detectPdfAClaim('<pdfaid:part>1</pdfaid:part>')).toBeNull();
        expect(detectPdfAClaim('%PDF-1.7 plain')).toBeNull();
    });
});

describe('verapdf: parseReport', () => {
    const report = (attrs: string, rules = ''): string =>
        `<?xml version="1.0"?><report><validationReport ${attrs}>${rules}</validationReport></report>`;

    it('reads the verdict from the single validationReport element', () => {
        const r = parseReport(report('profileName="PDF/A-2B validation profile" isCompliant="true"'));
        expect(r).toEqual({ kind: 'verdict', compliant: true, flavour: 'PDF/A-2B validation profile', failedRules: [] });
    });

    it('lists failed rules regardless of attribute order and de-duplicates them', () => {
        const rules = '<rule specification="ISO 19005-2:2011" clause="6.2.11.4.1" testNumber="1" status="failed"/>'
            + '<rule status="failed" testNumber="1" clause="6.2.11.4.1" specification="ISO 19005-2:2011"/>'
            + '<rule clause="6.1.2" testNumber="2" status="passed"/>';
        const r = parseReport(report('isCompliant="false"', rules));
        expect(r.kind).toBe('verdict');
        if (r.kind === 'verdict') expect(r.failedRules).toEqual(['6.2.11.4.1 t1']);
    });

    it('is INFRA when zero or several reports are present, or isCompliant is missing', () => {
        expect(parseReport('<report/>').kind).toBe('infra');
        expect(parseReport(report('isCompliant="true"') + report('isCompliant="true"')).kind).toBe('infra');
        expect(parseReport(report('profileName="x"')).kind).toBe('infra');
    });
});

describe('verapdf: outcomes and exit codes', () => {
    it('classifies the verdict × expectation matrix', () => {
        expect(classify(true, true)).toBe('PASS');
        expect(classify(false, false)).toBe('XFAIL');
        expect(classify(false, true)).toBe('FAIL');
        expect(classify(true, false)).toBe('XPASS');
    });

    it('INFRA is 2, FAIL/XPASS are 1, otherwise 0', () => {
        const base = { PASS: 3, FAIL: 0, XFAIL: 1, XPASS: 0, INFRA: 0 };
        expect(exitCodeFor(base)).toBe(0);
        expect(exitCodeFor({ ...base, FAIL: 1 })).toBe(1);
        expect(exitCodeFor({ ...base, XPASS: 1 })).toBe(1);
        expect(exitCodeFor({ ...base, INFRA: 1, FAIL: 1 })).toBe(2);
    });
});
