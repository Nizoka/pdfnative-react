/**
 * Reproducible output — the promise `creationDate` and `setDefaultCreationDate`
 * make, checked on real bytes.
 *
 * With engine 1.8.0 every date is written in UTC and the trailer `/ID` derives
 * from the creation instant, so a pinned document renders to the same bytes on
 * every host. The two-time-zone proof over the *built* package lives in
 * `tests/regression/reproducible-build.test.ts`; this file holds the in-process
 * contract: the prop, the DocSpec string form, the process-wide pin and its
 * precedence, and the `{date}` placeholder following the pin.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    getDefaultCreationDate,
    renderSpecToBytes,
    renderToBytes,
    setDefaultCreationDate,
} from '../src/index.js';

const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);
const PINNED = new Date('2026-01-01T00:00:00Z');
const CREATION_DATE = /\/CreationDate \(D:(\d{14})([+-]\d{2}'\d{2}')\)/;

const doc = (creationDate?: Date | string) => (
    <Document title="Reproducible" creationDate={creationDate} header={{ right: 'Built {date}' }}>
        <Heading level={1}>Reproducible</Heading>
        <Paragraph>Same inputs, same instant, same bytes.</Paragraph>
    </Document>
);

afterEach(() => setDefaultCreationDate(null));

describe('creationDate', () => {
    it('pins /CreationDate in UTC, from a Date or an ISO string', () => {
        for (const pin of [PINNED, '2026-01-01T00:00:00Z', '2026-01-01T02:00:00+02:00']) {
            const text = latin1(renderToBytes(doc(pin)));
            const m = CREATION_DATE.exec(text);
            expect(m?.[1], String(pin)).toBe('20260101000000');
            expect(m?.[2], String(pin)).toBe("+00'00'");
        }
    });

    it('renders the same bytes twice', () => {
        expect(latin1(renderToBytes(doc(PINNED)))).toBe(latin1(renderToBytes(doc(PINNED))));
    });

    it('renders the same bytes through the DocSpec door', () => {
        const spec = renderSpecToBytes({
            title: 'Reproducible',
            creationDate: '2026-01-01T00:00:00Z',
            header: { right: 'Built {date}' },
            blocks: [['h1', 'Reproducible'], ['p', 'Same inputs, same instant, same bytes.']],
        });
        expect(latin1(spec)).toBe(latin1(renderToBytes(doc(PINNED))));
    });

    it('drives the {date} placeholder: two pins differ, one pin repeats', () => {
        const a = latin1(renderToBytes(doc(PINNED)));
        const b = latin1(renderToBytes(doc(new Date('2025-06-15T12:00:00Z'))));
        expect(a).not.toBe(b);
        // The header is the only text difference: 2026-01-01 vs 2025-06-15.
        expect(a).toContain('20260101');
        expect(b).toContain('20250615');
    });

    it('writes UTC even without a pin (the offset is never the host zone)', () => {
        const m = CREATION_DATE.exec(latin1(renderToBytes(doc())));
        expect(m?.[2]).toBe("+00'00'");
    });
});

describe('setDefaultCreationDate', () => {
    it('is the same instant as the per-document prop, byte for byte', () => {
        setDefaultCreationDate(PINNED);
        const viaDefault = latin1(renderToBytes(doc()));
        setDefaultCreationDate(null);
        const viaProp = latin1(renderToBytes(doc(PINNED)));
        expect(viaDefault).toBe(viaProp);
    });

    it('loses to an explicit creationDate on the document', () => {
        setDefaultCreationDate(new Date('2020-01-01T00:00:00Z'));
        const m = CREATION_DATE.exec(latin1(renderToBytes(doc(PINNED))));
        expect(m?.[1]).toBe('20260101000000');
    });

    it('round-trips through getDefaultCreationDate and null restores the clock', () => {
        expect(getDefaultCreationDate()).toBeNull();
        setDefaultCreationDate(PINNED);
        expect(getDefaultCreationDate()?.toISOString()).toBe(PINNED.toISOString());
        setDefaultCreationDate(null);
        expect(getDefaultCreationDate()).toBeNull();
    });
});
