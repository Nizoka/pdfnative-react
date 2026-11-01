/**
 * Layout changes inherited from engine 1.9.0 that reach the renderer with no
 * new prop: a table of contents longer than its page now paginates instead
 * of overflowing (#83), and `ColumnDef.kind: 'amount'` is honoured by the
 * document builder. Both are byte-level engine facts; the renderer's job is
 * to keep passing the model through, which these cases prove end to end.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    Table,
    TableOfContents,
    inspectDocument,
    renderToBytes,
} from '../src/index.js';

describe('inherited layout behaviour (engine 1.9.0)', () => {
    it('a table of contents longer than its page paginates, and inspectDocument agrees', () => {
        const headings = Array.from({ length: 120 }, (_, i) => (
            <Heading key={i} level={2}>{`Section ${String(i + 1)}`}</Heading>
        ));
        const node = (
            <Document title="Long contents">
                <TableOfContents title="Contents" />
                {headings}
            </Document>
        );
        const inspection = inspectDocument(node);
        const tocPages = inspection.pages.filter((p) => p.blocks.some((b) => b.type === 'toc')).length;
        expect(tocPages).toBeGreaterThan(1);
        const text = new TextDecoder('latin1').decode(renderToBytes(node));
        expect(text.startsWith('%PDF-')).toBe(true);
    });

    it("renders a table whose column is kind: 'amount'", () => {
        const text = new TextDecoder('latin1').decode(
            renderToBytes(
                <Document layout={{ compress: false }}>
                    <Paragraph>Totals</Paragraph>
                    <Table
                        headers={['Item', 'Amount']}
                        columns={[
                            { f: 0.6, a: 'l', mx: 40, mxH: 40 },
                            { f: 0.4, a: 'r', mx: 14, mxH: 14, kind: 'amount' },
                        ]}
                        rows={[
                            { cells: ['Widget', '1,250.00'], type: 'default', pointed: false },
                            { cells: ['Gadget', '85.50'], type: 'default', pointed: false },
                        ]}
                    />
                </Document>,
            ),
        );
        expect(text).toContain('(1,250.00)');
        expect(text).toContain('(85.50)');
    });
});
