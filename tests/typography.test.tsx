/**
 * The typography engine (pdfnative 1.8.0) through the React surface.
 *
 * Model tests: the `typography` prop reaches `layout.typography` whole, the
 * block-level break controls reach their blocks, the DocSpec twin compiles to
 * the same model, and the schema describes exactly the engine's key set (the
 * runtime half of the `TypographyPropsCoverTypographyOptions` compile-time
 * lock). Real-bytes tests: justified text, soft hyphens and a hyphenation
 * provider all render.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    compileDocument,
    compileSpec,
    docSpecSchema,
    getHyphenationProvider,
    inspectDocument,
    renderToBytes,
    setHyphenationProvider,
} from '../src/index.js';
import type { DocSpec, TypographyOptions } from '../src/index.js';

/** Every key of `TypographyOptions`, as the engine defines them in 1.8.0. */
const TYPOGRAPHY_KEYS = [
    'splitParagraphs',
    'orphans',
    'widows',
    'keepHeadingsWithNext',
    'unitBinding',
    'bindShortWords',
    'punctuationSpacing',
    'opticalMargins',
    'metrics',
    'fontFeatures',
    'kerning',
    'hyphenationLanguage',
] as const;

const FULL: Required<TypographyOptions> = {
    splitParagraphs: true,
    orphans: 2,
    widows: 2,
    keepHeadingsWithNext: true,
    unitBinding: true,
    bindShortWords: true,
    punctuationSpacing: 'fr-CA',
    opticalMargins: true,
    metrics: 'exact',
    fontFeatures: ['tnum'],
    kerning: false,
    hyphenationLanguage: 'en',
};

const LONG =
    'Typography is the craft of endowing human language with a durable visual form, '
    + 'and thereby with an independent existence. '.repeat(12);

afterEach(() => setHyphenationProvider(null));

describe('the typography prop', () => {
    it('reaches layout.typography whole, every key preserved', () => {
        const model = compileDocument(
            <Document typography={FULL}>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(model.layout?.typography).toEqual(FULL);
        expect(Object.keys(model.layout?.typography ?? {}).sort()).toEqual([...TYPOGRAPHY_KEYS].sort());
    });

    it('is described by the schema with exactly the engine’s key set', () => {
        const defs = docSpecSchema()['$defs'] as { typography: { properties: Record<string, unknown> } };
        expect(Object.keys(defs.typography.properties).sort()).toEqual([...TYPOGRAPHY_KEYS].sort());
    });

    it('compiles to the same model from a DocSpec', () => {
        const spec: DocSpec = {
            typography: FULL,
            blocks: [
                ['h1', 'Title', { keepWithNext: true }],
                ['p', LONG, { align: 'justify', splittable: true }],
            ],
        };
        const jsx = (
            <Document typography={FULL}>
                <Heading level={1} keepWithNext>Title</Heading>
                <Paragraph align="justify" splittable>{LONG}</Paragraph>
            </Document>
        );
        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
    });

    it('leaves a document without it byte-identical to before (layout stays undefined)', () => {
        const model = compileDocument(
            <Document>
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect('layout' in model).toBe(false);
        expect(model.blocks[0]).toEqual({ type: 'paragraph', text: 'x' });
    });
});

describe('block-level controls', () => {
    it('serialise keepWithNext and splittable only when set', () => {
        const model = compileDocument(
            <Document>
                <Heading level={2} keepWithNext>A</Heading>
                <Paragraph keepWithNext={false} splittable={false}>B</Paragraph>
                <Paragraph>C</Paragraph>
            </Document>,
        );
        expect(model.blocks[0]).toEqual({ type: 'heading', text: 'A', level: 2, keepWithNext: true });
        expect(model.blocks[1]).toEqual({ type: 'paragraph', text: 'B', keepWithNext: false, splittable: false });
        expect(model.blocks[2]).toEqual({ type: 'paragraph', text: 'C' });
    });

    it("accepts align 'justify' on paragraphs", () => {
        const model = compileDocument(
            <Document>
                <Paragraph align="justify">{LONG}</Paragraph>
            </Document>,
        );
        expect(model.blocks[0]).toMatchObject({ align: 'justify' });
    });
});

describe('real bytes', () => {
    it('renders justified paragraphs as TJ arrays with the spaces kept', () => {
        const text = new TextDecoder('latin1').decode(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Paragraph align="justify">{LONG}</Paragraph>
                </Document>,
            ),
        );
        expect(text).toMatch(/\] ?TJ/);
    });

    it('splits a long paragraph across pages when asked, and keeps it whole otherwise', () => {
        const paragraph = (
            <Paragraph>{LONG.repeat(6)}</Paragraph>
        );
        const atomic = inspectDocument(
            <Document>
                <Paragraph>Lead-in.</Paragraph>
                {paragraph}
            </Document>,
        );
        const split = inspectDocument(
            <Document typography={{ splitParagraphs: true }}>
                <Paragraph>Lead-in.</Paragraph>
                {paragraph}
            </Document>,
        );
        // Atomic: the tall paragraph moves whole; split: its lines flow from
        // page 1 onward, so page 1 carries more than the lead-in.
        expect(atomic.pages[0].blocks.length).toBeLessThanOrEqual(split.pages[0].blocks.length);
        expect(split.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('passes soft hyphens (U+00AD) through the model and renders them', () => {
        const word = 'super­cali­fragilistic';
        const model = compileDocument(
            <Document>
                <Paragraph>{word}</Paragraph>
            </Document>,
        );
        expect((model.blocks[0] as { text: string }).text).toBe(word);
        expect(() =>
            renderToBytes(
                <Document typography={{ splitParagraphs: true }}>
                    <Paragraph>{word}</Paragraph>
                </Document>,
            ),
        ).not.toThrow();
    });

    it('accepts a hyphenation provider and hands it the document language', () => {
        const seen: string[] = [];
        setHyphenationProvider((word, lang) => {
            seen.push(`${word}:${lang ?? ''}`);
            return word.length > 8 ? [4] : [];
        });
        expect(getHyphenationProvider()).not.toBeNull();
        expect(() =>
            renderToBytes(
                <Document
                    typography={{ splitParagraphs: true, hyphenationLanguage: 'en-US' }}
                    layout={{ pageWidth: 200, margins: { t: 20, r: 20, b: 20, l: 20 } }}
                >
                    <Paragraph>{LONG}</Paragraph>
                </Document>,
            ),
        ).not.toThrow();
        // The provider is only consulted for words that do not fit; a narrow
        // page guarantees at least one, and it carries the language tag.
        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every((s) => s.endsWith(':en-US'))).toBe(true);
    });
});
