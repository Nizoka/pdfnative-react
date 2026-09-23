/**
 * The typography engine (pdfnative 1.8.0) — page breaking, justification,
 * kerning, OpenType features, units and short words, all opt-in.
 *
 * Run with: npx tsx samples/text/typography-engine.tsx
 * Writes `typography-engine.pdf` to the current directory.
 *
 * `typography` is a `<Document>` prop (sugar over `layout.typography`); every
 * key is off by default, so a document that sets none renders byte-identically
 * to earlier releases. Kerning, OpenType features and the narrow no-break
 * space need a registered font — the base-14 faces carry no OpenType tables —
 * which is why Noto Sans is resolved here. A paragraph can opt in or out of
 * splitting (`splittable`) and be kept with the next block (`keepWithNext`);
 * `align="justify"` sets every line but the last flush on both margins.
 * Soft hyphens (U+00AD) are honoured as break opportunities and never drawn
 * mid-word; a hyphenation dictionary is yours to bring (`setHyphenationProvider`).
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    Table,
    renderToFile,
    resolveFonts,
    setHyphenationProvider,
} from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

// A tiny provider: break long words after their fourth letter. A real one
// wraps a Liang-pattern library (hypher, hyphenopoly) and uses `lang`.
setHyphenationProvider((word, lang) => (lang === 'en-US' && word.length > 10 ? [4] : []));

const PROSE =
    'Typography is the craft of endowing human language with a durable visual form, '
    + 'and thereby with an independent existence. A page that breaks in the wrong place '
    + 'asks the reader to work; one that is set with care disappears, and only the text '
    + 'remains. ';

const doc = (
    <Document
        title="Typography engine"
        fontEntries={fontEntries}
        typography={{
            splitParagraphs: true, // paragraphs may break across pages, line by line
            orphans: 2, // never leave a lone first line at the foot of a page
            widows: 2, // never carry a lone last line to the next page
            keepHeadingsWithNext: { minLines: 3 }, // a heading takes three lines of its paragraph along
            unitBinding: true, // 150 €, 12 kg, 30 % never break (ISO 80000-1)
            bindShortWords: true, // a line never ends on "a" or "I"
            opticalMargins: true, // hanging punctuation
            metrics: 'exact', // Adobe Core 14 advances for any base-14 text
            fontFeatures: ['smcp', 'onum'], // small caps and old-style figures (single substitutions)
            kerning: true, // GPOS pair kerning, emitted as TJ arrays
            hyphenationLanguage: 'en-US', // handed to the provider above with every word
        }}
    >
        <Heading level={1}>The typography engine</Heading>
        <Paragraph align="justify">{PROSE.repeat(6)}</Paragraph>
        <Heading level={2} keepWithNext>
            Small caps, old-style figures and kerning
        </Heading>
        <Paragraph>
            AVENUE, Tokyo, WAVE — kerned pairs close the gaps the nominal advances leave.
            Old-style figures sit on the baseline: 1789, 2026, 30 %.
        </Paragraph>
        <Heading level={2}>Units and short words</Heading>
        <Paragraph>
            A 12 kg parcel costs 150 € to ship; 30 % of the way is by rail. Every
            number stays with its unit, and no line ends on a one-letter word.
        </Paragraph>
        <Heading level={2}>Soft hyphens and a provider</Heading>
        <Paragraph splittable>
            Super&shy;cali&shy;fragilistic&shy;expialidocious words break only at the
            soft hyphens their author placed; the provider installed above adds a break
            opportunity to any longer word it is handed, together with the language tag.
        </Paragraph>
        <Heading level={2}>Tabular figures</Heading>
        <Paragraph>
            Noto Sans's figures are tabular by default, so the engine reports
            `TYPOGRAPHY_FEATURE_INEFFECTIVE` if `tnum` is requested — the linter's
            `L_TYPOGRAPHY_INEFFECTIVE` rule says so before the render (see
            samples/quality/diagnostics.tsx).
        </Paragraph>
        <Table
            headers={['Item', 'Amount']}
            rows={[
                { cells: ['Flights', '1 000.00 €'], type: 'default', pointed: false },
                { cells: ['Hotel', '11 111.00 €'], type: 'default', pointed: false },
                { cells: ['Total', '12 111.00 €'], type: 'total', pointed: true },
            ]}
        />
        <Paragraph keepWithNext={false}>
            {PROSE.repeat(12)}
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'typography-engine.pdf');
console.log('Wrote typography-engine.pdf');
