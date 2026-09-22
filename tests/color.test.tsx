/**
 * CMYK colour (pdfnative 1.8.0) on every colour position.
 *
 * The engine reads the colour space from the component count — three is
 * DeviceRGB, four is DeviceCMYK — so the React surface needs no conversion,
 * only a widened type and a schema that admits the two new shapes. This file
 * holds the schema (`$defs.color`), the validator, the compiled model and one
 * real render with the `k` / `K` operators in the content stream.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    Table,
    Chart,
    compileDocument,
    docSpecSchema,
    renderToBytes,
    validateSpec,
} from '../src/index.js';
import type { Color, DocSpec } from '../src/index.js';
import { validate, type Json } from './helpers/json-schema-lite.js';

type Schema = { readonly [key: string]: Json };
const schema = docSpecSchema() as Schema;
const colorDef = (schema['$defs'] as Schema)['color'] as Schema;

describe('$defs.color', () => {
    it.each([
        ['hex', '#2563EB'],
        ['RGB tuple', [37, 99, 235]],
        ['RGB operands', '0.145 0.388 0.922'],
        ['CMYK tuple (percent)', [100, 60, 0, 10]],
        ['CMYK operands', '1 0.6 0 0.1'],
    ])('accepts %s', (_label, value) => {
        expect(validate(value as Json, colorDef, schema)).toEqual([]);
    });

    it.each([
        ['a two-element array', [1, 2]],
        ['a five-element array', [1, 2, 3, 4, 5]],
        ['a number', 0xff0000],
        ['an object', { r: 1 }],
    ])('rejects %s', (_label, value) => {
        expect(validate(value as Json, colorDef, schema).length).toBeGreaterThan(0);
    });
});

describe('validateSpec and the compiled model', () => {
    const spec: DocSpec = {
        layout: { colors: { title: [0, 0, 0, 100] } as never },
        watermark: { text: { text: 'PROOF', color: '0 0 0 0.5' } },
        header: { center: '{title}', color: [0, 100, 100, 0] },
        blocks: [
            ['h1', 'Ink', { color: [100, 0, 0, 0] }],
            ['p', 'Body', { color: '0 1 1 0' }],
            ['link', 'Docs', { url: 'https://pdfnative.dev', color: [0, 0, 100, 0] }],
            ['table', { h: ['A'], r: [['1']], zebra: [0, 0, 0, 10], cellBorders: { all: true, color: '0 0 0 1' } }],
            ['chart', { chartType: 'pie', series: [{ label: 'S', values: [1, 2], color: [50, 0, 0, 0] }], colors: ['0 0.5 0 0', [0, 0, 50, 0]], altText: 'x' }],
        ],
    };

    it('validates a spec using CMYK on every colour position, under the schema and validateSpec', () => {
        expect(validate(spec as unknown as Json, schema)).toEqual([]);
        expect(validateSpec(spec)).toEqual({ ok: true, errors: [], warnings: [] });
    });

    it('keeps the tuples and operand strings verbatim in the model', () => {
        const model = compileDocument(
            <Document>
                <Heading level={1} color={[100, 0, 0, 0]}>Ink</Heading>
                <Paragraph color="0 1 1 0">Body</Paragraph>
                <Table headers={['A']} rows={[]} zebra={[0, 0, 0, 10]} cellBorders={{ all: true, color: '0 0 0 1' }} />
                <Chart chartType="pie" series={[{ label: 'S', values: [1, 2], color: [50, 0, 0, 0] }]} colors={['0 0.5 0 0', [0, 0, 50, 0]]} altText="x" />
            </Document>,
        );
        expect(model.blocks[0]).toMatchObject({ color: [100, 0, 0, 0] });
        expect(model.blocks[1]).toMatchObject({ color: '0 1 1 0' });
        expect(model.blocks[2]).toMatchObject({ zebra: [0, 0, 0, 10], cellBorders: { color: '0 0 0 1' } });
        expect(model.blocks[3]).toMatchObject({ colors: ['0 0.5 0 0', [0, 0, 50, 0]] });
    });

    it('the Color type admits a four-element tuple beside the 1.2.0 forms', () => {
        const colours: Color[] = ['#000', [0, 0, 0], '0 0 0', [0, 0, 0, 100]];
        expect(colours).toHaveLength(4);
    });
});

describe('real bytes', () => {
    it('writes DeviceCMYK fill and stroke operators for CMYK colours', () => {
        const text = new TextDecoder('latin1').decode(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Heading level={1} color={[0, 0, 0, 100]}>Ink</Heading>
                    <Paragraph color="0 1 1 0">Rich red.</Paragraph>
                </Document>,
            ),
        );
        // `c m y k k` — the fill operator with four operands.
        expect(text).toMatch(/\b0 0 0 1 k\b/);
        expect(text).toMatch(/\b0 1 1 0 k\b/);
    });
});
