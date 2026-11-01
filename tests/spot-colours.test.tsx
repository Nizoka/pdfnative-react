/**
 * Spot colours (engine ≥ 1.9.0) — `print.spotColours` declares named inks
 * with a process alternate; `{ spot, tint }` paints through a `/Separation`
 * space and `{ inks }` through a `/DeviceN` mix.
 *
 * Both doors carry the declaration whole (it is part of `print`), the schema
 * and `validateSpec` accept the two colour forms, and the two lint rules are
 * the engine's own throws one tier earlier: an undeclared ink and a mix
 * across alternate spaces, with the engine's messages, classified `E_INPUT`.
 */
import { describe, expect, it } from 'vitest';
import {
    Chart,
    Document,
    Heading,
    Paragraph,
    Table,
    compileDocument,
    compileSpec,
    lintDocument,
    lintSpec,
    renderToBytes,
    toErrorEnvelope,
    validateSpec,
} from '../src/index.js';
import type { DocSpec, PrintOptions } from '../src/index.js';

const PRINT: PrintOptions = {
    spotColours: [
        { name: 'PANTONE 300 C', alternate: [100, 44, 0, 0] },
        { name: 'Varnish', alternate: [0, 0, 0, 10] },
        { name: 'Neon', alternate: [255, 80, 0] },
    ],
};
const PINNED = new Date('2026-01-01T00:00:00Z');
const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

const doc = (
    <Document title="Inks" print={PRINT} creationDate={PINNED} layout={{ compress: false }}>
        <Heading level={1} color={{ spot: 'PANTONE 300 C' }}>Brand blue</Heading>
        <Paragraph color={{ spot: 'PANTONE 300 C', tint: 0.5 }}>A 50 % tint of the same ink.</Paragraph>
        <Paragraph color={{ inks: { 'PANTONE 300 C': 1, Varnish: 0.3 } }}>Blue under varnish.</Paragraph>
        <Table headers={['Plate', 'Coverage']} rows={[{ cells: ['Blue', '100 %'], type: 'default', pointed: false }]} zebra={{ spot: 'Varnish', tint: 0.2 }} />
    </Document>
);
const spec: DocSpec = {
    title: 'Inks',
    print: PRINT,
    creationDate: '2026-01-01T00:00:00Z',
    layout: { compress: false },
    blocks: [
        ['h1', 'Brand blue', { color: { spot: 'PANTONE 300 C' } }],
        ['p', 'A 50 % tint of the same ink.', { color: { spot: 'PANTONE 300 C', tint: 0.5 } }],
        ['p', 'Blue under varnish.', { color: { inks: { 'PANTONE 300 C': 1, Varnish: 0.3 } } }],
        ['table', { h: ['Plate', 'Coverage'], r: [['Blue', '100 %']], zebra: { spot: 'Varnish', tint: 0.2 } }],
    ],
};

describe('spot colours — both doors', () => {
    it('reaches layout.print whole, with the colour objects verbatim', () => {
        const model = compileDocument(doc);
        expect(model.layout?.print).toEqual(PRINT);
        expect(model.blocks[0]).toMatchObject({ color: { spot: 'PANTONE 300 C' } });
        expect(model.blocks[2]).toMatchObject({ color: { inks: { 'PANTONE 300 C': 1, Varnish: 0.3 } } });
    });

    it('the DocSpec twin validates and compiles to the same model', () => {
        expect(validateSpec(spec)).toEqual({ ok: true, errors: [], warnings: [] });
        expect(compileSpec(spec)).toEqual(compileDocument(doc));
    });

    it('lints clean when every ink is declared', () => {
        expect(lintDocument(doc).findings).toEqual([]);
        expect(lintSpec(spec).findings).toEqual([]);
    });

    it('writes a /Separation for each ink and a five-element /DeviceN with /Colorants for the mix', () => {
        const text = latin1(renderToBytes(doc));
        expect(text).toMatch(/\/Separation\s*\/PANTONE#20300#20C/);
        expect(text).toMatch(/\/Separation\s*\/Varnish/);
        expect(text).toMatch(/\/DeviceN\s*\[\s*\/PANTONE#20300#20C\s*\/Varnish\s*\]/);
        expect(text).toContain('/Colorants');
    });
});

describe('spot colours — the lint rules are the engine throws, one tier earlier', () => {
    const thrown = (node: Parameters<typeof renderToBytes>[0]): { message: string; code: string } => {
        try {
            renderToBytes(node);
        } catch (err) {
            return { message: err instanceof Error ? err.message : String(err), code: toErrorEnvelope(err).error.code };
        }
        throw new Error('the engine accepted an undeclared ink');
    };

    it('L_SPOT_UNDECLARED — an ink the document does not declare, once per ink', () => {
        const node = (
            <Document title="Undeclared" print={PRINT}>
                <Heading level={1} color={{ spot: 'Gold' }}>Gold</Heading>
                <Paragraph color={{ spot: 'Gold', tint: 0.5 }}>Still gold.</Paragraph>
                <Paragraph color={{ inks: { Gold: 1, Silver: 0.5 } }}>Two unknown inks.</Paragraph>
            </Document>
        );
        const report = lintDocument(node);
        const findings = report.findings.filter((f) => f.code === 'L_SPOT_UNDECLARED');
        expect(findings.map((f) => f.message)).toEqual([
            "Spot colour 'Gold' is not declared — add { name: 'Gold', alternate: [c, m, y, k] } to layout.print.spotColours",
            "Spot colour 'Silver' is not declared — add { name: 'Silver', alternate: [c, m, y, k] } to layout.print.spotColours",
        ]);
        expect(report.ok).toBe(false);

        const engine = thrown(node);
        expect(engine.message).toBe(findings[0].message);
        expect(engine.code).toBe('E_INPUT');
    });

    it('L_SPOT_UNDECLARED — fires without any print declaration at all', () => {
        const report = lintDocument(
            <Document>
                <Paragraph color={{ spot: 'Gold' }}>x</Paragraph>
            </Document>,
        );
        expect(report.findings.map((f) => f.code)).toEqual(['L_SPOT_UNDECLARED']);
    });

    it('L_SPOT_INK_MIX — a mix of a CMYK-alternate ink and an RGB-alternate ink', () => {
        const node = (
            <Document title="Mixed spaces" print={PRINT}>
                <Paragraph color={{ inks: { 'PANTONE 300 C': 1, Neon: 0.5 } }}>Across spaces.</Paragraph>
            </Document>
        );
        const found = lintDocument(node).findings.find((f) => f.code === 'L_SPOT_INK_MIX');
        expect(found?.message).toBe(
            "Ink mix 'PANTONE 300 C' + 'Neon': every ink of a mix needs the same alternate space (all CMYK or all RGB)",
        );
        expect(found?.severity).toBe('error');
        expect(thrown(node).code).toBe('E_INPUT');
    });

    it('L_SPOT_INK_MIX — an empty mix and a tint outside 0–1 are the engine throws too', () => {
        const cases: [string, Parameters<typeof renderToBytes>[0]][] = [
            [
                'Invalid ink mix: no inks',
                <Document title="Empty mix" print={PRINT}>
                    <Paragraph color={{ inks: {} }}>Nothing.</Paragraph>
                </Document>,
            ],
            [
                "Invalid tint of spot colour 'Varnish': 2. Expected a tint between 0 and 1.",
                <Document title="Tint" print={PRINT}>
                    <Paragraph color={{ spot: 'Varnish', tint: 2 }}>Too much.</Paragraph>
                </Document>,
            ],
            [
                "Invalid tint of ink 'Varnish': 1.5. Expected a tint between 0 and 1.",
                <Document title="Ink tint" print={PRINT}>
                    <Paragraph color={{ inks: { Varnish: 1.5 } }}>Too much.</Paragraph>
                </Document>,
            ],
        ];
        for (const [message, node] of cases) {
            const found = lintDocument(node).findings.find((f) => f.code === 'L_SPOT_INK_MIX');
            expect(found?.message, message).toBe(message);
            const engine = thrown(node);
            expect(engine.message, message).toBe(message);
            expect(engine.code, message).toBe('E_INPUT');
        }
    });

    it('L_SPOT_INK_MIX — clean when every ink of the mix shares a space', () => {
        const report = lintDocument(
            <Document title="Same space" print={PRINT}>
                <Paragraph color={{ inks: { 'PANTONE 300 C': 1, Varnish: 0.5 } }}>Both CMYK.</Paragraph>
            </Document>,
        );
        expect(report.findings.map((f) => f.code)).not.toContain('L_SPOT_INK_MIX');
    });

    it('L_PRINT_BOXES — an invalid declaration carries the engine message (duplicate ink)', () => {
        const report = lintDocument(
            <Document
                title="Twice"
                print={{ spotColours: [{ name: 'Varnish', alternate: [0, 0, 0, 10] }, { name: 'Varnish', alternate: [0, 0, 0, 20] }] }}
            >
                <Paragraph>x</Paragraph>
            </Document>,
        );
        expect(report.findings.find((f) => f.code === 'L_PRINT_BOXES')?.message).toBe(
            "print.spotColours: ink 'Varnish' is declared twice",
        );
    });

    it('L_CMYK_INTENT_MISMATCH — a spot colour with a CMYK alternate counts as CMYK content under an RGB intent', () => {
        const report = lintDocument(
            <Document title="Spot under PDF/A" tagged="pdfa2b" print={PRINT}>
                <Paragraph color={{ spot: 'PANTONE 300 C' }}>Blue.</Paragraph>
            </Document>,
        );
        const found = report.findings.find((f) => f.code === 'L_CMYK_INTENT_MISMATCH');
        expect(found?.message).toContain('1 CMYK colour(s)');
    });

    it('per-value chart colours take spot inks too, and are checked for declaration', () => {
        const chart = (
            <Chart
                chartType="bar"
                categories={['Blue', 'Varnish']}
                series={[{ label: 'Coverage', values: [100, 30], colors: [{ spot: 'PANTONE 300 C' }, { spot: 'Lacquer' }] }]}
                altText="Ink coverage per plate"
            />
        );
        const report = lintDocument(
            <Document title="Chart inks" print={PRINT}>
                {chart}
            </Document>,
        );
        expect(report.findings.map((f) => f.code)).toEqual(['L_SPOT_UNDECLARED']);
        expect(report.findings[0].message).toContain("'Lacquer'");
    });
});
