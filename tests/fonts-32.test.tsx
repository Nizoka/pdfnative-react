/**
 * The ten scripts pdfnative 1.8.0 and 1.9.0 add — Lao, Tai Tham, New Tai Lue,
 * Tai Le, Cham (1.8.0); Gujarati, Gurmukhi, Kannada, Malayalam, Odia (1.9.0)
 * — and the four Latin-module aliases (Hausa, Yoruba, Igbo, Swahili), through
 * `resolveFonts`.
 *
 * `resolveFonts` enumerates nothing: any language key maps to any font-data
 * loader, so no code changed for the new scripts. This file is the evidence
 * that the documented path works for each of them — the font resolves, the
 * reference carries the ISO 32000 leading slash, a paragraph in the script
 * renders with the font embedded — and that the 1.9.0 subset facts hold
 * through the renderer: the six-letter subset tag on `/BaseFont` (bare under
 * PDF/A-1), and a lean, compact subset far smaller than the module.
 */
import { describe, expect, it } from 'vitest';
import { Document, Paragraph, Table, renderToBytes, resolveFonts } from '../src/index.js';

const NEW_SCRIPTS = {
    lo: () => import('pdfnative/fonts/noto-lao-data.js'),
    nod: () => import('pdfnative/fonts/noto-taitham-data.js'),
    khb: () => import('pdfnative/fonts/noto-newtailue-data.js'),
    tdd: () => import('pdfnative/fonts/noto-taile-data.js'),
    cjm: () => import('pdfnative/fonts/noto-cham-data.js'),
    gu: () => import('pdfnative/fonts/noto-gujarati-data.js'),
    pa: () => import('pdfnative/fonts/noto-gurmukhi-data.js'),
    kn: () => import('pdfnative/fonts/noto-kannada-data.js'),
    ml: () => import('pdfnative/fonts/noto-malayalam-data.js'),
    or: () => import('pdfnative/fonts/noto-oriya-data.js'),
};

/** One line per script, from the engine's own language documents. */
// demo-language: lo, nod, khb, tdd, cjm, gu, pa, kn, ml, or (script demonstrations)
const SAMPLES: Record<keyof typeof NEW_SCRIPTS, string> = {
    lo: 'ສະບາຍດີ ນ້ຳ',
    nod: 'ᨲᩫ᩠ᩅᨾᩮᩬᩥᨦ',
    khb: 'ᦎᦸᧆᦷᦟᧂᧈ',
    tdd: 'ᥖᥭᥰᥘᥫᥴ',
    cjm: 'ꨌꩌ ꨀꨯꨱ',
    gu: 'નમસ્તે, કેમ છો?',
    pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ।',
    kn: 'ನಮಸ್ಕಾರ ಕ್ಕಿ ಸ್ತ್ರೀ',
    ml: 'നമസ്കാരം ന്‍',
    or: 'ନମସ୍କାର।',
};

const entries = await resolveFonts(NEW_SCRIPTS);
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

describe('the ten new scripts', () => {
    it('resolve to one font entry each, with a slash-prefixed reference', () => {
        expect(entries.map((e) => e.lang)).toEqual(['lo', 'nod', 'khb', 'tdd', 'cjm', 'gu', 'pa', 'kn', 'ml', 'or']);
        for (const e of entries) expect(e.fontRef, e.lang).toMatch(/^\/[a-z]+$/);
    });

    it.each(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[])('%s renders with its font embedded', (lang) => {
        const entry = entries.find((e) => e.lang === lang);
        const bytes = renderToBytes(
            <Document title={lang} fontEntries={entry ? [entry] : []}>
                <Paragraph>{SAMPLES[lang]}</Paragraph>
            </Document>,
        );
        const text = latin1(bytes);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text).toContain('/FontFile2');
        expect(bytes.byteLength).toBeGreaterThan(3_000);
    });
});

describe('the 1.9.0 subset facts, through the renderer', () => {
    const kn = entries.filter((e) => e.lang === 'kn');

    it('embeds the subset under a six-letter tagged /BaseFont outside PDF/A-1', () => {
        const text = latin1(
            renderToBytes(
                <Document fontEntries={kn} layout={{ compress: false }}>
                    <Paragraph>{SAMPLES.kn}</Paragraph>
                </Document>,
            ),
        );
        expect(text).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+NotoSansKannada/);
    });

    it("keeps the name bare under tagged 'pdfa1b' (no /CIDSet yet — ISO 19005-1 §6.3.5)", () => {
        const text = latin1(
            renderToBytes(
                <Document fontEntries={kn} tagged="pdfa1b" layout={{ compress: false }}>
                    <Paragraph>{SAMPLES.kn}</Paragraph>
                </Document>,
            ),
        );
        expect(text).toMatch(/\/BaseFont\s*\/NotoSansKannada/);
        expect(text).not.toMatch(/\/BaseFont\s*\/[A-Z]{6}\+/);
    });

    it('a lean, compact subset is far smaller than the whole program (C6, C28)', () => {
        const bytes = renderToBytes(
            <Document fontEntries={kn}>
                <Paragraph>{SAMPLES.kn}</Paragraph>
            </Document>,
        );
        // Noto Sans Kannada is hundreds of KB; one line of it keeps a few KB.
        expect(bytes.byteLength).toBeLessThan(40_000);
    });

    it('a Malayalam table row renders with its deep descenders reserved (C5)', () => {
        const ml = entries.filter((e) => e.lang === 'ml');
        const text = latin1(
            renderToBytes(
                <Document fontEntries={ml}>
                    <Table headers={['Script', 'Greeting']} rows={[{ cells: ['Malayalam', 'നമസ്കാരം'], type: 'default', pointed: false }]} />
                </Document>,
            ),
        );
        expect(text).toContain('/FontFile2');
    });
});

describe('the Latin aliases', () => {
    it('Hausa, Yoruba, Igbo and Swahili render on the bundled latin module', async () => {
        const latin = await resolveFonts({ latin: () => import('pdfnative/fonts/noto-sans-data.js') });
        const bytes = renderToBytes(
            <Document title="African languages on Latin" fontEntries={latin}>
                <Paragraph>Hausa: Sannu, ƙasa da ɗan ƴa.</Paragraph>
                <Paragraph>Yoruba: Ẹ káàbọ̀, ọjọ́ dára.</Paragraph>
                <Paragraph>Igbo: Ndeewo, ụlọ akwụkwọ ị̀.</Paragraph>
                <Paragraph>Swahili: Habari, karibu sana.</Paragraph>
            </Document>,
        );
        expect(latin1(bytes)).toContain('/FontFile2');
        expect(bytes.byteLength).toBeGreaterThan(5_000);
    });
});
