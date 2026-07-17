import { describe, expect, it } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    Document,
    Heading,
    List,
    Paragraph,
    Spacer,
    Table,
    compileDocument,
    compileSpec,
    docSpecSchema,
    docSpecSchemaId,
    inspectSpec,
    renderSpecToBlob,
    renderSpecToBytes,
    renderSpecToFile,
    renderSpecToStream,
    specToElement,
    version,
} from '../src/index.js';
import type { DocSpec, DocumentBlock, OutlineItem, PdfRow } from '../src/index.js';

function decode(bytes: Uint8Array): string {
    return new TextDecoder('latin1').decode(bytes);
}

describe('compileSpec — parity with the JSX surface', () => {
    it('produces the same model as the equivalent <Document> tree', () => {
        const spec: DocSpec = {
            title: 'Invoice #1024',
            footerText: 'Acme Inc',
            metadata: { author: 'Nizoka' },
            blocks: [
                ['h1', 'Invoice #1024'],
                ['p', 'Thank you for your business.', { align: 'right' }],
                ['ul', ['One', 'Two', 'Three']],
                ['sp', 8],
                ['table', { h: ['Item', 'Total'], r: [['Pro plan', '$490.00']] }],
            ],
        };

        const rows: PdfRow[] = [{ cells: ['Pro plan', '$490.00'], type: 'default', pointed: false }];
        const jsx = (
            <Document title="Invoice #1024" footerText="Acme Inc" metadata={{ author: 'Nizoka' }}>
                <Heading level={1}>Invoice #1024</Heading>
                <Paragraph align="right">Thank you for your business.</Paragraph>
                <List items={['One', 'Two', 'Three']} />
                <Spacer height={8} />
                <Table headers={['Item', 'Total']} rows={rows} />
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
    });

    it('maps heading levels h1/h2/h3 and every barcode format', () => {
        const model = compileSpec({
            blocks: [
                ['h1', 'A'],
                ['h2', 'B'],
                ['h3', 'C'],
                ['code128', '12345'],
                ['ean13', '4006381333931'],
                ['pdf417', 'PDF417'],
                ['datamatrix', 'DM'],
            ],
        });
        expect(model.blocks.slice(0, 3).map((b) => (b as { level: number }).level)).toEqual([
            1, 2, 3,
        ]);
        expect(model.blocks.slice(3).map((b) => (b as { format: string }).format)).toEqual([
            'code128',
            'ean13',
            'pdf417',
            'datamatrix',
        ]);
    });

    it('maps ol to a numbered list and ul to a bullet list', () => {
        const model = compileSpec({
            blocks: [
                ['ol', ['a', 'b']],
                ['ul', ['c']],
            ],
        });
        expect(model.blocks[0]).toMatchObject({ type: 'list', style: 'numbered' });
        expect(model.blocks[1]).toMatchObject({ type: 'list', style: 'bullet' });
    });

    it('supports nested list items in the ul/ol grammar', () => {
        const model = compileSpec({
            blocks: [['ul', [{ text: 'Parent', items: ['Child'] }, 'Leaf']]],
        });
        const items = (model.blocks[0] as Extract<DocumentBlock, { type: 'list' }>).items;
        expect(items[0]).toEqual({ text: 'Parent', items: ['Child'] });
        expect(items[1]).toBe('Leaf');
    });

    it('passes document-level outline and page labels through', () => {
        const outline: readonly OutlineItem[] = [{ title: 'Top', pageIndex: 0 }];
        const model = compileSpec({
            outline,
            pageLabels: [{ startPage: 0, style: 'decimal' }],
            blocks: [['h1', 'Top']],
        });
        expect(model.outline).toEqual(outline);
        expect(model.pageLabels).toEqual([{ startPage: 0, style: 'decimal' }]);
    });

    it('forwards table cell borders and vertical alignment', () => {
        const model = compileSpec({
            blocks: [
                [
                    'table',
                    {
                        h: ['A'],
                        r: [['1']],
                        cellBorders: { all: true },
                        cellVAlign: 'bottom',
                    },
                ],
            ],
        });
        expect(model.blocks[0]).toMatchObject({
            type: 'table',
            cellBorders: { all: true },
            cellVAlign: 'bottom',
        });
    });

    it('accepts full PdfRow objects alongside plain string-array rows', () => {
        const model = compileSpec({
            blocks: [
                [
                    'table',
                    {
                        h: ['K', 'V'],
                        r: [
                            ['plain', 'row'],
                            { cells: ['typed', 'row'], type: 'credit', pointed: true },
                        ],
                    },
                ],
            ],
        });
        expect(model.blocks[0]).toMatchObject({
            type: 'table',
            rows: [
                { cells: ['plain', 'row'], type: 'default', pointed: false },
                { cells: ['typed', 'row'], type: 'credit', pointed: true },
            ],
        });
    });

    it('groups blocks into pages with an inserted page break', () => {
        const model = compileSpec({
            blocks: [
                ['page', [['h1', 'One']]],
                ['page', [['h1', 'Two']]],
            ],
        });
        const types = model.blocks.map((b) => b.type);
        expect(types).toContain('pageBreak');
        expect(types.filter((t) => t === 'heading')).toHaveLength(2);
    });

    it('covers media, link, svg, barcode and form-field blocks', () => {
        const model = compileSpec({
            blocks: [
                ['link', 'pdfnative', { url: 'https://pdfnative.dev' }],
                ['qr', 'https://pdfnative.dev', { width: 120 }],
                ['svg', 'M0 0 L10 10', { width: 24, height: 24 }],
                ['toc', { title: 'Contents' }],
                ['br'],
                ['field', { fieldType: 'text', name: 'email', label: 'Email' }],
                ['img', { data: new Uint8Array([0xff, 0xd8, 0xff]), width: 50 }],
            ],
        });
        const types = model.blocks.map((b) => b.type);
        expect(types).toEqual([
            'link',
            'barcode',
            'svg',
            'toc',
            'pageBreak',
            'formField',
            'image',
        ]);
        expect(model.blocks[0]).toMatchObject({ type: 'link', url: 'https://pdfnative.dev' });
        expect(model.blocks[1]).toMatchObject({ type: 'barcode', format: 'qr' });
    });
});

describe('specToElement', () => {
    it('returns a <Document> element compilable by compileDocument', () => {
        const el = specToElement({ title: 'X', blocks: [['p', 'hi']] });
        const model = compileDocument(el);
        expect(model.title).toBe('X');
        expect(model.blocks).toHaveLength(1);
    });
});

describe('inspectSpec', () => {
    it('reports the layout of a spec without rendering', () => {
        const report = inspectSpec({ blocks: [['h1', 'Heading'], ['p', 'Body']] });
        expect(report.totalPages).toBeGreaterThanOrEqual(1);
        expect(report.pages[0].blocks[0].type).toBe('heading');
    });
});

describe('renderSpec* — PDF output', () => {
    const spec: DocSpec = {
        title: 'Spec render',
        blocks: [
            ['h1', 'Title'],
            ['p', 'Body'],
        ],
    };

    it('renderSpecToBytes emits a valid PDF', () => {
        const bytes = renderSpecToBytes(spec);
        const text = decode(bytes);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('renderSpecToBlob returns an application/pdf blob', () => {
        const blob = renderSpecToBlob(spec);
        expect(blob.type).toBe('application/pdf');
        expect(blob.size).toBeGreaterThan(100);
    });

    it('renderSpecToStream streams a complete PDF', async () => {
        const chunks: Uint8Array[] = [];
        for await (const chunk of renderSpecToStream(spec)) chunks.push(chunk);
        expect(chunks.length).toBeGreaterThan(0);
    });

    it('renderSpecToFile writes the PDF to disk', async () => {
        const path = join(tmpdir(), `pdfnative-react-spec-${Date.now()}.pdf`);
        try {
            await renderSpecToFile(spec, path);
            const written = await readFile(path);
            expect(decode(written).startsWith('%PDF-')).toBe(true);
        } finally {
            await rm(path, { force: true });
        }
    });
});

describe('docSpecSchema', () => {
    it('embeds the current package version in its $id', () => {
        const schema = docSpecSchema();
        expect(schema.$id).toBe(`https://pdfnative.dev/schema/react/${version}/doc-spec.schema.json`);
        expect(docSpecSchemaId()).toBe(schema.$id);
    });

    it('is a Draft 2020-12 object schema requiring blocks', () => {
        const schema = docSpecSchema();
        expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(schema.type).toBe('object');
        expect(schema.required).toContain('blocks');
    });

    it('defines recursive listItem and outlineItem $defs', () => {
        const schema = docSpecSchema() as { $defs: Record<string, unknown> };
        expect(schema.$defs.listItem).toBeDefined();
        expect(schema.$defs.outlineItem).toBeDefined();
        // Recursion: each $def references itself.
        expect(JSON.stringify(schema.$defs.listItem)).toContain('#/$defs/listItem');
        expect(JSON.stringify(schema.$defs.outlineItem)).toContain('#/$defs/outlineItem');
    });

    it('exposes top-level outline and pageLabels properties', () => {
        const schema = docSpecSchema() as { properties: Record<string, unknown> };
        expect(schema.properties.outline).toBeDefined();
        expect(schema.properties.pageLabels).toBeDefined();
    });
});
