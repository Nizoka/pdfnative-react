/**
 * The ten scripts pdfnative 1.8.0 and 1.9.0 add — Lao, Tai Tham, New Tai Lue,
 * Tai Le and Cham (1.8.0); Gujarati, Gurmukhi, Kannada, Malayalam and Odia on
 * the Indic shaping engine (1.9.0) — 32 bundled Unicode scripts in all — and
 * four African languages on the bundled Latin module, through `resolveFonts`.
 *
 * Run with: npx tsx samples/fonts/scripts-32.tsx
 * Writes `scripts-32.pdf` to the current directory.
 *
 * `resolveFonts` enumerates nothing: a language key maps to a font-data
 * loader, so a new script needs no new API — the engine routes each run to
 * its shaper (Indic, Universal, Lao, or the plain path). Two engine 1.9.0
 * details show on purpose: a Gurmukhi and an Odia line end in the danda
 * « । », which the shaper now keeps in the surrounding script, and a Kannada
 * consonant cluster (ಕ್ಕಿ) places its vowel sign before the subjoined
 * consonant, as HarfBuzz does. A Malayalam table row shows the deeper
 * descender reservation of 1.9.0 (ledger C5).
 */

import React from 'react';
import { Document, Heading, Paragraph, Table, renderToFile, resolveFonts } from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
    // 1.8.0
    lo: () => import('pdfnative/fonts/noto-lao-data.js'),
    nod: () => import('pdfnative/fonts/noto-taitham-data.js'),
    khb: () => import('pdfnative/fonts/noto-newtailue-data.js'),
    tdd: () => import('pdfnative/fonts/noto-taile-data.js'),
    cjm: () => import('pdfnative/fonts/noto-cham-data.js'),
    // 1.9.0
    gu: () => import('pdfnative/fonts/noto-gujarati-data.js'),
    pa: () => import('pdfnative/fonts/noto-gurmukhi-data.js'),
    kn: () => import('pdfnative/fonts/noto-kannada-data.js'),
    ml: () => import('pdfnative/fonts/noto-malayalam-data.js'),
    or: () => import('pdfnative/fonts/noto-oriya-data.js'),
});

// Every non-English line below is demonstrated content: the sample exists to
// show the script's shaping, not to say anything.
// demo-language: lo, nod, khb, tdd, cjm, gu, pa, kn, ml, or, ha, yo, ig, sw (script and language demonstrations)
const LINES: ReadonlyArray<readonly [string, string]> = [
    ['Lao (lo)', 'ສະບາຍດີ — ນ້ຳ, ກ່ຳ: the tone stacks on the nikhahit of sara am.'],
    ['Tai Tham (nod)', 'ᨲᩫ᩠ᩅᨾᩮᩬᩥᨦ — shaped by the Universal Shaping Engine.'],
    ['New Tai Lue (khb)', 'ᦎᦸᧆᦷᦟᧂᧈ — the plain per-code-point path.'],
    ['Tai Le (tdd)', 'ᥖᥭᥰᥘᥫᥴ — the plain per-code-point path.'],
    ['Cham (cjm)', 'ꨌꩌ ꨀꨯꨱ — shaped by the Universal Shaping Engine.'],
    ['Gujarati (gu)', 'નમસ્તે, કેમ છો? — the Indic engine, since 1.9.0.'],
    ['Gurmukhi (pa)', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ। — a danda closes the line.'],
    ['Kannada (kn)', 'ನಮಸ್ಕಾರ, ಕ್ಕಿ ಸ್ತ್ರೀ ಪ್ರೀತಿ — vowel signs before the subjoined consonant.'],
    ['Malayalam (ml)', 'നമസ്കാരം, സുഖമാണോ? — chillu letters through akhn.'],
    ['Odia (or)', 'ନମସ୍କାର, କେମିତି ଅଛନ୍ତି। — a danda closes the line.'],
    ['Hausa (ha)', 'Sannu, ƙasa da ɗan ƴa.'],
    ['Yoruba (yo)', 'Ẹ káàbọ̀, ọjọ́ dára.'],
    ['Igbo (ig)', 'Ndeewo, ụlọ akwụkwọ ị̀.'],
    ['Swahili (sw)', 'Habari, karibu sana.'],
];

const doc = (
    <Document title="32 scripts" fontEntries={fontEntries}>
        <Heading level={1}>Ten more scripts, four more languages</Heading>
        {LINES.map(([label, text]) => (
            <Paragraph key={label}>
                {label}: {text}
            </Paragraph>
        ))}
        <Heading level={2}>Deep descenders in a table row</Heading>
        <Table
            headers={['Script', 'Greeting']}
            rows={[
                { cells: ['Malayalam', 'നമസ്കാരം'], type: 'default', pointed: false },
                { cells: ['Kannada', 'ನಮಸ್ಕಾರ'], type: 'default', pointed: false },
            ]}
        />
    </Document>
);

await renderToFile(doc, 'scripts-32.pdf');
console.log('Wrote scripts-32.pdf');
