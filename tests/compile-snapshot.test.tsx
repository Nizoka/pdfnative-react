/**
 * Golden snapshot of the compiled document model.
 *
 * `compileDocument()` is a pure JSX → JSON function, which makes it the ideal
 * regression surface: the rest of the suite asserts *shapes* (this block has
 * that field), but nothing asserted the **whole model** of a realistic document.
 * A serializer change that silently drops a prop, reorders blocks, or starts
 * emitting `undefined` would pass every other test.
 *
 * This is the wrapper-side analogue of the engine's `visual-regression.yml`.
 *
 * When this snapshot changes, read the diff. If the change is intended, update
 * it with `vitest -u`; if it is not, you have just caught a regression.
 */
import { describe, expect, it } from 'vitest';
import {
    Chart,
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
    Section,
    Spacer,
    Svg,
    Table,
    TableOfContents,
    Barcode,
    compileDocument,
    compileSpec,
} from '../src/index.js';
import type { DocSpec, PageTemplate, PdfAttachment, PdfRow } from '../src/index.js';

const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const FOOTER: PageTemplate = {
    left: 'Confidential',
    center: '{title}',
    right: 'Page {page} of {pages}',
};

const ATTACHMENT: PdfAttachment = {
    filename: 'invoice-2048.xml',
    data: new Uint8Array([0x3c, 0x69, 0x2f, 0x3e]),
    mimeType: 'application/xml',
    relationship: 'Data',
};

const ROWS: PdfRow[] = [
    { cells: ['Pro plan', '1', '€490.00'], type: 'default', pointed: false },
    { cells: ['Support', '1', '€99.00'], type: 'total', pointed: true },
];

/**
 * One document exercising every block kind and every document-level prop —
 * charts, layout sugar, outline, page labels, nested lists, typed table rows,
 * form fields, media and an explicit page group.
 */
const kitchenSink = (
    <Document
        title="Everything"
        footerText="Acme Inc"
        metadata={{ author: 'Acme Inc', subject: 'Snapshot fixture', keywords: 'test' }}
        outline="auto"
        pageLabels={[{ startPage: 0, style: 'roman' }, { startPage: 2, style: 'decimal' }]}
        watermark="DRAFT"
        header={{ left: 'Acme Inc', right: '{date}' }}
        footer={FOOTER}
        attachments={[ATTACHMENT]}
        tagged="pdfa3b"
        layout={{ pageWidth: 595, maxBlocks: 5000 }}
    >
        <Heading level={1}>Everything</Heading>
        <TableOfContents title="Contents" maxLevel={2} />
        <Section title="Prose" level={2} color="#334155">
            <Paragraph fontSize={11} lineHeight={1.4} align="right" indent={12} color="#111827">
                Body text with every typographic prop set.
            </Paragraph>
            <Spacer height={8} />
        </Section>
        <List ordered fontSize={10}>
            <Item text="First">
                <Item text="Nested A" />
                <Item text="Nested B" />
            </Item>
            <Item text="Second" />
        </List>
        <Table
            headers={['Item', 'Qty', 'Total']}
            rows={ROWS}
            zebra="#f8fafc"
            caption="Line items"
            cellVAlign="middle"
            cellBorders={{ all: true, color: '#e2e8f0', width: 0.5 }}
            repeatHeader
        />
        <Chart
            chartType="bar"
            series={[
                { label: '2025', values: [12, 18, 24, 31] },
                { label: '2026', values: [15, 21, 29, 38] },
            ]}
            categories={['Q1', 'Q2', 'Q3', 'Q4']}
            title="Revenue"
            axis={{ yMin: 0, ticks: 5, grid: true }}
            legend="bottom"
            markers
            colors={['#4e79a7', '#f28e2b']}
            align="center"
            altText="Revenue rises each quarter, 2026 above 2025 throughout."
        />
        <Image data={PIXEL} width={64} height={64} align="right" alt="A single pixel" />
        <Svg data="M0 0 L10 10" width={40} height={40} viewBox={[0, 0, 10, 10]} alt="A diagonal" />
        <Barcode format="qr" data="https://acme.example/pay/2048" width={96} align="right" />
        <Link url="https://acme.example/terms" fontSize={9} color="#2563eb">
            Read the terms
        </Link>
        <PageBreak />
        <Page>
            <Heading level={2}>Appendix</Heading>
            <FormField
                fieldType="text"
                name="applicant.email"
                label="Email"
                placeholder="you@example.com"
                required
                maxLength={120}
            />
        </Page>
    </Document>
);

describe('compileDocument — golden model', () => {
    it('produces a stable DocumentParams for a document using every feature', () => {
        expect(compileDocument(kitchenSink)).toMatchSnapshot();
    });

    it('emits no undefined values anywhere in the model', () => {
        // `compact()` is what keeps the emitted JSON deterministic; a regression
        // there would not change any individual assertion elsewhere.
        const json = JSON.stringify(compileDocument(kitchenSink), (_k, v: unknown) =>
            v === undefined ? '__UNDEFINED__' : v,
        );
        expect(json).not.toContain('__UNDEFINED__');
    });
});

describe('DocSpec parity — golden model', () => {
    it('a spec using every top-level field compiles to the same shape as JSX', () => {
        const spec: DocSpec = {
            title: 'Everything',
            footerText: 'Acme Inc',
            metadata: { author: 'Acme Inc', subject: 'Snapshot fixture', keywords: 'test' },
            outline: 'auto',
            pageLabels: [{ startPage: 0, style: 'roman' }, { startPage: 2, style: 'decimal' }],
            watermark: 'DRAFT',
            header: { left: 'Acme Inc', right: '{date}' },
            footer: FOOTER,
            attachments: [ATTACHMENT],
            tagged: 'pdfa3b',
            layout: { pageWidth: 595, maxBlocks: 5000 },
            blocks: [['h1', 'Everything']],
        };

        const jsx = (
            <Document
                title="Everything"
                footerText="Acme Inc"
                metadata={{ author: 'Acme Inc', subject: 'Snapshot fixture', keywords: 'test' }}
                outline="auto"
                pageLabels={[{ startPage: 0, style: 'roman' }, { startPage: 2, style: 'decimal' }]}
                watermark="DRAFT"
                header={{ left: 'Acme Inc', right: '{date}' }}
                footer={FOOTER}
                attachments={[ATTACHMENT]}
                tagged="pdfa3b"
                layout={{ pageWidth: 595, maxBlocks: 5000 }}
            >
                <Heading level={1}>Everything</Heading>
            </Document>
        );

        expect(compileSpec(spec)).toEqual(compileDocument(jsx));
    });
});
