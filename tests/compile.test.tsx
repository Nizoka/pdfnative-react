import { describe, expect, it } from 'vitest';
import {
    Barcode,
    Cell,
    Document,
    FormField,
    Heading,
    Image,
    Item,
    Link,
    List,
    Page,
    PageBreak,
    Paragraph,
    PdfStructureError,
    Row,
    Spacer,
    Svg,
    Table,
    TableOfContents,
    compileDocument,
} from '../src/index.js';
import type { DocumentBlock } from '../src/index.js';

function blocksOf(node: Parameters<typeof compileDocument>[0]): readonly DocumentBlock[] {
    return compileDocument(node).blocks;
}

describe('compileDocument — document model', () => {
    it('captures document-level metadata', () => {
        const params = compileDocument(
            <Document
                title="Invoice"
                footerText="Confidential"
                metadata={{ author: 'Nizoka' }}
            >
                <Paragraph>Body</Paragraph>
            </Document>,
        );

        expect(params.title).toBe('Invoice');
        expect(params.footerText).toBe('Confidential');
        expect(params.metadata).toEqual({ author: 'Nizoka' });
        expect(params.blocks).toHaveLength(1);
    });

    it('throws when the root is not <Document>', () => {
        expect(() => compileDocument(<Paragraph>orphan</Paragraph>)).toThrow(
            PdfStructureError,
        );
    });
});

describe('compileDocument — text blocks', () => {
    it('maps headings with level and text from children', () => {
        const [block] = blocksOf(
            <Document>
                <Heading level={2}>Section</Heading>
            </Document>,
        );
        expect(block).toEqual({ type: 'heading', text: 'Section', level: 2 });
    });

    it('defaults heading level to 1', () => {
        const [block] = blocksOf(
            <Document>
                <Heading>Title</Heading>
            </Document>,
        );
        expect(block).toMatchObject({ type: 'heading', level: 1 });
    });

    it('maps paragraphs with alignment and font size', () => {
        const [block] = blocksOf(
            <Document>
                <Paragraph align="center" fontSize={14}>
                    Hello
                </Paragraph>
            </Document>,
        );
        expect(block).toEqual({
            type: 'paragraph',
            text: 'Hello',
            align: 'center',
            fontSize: 14,
        });
    });
});

describe('compileDocument — lists', () => {
    it('builds a bullet list from <Item> children', () => {
        const [block] = blocksOf(
            <Document>
                <List>
                    <Item>One</Item>
                    <Item>Two</Item>
                </List>
            </Document>,
        );
        expect(block).toEqual({
            type: 'list',
            items: ['One', 'Two'],
            style: 'bullet',
        });
    });

    it('builds a numbered list from the items prop when ordered', () => {
        const [block] = blocksOf(
            <Document>
                <List ordered items={['A', 'B']} />
            </Document>,
        );
        expect(block).toEqual({
            type: 'list',
            items: ['A', 'B'],
            style: 'numbered',
        });
    });
});

describe('compileDocument — tables', () => {
    it('derives headers from the first header row', () => {
        const [block] = blocksOf(
            <Document>
                <Table>
                    <Row header>
                        <Cell>Name</Cell>
                        <Cell>Total</Cell>
                    </Row>
                    <Row>
                        <Cell>Widget</Cell>
                        <Cell>42</Cell>
                    </Row>
                </Table>
            </Document>,
        );

        expect(block).toMatchObject({
            type: 'table',
            headers: ['Name', 'Total'],
        });
        expect((block as Extract<DocumentBlock, { type: 'table' }>).rows).toEqual([
            { cells: ['Widget', '42'], type: 'default', pointed: false },
        ]);
    });

    it('accepts headers and rows via props', () => {
        const [block] = blocksOf(
            <Document>
                <Table
                    headers={['A']}
                    rows={[{ cells: ['1'], type: 'default', pointed: false }]}
                />
            </Document>,
        );
        expect(block).toMatchObject({ type: 'table', headers: ['A'] });
    });
});

describe('compileDocument — media, links and layout', () => {
    it('maps images, links, spacers and barcodes', () => {
        const data = new Uint8Array([1, 2, 3]);
        const blocks = blocksOf(
            <Document>
                <Image data={data} width={100} alt="logo" />
                <Link href="https://pdfnative.dev">Site</Link>
                <Spacer height={20} />
                <Barcode format="qr" data="hello" />
                <Svg data="M0 0 L10 10" />
                <FormField fieldType="text" name="email" label="Email" />
                <TableOfContents title="Contents" />
            </Document>,
        );

        expect(blocks[0]).toEqual({ type: 'image', data, width: 100, alt: 'logo' });
        expect(blocks[1]).toEqual({
            type: 'link',
            text: 'Site',
            url: 'https://pdfnative.dev',
        });
        expect(blocks[2]).toEqual({ type: 'spacer', height: 20 });
        expect(blocks[3]).toMatchObject({ type: 'barcode', format: 'qr', data: 'hello' });
        expect(blocks[4]).toMatchObject({ type: 'svg', data: 'M0 0 L10 10' });
        expect(blocks[5]).toMatchObject({
            type: 'formField',
            fieldType: 'text',
            name: 'email',
        });
        expect(blocks[6]).toMatchObject({ type: 'toc', title: 'Contents' });
    });
});

describe('compileDocument — pages', () => {
    it('inserts a page break between <Page> siblings', () => {
        const blocks = blocksOf(
            <Document>
                <Page>
                    <Paragraph>First</Paragraph>
                </Page>
                <Page>
                    <Paragraph>Second</Paragraph>
                </Page>
            </Document>,
        );

        expect(blocks.map((b) => b.type)).toEqual([
            'paragraph',
            'pageBreak',
            'paragraph',
        ]);
    });

    it('honours an explicit <PageBreak>', () => {
        const blocks = blocksOf(
            <Document>
                <Paragraph>A</Paragraph>
                <PageBreak />
                <Paragraph>B</Paragraph>
            </Document>,
        );
        expect(blocks.map((b) => b.type)).toEqual([
            'paragraph',
            'pageBreak',
            'paragraph',
        ]);
    });
});
