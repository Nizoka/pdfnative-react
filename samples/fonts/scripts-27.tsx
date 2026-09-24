/**
 * The five scripts pdfnative 1.8.0 adds — Lao, Tai Tham, New Tai Lue, Tai Le
 * and Cham (27 bundled Unicode scripts in all) — and four African languages
 * on the bundled Latin module, through `resolveFonts`.
 *
 * Run with: npx tsx samples/fonts/scripts-27.tsx
 * Writes `scripts-27.pdf` to the current directory.
 *
 * `resolveFonts` enumerates nothing: a language key maps to a font-data
 * loader, so the new scripts need no new API — Lao has its own shaper, Tai
 * Tham and Cham are shaped by the Universal Shaping Engine, New Tai Lue and
 * Tai Le take the plain path. Hausa, Yoruba, Igbo and Swahili are Latin
 * languages whose tone marks are attached by the Latin combining-mark shaper
 * on the same Noto Sans module that renders English.
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile, resolveFonts } from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
    lo: () => import('pdfnative/fonts/noto-lao-data.js'),
    nod: () => import('pdfnative/fonts/noto-taitham-data.js'),
    khb: () => import('pdfnative/fonts/noto-newtailue-data.js'),
    tdd: () => import('pdfnative/fonts/noto-taile-data.js'),
    cjm: () => import('pdfnative/fonts/noto-cham-data.js'),
});

// Every non-English line below is demonstrated content: the sample exists to
// show the script's shaping, not to say anything.
// demo-language: lo, nod, khb, tdd, cjm, ha, yo, ig, sw (script and language demonstrations)
const LINES: ReadonlyArray<readonly [string, string]> = [
    ['Lao (lo)', 'ສະບາຍດີ — ນ້ຳ, ກ່ຳ: the tone stacks on the nikhahit of sara am.'],
    ['Tai Tham (nod)', 'ᨲᩫ᩠ᩅᨾᩮᩬᩥᨦ — shaped by the Universal Shaping Engine.'],
    ['New Tai Lue (khb)', 'ᦎᦸᧆᦷᦟᧂᧈ — the plain per-code-point path.'],
    ['Tai Le (tdd)', 'ᥖᥭᥰᥘᥫᥴ — the plain per-code-point path.'],
    ['Cham (cjm)', 'ꨌꩌ ꨀꨯꨱ — shaped by the Universal Shaping Engine.'],
    ['Hausa (ha)', 'Sannu, ƙasa da ɗan ƴa.'],
    ['Yoruba (yo)', 'Ẹ káàbọ̀, ọjọ́ dára.'],
    ['Igbo (ig)', 'Ndeewo, ụlọ akwụkwọ ị̀.'],
    ['Swahili (sw)', 'Habari, karibu sana.'],
];

const doc = (
    <Document title="27 scripts" fontEntries={fontEntries}>
        <Heading level={1}>Five new scripts, four more languages</Heading>
        {LINES.map(([label, text]) => (
            <Paragraph key={label}>
                {label}: {text}
            </Paragraph>
        ))}
    </Document>
);

await renderToFile(doc, 'scripts-27.pdf');
console.log('Wrote scripts-27.pdf');
