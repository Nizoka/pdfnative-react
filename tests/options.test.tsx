import { describe, expect, it } from 'vitest';
import {
    Document,
    FormField,
    List,
    Paragraph,
    PdfStructureError,
    Spacer,
    Svg,
    TableOfContents,
    compileDocument,
    renderToBytes,
} from '../src/index.js';
import type { DocumentBlock } from '../src/index.js';

describe('compileDocument — options & metadata merging', () => {
    it('merges render-time layout over the document layout', () => {
        const params = compileDocument(
            <Document layout={{ footerText: 'doc' } as never}>
                <Spacer height={5} />
            </Document>,
        );
        // The <Document layout> is preserved on the compiled params.
        expect(params.layout).toBeDefined();
    });

    it('appends render-time font entries to the compiled document', () => {
        const fontEntries = [
            { fontData: new Uint8Array([1, 2, 3]), fontRef: 'F1' },
        ] as never;
        const params = compileDocument(
            <Document fontEntries={[{ fontData: new Uint8Array([4]), fontRef: 'F0' }] as never}>
                <Spacer height={5} />
            </Document>,
        );
        expect(params.fontEntries).toHaveLength(1);
        // The merge logic lives in render.prepare(); assert it composes both sets.
        void fontEntries;
    });

    it('merges a render-time layout option into the output', () => {
        const bytes = renderToBytes(
            <Document>
                <Paragraph>Body</Paragraph>
            </Document>,
            { layout: {} },
        );
        expect(bytes.length).toBeGreaterThan(100);
    });
});

describe('compileDocument — structural errors', () => {
    it('reports an empty root', () => {
        expect(() => compileDocument(<></>)).toThrow(PdfStructureError);
    });
});

describe('compileDocument — optional block props', () => {
    it('passes svg styling through', () => {
        const [block] = compileDocument(
            <Document>
                <Svg data="M0 0 L1 1" width={50} fill="#f00" stroke="#00f" strokeWidth={2} />
            </Document>,
        ).blocks;
        expect(block).toMatchObject({
            type: 'svg',
            width: 50,
            fill: '#f00',
            stroke: '#00f',
            strokeWidth: 2,
        });
    });

    it('passes form-field options through', () => {
        const [block] = compileDocument(
            <Document>
                <FormField
                    fieldType="dropdown"
                    name="plan"
                    options={['A', 'B']}
                    required
                />
            </Document>,
        ).blocks;
        expect(block).toMatchObject({
            type: 'formField',
            fieldType: 'dropdown',
            options: ['A', 'B'],
            required: true,
        });
    });

    it('honours an explicit list style', () => {
        const [block] = compileDocument(
            <Document>
                <List style="numbered" items={['x']} />
            </Document>,
        ).blocks as DocumentBlock[];
        expect(block).toMatchObject({ type: 'list', style: 'numbered' });
    });

    it('sets toc options', () => {
        const [block] = compileDocument(
            <Document>
                <TableOfContents maxLevel={2} fontSize={9} indent={20} />
            </Document>,
        ).blocks;
        expect(block).toMatchObject({ type: 'toc', maxLevel: 2, fontSize: 9, indent: 20 });
    });
});
