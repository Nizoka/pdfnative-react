import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    BlobProvider,
    Document,
    Heading,
    PDFDownloadLink,
    PDFViewer,
    Paragraph,
    type PdfRenderState,
} from '../src/index.js';

const doc = (
    <Document title="Viewer test">
        <Heading>Title</Heading>
        <Paragraph>Body</Paragraph>
    </Document>
);

describe('PDFViewer', () => {
    it('renders an iframe pointing at the generated blob URL', async () => {
        const { container } = render(<PDFViewer document={doc} title="Preview" />);
        const iframe = container.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute('title')).toBe('Preview');

        await waitFor(() => expect(iframe?.getAttribute('src')).toMatch(/^blob:/));
    });
});

describe('PDFDownloadLink', () => {
    it('renders an anchor with a download attribute and blob href', async () => {
        const { container } = render(
            <PDFDownloadLink document={doc} fileName="out.pdf">
                Download
            </PDFDownloadLink>,
        );
        const anchor = container.querySelector('a');
        expect(anchor?.getAttribute('download')).toBe('out.pdf');
        expect(anchor?.textContent).toBe('Download');

        await waitFor(() => expect(anchor?.getAttribute('href')).toMatch(/^blob:/));
    });

    it('supports render-prop children receiving the render state', async () => {
        let seen: PdfRenderState | null = null;
        const { container } = render(
            <PDFDownloadLink document={doc}>
                {(state) => {
                    seen = state;
                    return <span>{state.loading ? 'Preparing…' : 'Ready'}</span>;
                }}
            </PDFDownloadLink>,
        );

        await waitFor(() => expect(container.textContent).toBe('Ready'));
        expect(seen).not.toBeNull();
    });
});

describe('BlobProvider', () => {
    it('passes the render state to its function child', async () => {
        const { container } = render(
            <BlobProvider document={doc}>
                {({ blob, loading }) => (
                    <span>{loading ? 'loading' : `size:${blob?.size ?? 0}`}</span>
                )}
            </BlobProvider>,
        );

        await waitFor(() => expect(container.textContent).toMatch(/^size:\d+$/));
    });
});
