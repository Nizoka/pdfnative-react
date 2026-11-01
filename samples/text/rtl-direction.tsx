/**
 * Right-to-left documents — `direction` (engine 1.9.0).
 *
 * Run with: npx tsx samples/text/rtl-direction.tsx
 * Writes `rtl-direction.pdf` to the current directory.
 *
 * `<Document direction="auto">` resolves every paragraph's base direction
 * from its first strong character (UAX #9 P2–P3), so an Arabic or Hebrew
 * paragraph is set from the right margin, its neutral punctuation follows
 * the paragraph, and its lines wrap on the right. `<Paragraph direction>`
 * overrides it per block — here an English paragraph is forced `'ltr'`
 * inside an Arabic document. Omit `direction` and the output is byte-
 * identical to earlier releases (the engine still reorders right-to-left
 * runs inside a left-to-right line).
 *
 * Every right-to-left run carries its logical text as an untagged
 * `/Span /ActualText`, so extraction and copy-paste give back the source
 * string; `layout.actualText: false` opts out. The DocSpec twin is the
 * top-level `direction` field and the paragraph opt of the same name.
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile, resolveFonts } from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
    ar: () => import('pdfnative/fonts/noto-arabic-data.js'),
    he: () => import('pdfnative/fonts/noto-hebrew-data.js'),
});

// demo-language: ar, he (right-to-left shaping and direction demonstrations)
const doc = (
    <Document title="Right-to-left" fontEntries={fontEntries} direction="auto">
        <Heading level={1}>Right-to-left paragraphs</Heading>
        <Paragraph>
            السلام عليكم ورحمة الله وبركاته. هذه الفقرة مكتوبة بالعربية، وتُضبط من
            الهامش الأيمن لأن اتجاه المستند «auto» يكتشفها من أول حرف قوي.
        </Paragraph>
        <Paragraph>
            שלום וברכה. פסקה זו כתובה בעברית ונקבעת מימין לשמאל, כולל סימני
            הפיסוק (נקודה, פסיק, סימן שאלה?) שעוקבים אחר כיוון הפסקה.
        </Paragraph>
        <Paragraph>
            Mixed line: the figures 1234 and the brackets (like these) in an Arabic
            sentence — ‫الأرقام 1234 والأقواس (مثل هذه)‬ — are paired and mirrored by
            the bidirectional algorithm.
        </Paragraph>
        <Paragraph direction="ltr">
            This paragraph is forced left-to-right with direction="ltr", whatever
            the document says: it starts at the left margin like any English text.
        </Paragraph>
        <Paragraph direction="rtl">
            And this one is forced right-to-left even though it starts with Latin
            letters — عربي — so it is set from the right margin.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'rtl-direction.pdf');
console.log('Wrote rtl-direction.pdf');
