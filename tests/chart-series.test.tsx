/**
 * `ChartSeries` in engine 1.9.0: `label` is optional (an unnamed series is
 * listed as `Series N` in the legend) and `colors` paints one colour per
 * value on the four bar kinds. The wrapper passes the engine type through,
 * so both doors already carry the two; what this file holds is the schema,
 * the lint rule that pre-empts the engine's length-mismatch throw (with its
 * exact message), and the rendering of an unlabelled series.
 */
import { describe, expect, it } from 'vitest';
import {
    Chart,
    Document,
    compileDocument,
    compileSpec,
    lintDocument,
    renderToBytes,
    toErrorEnvelope,
    validateSpec,
} from '../src/index.js';
import type { ChartSeries, DocSpec } from '../src/index.js';

const PER_VALUE: readonly ChartSeries[] = [
    { label: 'Coverage', values: [100, 50, 10], colors: ['#0057B8', [0, 100, 100, 0], '0.2 0.2 0.2'] },
];

describe('ChartSeries.colors and the optional label', () => {
    it('reach the model through both doors', () => {
        const jsx = compileDocument(
            <Document>
                <Chart chartType="bar" categories={['C', 'M', 'K']} series={PER_VALUE} altText="Plates" />
                <Chart chartType="line" series={[{ values: [1, 2, 3] }]} altText="Unnamed" />
            </Document>,
        );
        const spec: DocSpec = {
            blocks: [
                ['chart', { chartType: 'bar', categories: ['C', 'M', 'K'], series: PER_VALUE, altText: 'Plates' }],
                ['chart', { chartType: 'line', series: [{ values: [1, 2, 3] }], altText: 'Unnamed' }],
            ],
        };
        expect(validateSpec(spec)).toEqual({ ok: true, errors: [], warnings: [] });
        expect(compileSpec(spec)).toEqual(jsx);
        expect(jsx.blocks[0]).toMatchObject({ series: PER_VALUE });
        expect(jsx.blocks[1]).toMatchObject({ series: [{ values: [1, 2, 3] }] });
    });

    it('renders an unlabelled series, listed as Series 1 in the legend', () => {
        const text = new TextDecoder('latin1').decode(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Chart chartType="bar" series={[{ values: [1, 2, 3] }]} altText="Unnamed" legend="bottom" />
                </Document>,
            ),
        );
        expect(text).toContain('(Series 1)');
        expect(lintDocument(
            <Document>
                <Chart chartType="bar" series={[{ values: [1, 2, 3] }]} altText="Unnamed" />
            </Document>,
        ).findings).toEqual([]);
    });

    it('renders per-value colours on a bar chart, lint clean', () => {
        const node = (
            <Document>
                <Chart chartType="bar" categories={['C', 'M', 'K']} series={PER_VALUE} altText="Plates" />
            </Document>
        );
        expect(lintDocument(node).findings).toEqual([]);
        const text = new TextDecoder('latin1').decode(renderToBytes(node, { layout: { compress: false } }));
        expect(text).toMatch(/0 1 1 0 k/); // the CMYK value of the second bar
    });

    it('L_CHART_SERIES_COLORS — a length mismatch is the engine throw, one tier earlier', () => {
        const node = (
            <Document>
                <Chart chartType="bar" series={[{ values: [1, 2, 3], colors: ['#000', '#fff'] }]} altText="Short" />
            </Document>
        );
        const found = lintDocument(node).findings.find((f) => f.code === 'L_CHART_SERIES_COLORS');
        expect(found).toMatchObject({
            severity: 'error',
            blockIndex: 0,
            message: 'chart: series "Series 1" colors length (2) does not match values (3)',
        });

        let thrown: unknown;
        try {
            renderToBytes(node);
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe(found?.message);
        expect(toErrorEnvelope(thrown).error.code).toBe('E_INPUT');
    });

    it('other lint messages name an unlabelled series the way the engine does', () => {
        const report = lintDocument(
            <Document>
                <Chart chartType="bar" categories={['a', 'b']} series={[{ values: [1] }, { label: 'Named', values: [1] }]} altText="x" />
            </Document>,
        );
        const messages = report.findings.filter((f) => f.code === 'L_CHART_CATEGORIES').map((f) => f.message);
        expect(messages[0]).toContain('series "Series 1"');
        expect(messages[1]).toContain('series "Named"');
    });
});
