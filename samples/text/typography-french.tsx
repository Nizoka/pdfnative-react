/**
 * Punctuation spacing presets — the `'fr'` and `'fr-CA'` conventions, and an
 * explicit rule list for any other house style.
 *
 * Run with: npx tsx samples/text/typography-french.tsx
 * Writes `typography-french.pdf` to the current directory.
 *
 * French sets a narrow no-break space before `;` `!` `?` and a no-break space
 * before `:` and inside guillemets; Canadian French sets none before `;` `!`
 * `?`. The engine only converts a plain space the author wrote — nothing is
 * inserted. The narrow space (U+202F) needs a registered font: the base-14
 * faces have none, so `'fr'` degrades to `'fr-CA'` without one (the linter's
 * `L_TYPOGRAPHY_INEFFECTIVE` rule reports that before the render).
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile, resolveFonts } from '../../src/index.js';

const fontEntries = await resolveFonts({
    latin: () => import('pdfnative/fonts/noto-sans-data.js'),
});

// demo-language: fr (punctuationSpacing 'fr' is a French convention; the sentence exists to be spaced by it)
const FRENCH = 'Bonjour ! Comment allez-vous ? Très bien ; merci : « à bientôt ».';

const doc = (
    <Document
        title="Punctuation spacing"
        fontEntries={fontEntries}
        typography={{ punctuationSpacing: 'fr', bindShortWords: { words: ['à', 'y'] } }}
    >
        <Heading level={1}>Punctuation spacing</Heading>
        <Paragraph>{FRENCH}</Paragraph>
        <Paragraph>
            The same sentence with the fr preset: a narrow no-break space (U+202F)
            precedes the semicolon, the exclamation and the question mark, and a
            no-break space (U+00A0) sits before the colon and inside the guillemets.
            Text extraction returns those spaces, which is what makes the setting
            visible to a search engine or a screen reader.
        </Paragraph>
        <Paragraph>
            An explicit rule list describes any other convention, for example a
            house style that binds a space before every closing guillemet only:
            typography.punctuationSpacing = [&#123; char: '»', side: 'before', space: 'nbsp' &#125;].
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'typography-french.pdf');
console.log('Wrote typography-french.pdf');
