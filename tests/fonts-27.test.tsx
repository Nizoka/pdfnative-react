/**
 * The five scripts pdfnative 1.8.0 adds — Lao, Tai Tham, New Tai Lue, Tai Le
 * and Cham — and the four Latin-module aliases (Hausa, Yoruba, Igbo, Swahili),
 * through `resolveFonts`.
 *
 * `resolveFonts` enumerates nothing: any language key maps to any font-data
 * loader, so no code changed for the new scripts. This file is the evidence
 * that the documented path works for each of them — the font resolves, the
 * reference carries the ISO 32000 leading slash, and a paragraph in the script
 * renders with the font embedded.
 */
import { describe, expect, it } from 'vitest';
import { Document, Paragraph, renderToBytes, resolveFonts } from '../src/index.js';

const NEW_SCRIPTS = {
    lo: () => import('pdfnative/fonts/noto-lao-data.js'),
    nod: () => import('pdfnative/fonts/noto-taitham-data.js'),
    khb: () => import('pdfnative/fonts/noto-newtailue-data.js'),
    tdd: () => import('pdfnative/fonts/noto-taile-data.js'),
    cjm: () => import('pdfnative/fonts/noto-cham-data.js'),
};

/** One line per script, from the engine's own language documents. */
const SAMPLES: Record<keyof typeof NEW_SCRIPTS, string> = {
    lo: 'ສະບາຍດີ ນ້ຳ',
    nod: 'ᨲᩫ᩠ᩅᨾᩮᩬᩥᨦ',
    khb: 'ᦎᦸᧆᦷᦟᧂᧈ',
    tdd: 'ᥖᥭᥰᥘᥫᥴ',
    cjm: 'ꨌꩌ ꨀꨯꨱ',
};

const entries = await resolveFonts(NEW_SCRIPTS);

describe('the five new scripts', () => {
    it('resolve to one font entry each, with a slash-prefixed reference', () => {
        expect(entries.map((e) => e.lang)).toEqual(['lo', 'nod', 'khb', 'tdd', 'cjm']);
        for (const e of entries) expect(e.fontRef, e.lang).toMatch(/^\/[a-z]+$/);
    });

    it.each(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[])('%s renders with its font embedded', (lang) => {
        const entry = entries.find((e) => e.lang === lang);
        const bytes = renderToBytes(
            <Document title={lang} fontEntries={entry ? [entry] : []}>
                <Paragraph>{SAMPLES[lang]}</Paragraph>
            </Document>,
        );
        expect(bytes.byteLength).toBeGreaterThan(5_000);
        expect(new TextDecoder('latin1').decode(bytes).startsWith('%PDF-')).toBe(true);
    });
});

describe('the Latin aliases', () => {
    it('Hausa, Yoruba, Igbo and Swahili render on the bundled latin module', async () => {
        const entries = await resolveFonts({ latin: () => import('pdfnative/fonts/noto-sans-data.js') });
        const bytes = renderToBytes(
            <Document title="African languages on Latin" fontEntries={entries}>
                <Paragraph>Hausa: Sannu, ƙasa da ɗan ƴa.</Paragraph>
                <Paragraph>Yoruba: Ẹ káàbọ̀, ọjọ́ dára.</Paragraph>
                <Paragraph>Igbo: Ndeewo, ụlọ akwụkwọ ị̀.</Paragraph>
                <Paragraph>Swahili: Habari, karibu sana.</Paragraph>
            </Document>,
        );
        expect(bytes.byteLength).toBeGreaterThan(20_000);
    });
});
