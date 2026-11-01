/**
 * `direction` (engine ≥ 1.9.0) — the base text direction of a paragraph.
 *
 * `<Document direction>` is layout sugar folded into `layout.direction`;
 * `<Paragraph direction>` overrides it per block; the DocSpec twins are the
 * `direction` field and the paragraph opt. Omitted, the bytes of every
 * existing document stay the same — that is the invariant worth the most.
 *
 * The real-bytes cases hold the engine to what the release note says: under
 * `direction: 'auto'` an Arabic paragraph is set from the right margin and
 * its right-to-left run carries the logical text as an untagged
 * `/Span /ActualText` (ledger C27), which `layout.actualText: false` removes.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Paragraph,
    compileDocument,
    compileSpec,
    renderToBytes,
    resolveFonts,
    schema,
    validateSpec,
} from '../src/index.js';
import type { DocSpec } from '../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
    ar: () => import('pdfnative/fonts/noto-arabic-data.js'),
});

const PINNED = new Date('2026-01-01T00:00:00Z');
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);
// demo-language: ar (a right-to-left shaping demonstration)
const ARABIC = 'السلام عليكم ورحمة الله.';

describe('direction — the compiled model', () => {
    it('folds <Document direction> into layout.direction and nothing else', () => {
        const model = compileDocument(
            <Document direction="rtl">
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ direction: 'rtl' });
    });

    it('leaves layout undefined when direction is not set (byte identity)', () => {
        const model = compileDocument(
            <Document>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toBeUndefined();
    });

    it('an explicit layout wins over the sugar', () => {
        const model = compileDocument(
            <Document direction="rtl" layout={{ direction: 'ltr' }}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout).toEqual({ direction: 'ltr' });
    });

    it('serialises <Paragraph direction> only when set', () => {
        const model = compileDocument(
            <Document>
                <Paragraph direction="ltr">forced</Paragraph>
                <Paragraph>plain</Paragraph>
            </Document>,
        );
        expect(model.blocks[0]).toMatchObject({ type: 'paragraph', direction: 'ltr' });
        expect(model.blocks[1]).not.toHaveProperty('direction');
    });

    it('compiles to the same shape from the DocSpec twin', () => {
        const spec: DocSpec = {
            direction: 'auto',
            blocks: [
                ['p', 'forced', { direction: 'ltr' }],
                ['p', 'plain'],
            ],
        };
        expect(validateSpec(spec)).toEqual({ ok: true, errors: [], warnings: [] });
        expect(compileSpec(spec)).toEqual(
            compileDocument(
                <Document direction="auto">
                    <Paragraph direction="ltr">forced</Paragraph>
                    <Paragraph>plain</Paragraph>
                </Document>,
            ),
        );
    });

    it('is described by the schema at both levels with the engine enum', () => {
        const doc = schema('doc-spec');
        const props = doc['properties'] as Record<string, Record<string, unknown>>;
        expect(props['direction']?.['enum']).toEqual(['auto', 'ltr', 'rtl']);
        expect(JSON.stringify(doc)).toContain('"direction":{"enum":["auto","ltr","rtl"]');
    });
});

describe('direction — real bytes', () => {
    const arabic = (direction?: 'auto' | 'ltr' | 'rtl', actualText?: boolean) =>
        renderToBytes(
            <Document
                title="RTL"
                fontEntries={fontEntries}
                creationDate={PINNED}
                direction={direction}
                layout={{ compress: false, ...(actualText === undefined ? {} : { actualText }) }}
            >
                <Paragraph>{ARABIC}</Paragraph>
            </Document>,
        );

    /** The x of the first text-positioning operator of the page's text object. */
    const firstX = (bytes: Uint8Array): number => {
        const text = latin1(bytes);
        const at = text.indexOf('\nBT\n');
        const m = /(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) Td/.exec(text.slice(at));
        if (at < 0 || m === null) throw new Error('no text object');
        return Number(m[1]);
    };

    it("sets an Arabic paragraph from the right margin under 'auto', from the left under 'ltr'", () => {
        expect(firstX(arabic('auto'))).toBeGreaterThan(400);
        expect(firstX(arabic('ltr'))).toBe(36);
        expect(latin1(arabic('rtl'))).toBe(latin1(arabic('auto')));
        expect(latin1(arabic('ltr'))).not.toBe(latin1(arabic('auto')));
    });

    it('carries the logical text of a right-to-left run as an untagged /ActualText span (C27), whatever the direction', () => {
        // The span is the engine's since 1.9.0 on every right-to-left run; the
        // UTF-16BE payload is the source string in logical order.
        const text = latin1(arabic('auto'));
        expect(text).toContain('/Span << /ActualText <FEFF0627');
        expect(latin1(arabic())).toContain('/ActualText');
    });

    it('layout.actualText: false removes the span and keeps the glyphs', () => {
        const text = latin1(arabic('auto', false));
        expect(text).not.toContain('/ActualText');
        expect(text).toContain('/FontFile2');
    });

    it('without a direction the bytes equal a build that never mentions it', () => {
        const explicit = renderToBytes(
            <Document title="RTL" fontEntries={fontEntries} creationDate={PINNED} layout={{ compress: false }}>
                <Paragraph>{ARABIC}</Paragraph>
            </Document>,
        );
        expect(latin1(arabic())).toBe(latin1(explicit));
    });
});
