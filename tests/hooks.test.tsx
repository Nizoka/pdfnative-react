import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Document, Heading, Paragraph, usePdf, usePdfStream } from '../src/index.js';

const sample = (
    <Document title="Hook test">
        <Heading>Hi</Heading>
        <Paragraph>Body</Paragraph>
    </Document>
);

describe('usePdf', () => {
    it('renders bytes, a blob and an object URL', async () => {
        const { result } = renderHook(() => usePdf(sample));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBeNull();
        expect(result.current.bytes).toBeInstanceOf(Uint8Array);
        expect(result.current.blob?.type).toBe('application/pdf');
        expect(result.current.url).toMatch(/^blob:/);
    });

    it('exposes an error for an invalid tree', async () => {
        const { result } = renderHook(() => usePdf(<Paragraph>orphan</Paragraph>));

        await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
        expect(result.current.bytes).toBeNull();
    });

    it('re-renders when update() is called', async () => {
        const { result } = renderHook(() => usePdf(sample));
        await waitFor(() => expect(result.current.url).toMatch(/^blob:/));
        const first = result.current.url;

        act(() => {
            result.current.update();
        });

        await waitFor(() => expect(result.current.url).not.toBe(first));
    });
});

describe('usePdfStream', () => {
    it('provides a stable streaming factory', async () => {
        const { result } = renderHook(() => usePdfStream(sample));

        let bytes = 0;
        for await (const chunk of result.current.getStream()) {
            bytes += chunk.byteLength;
        }
        expect(bytes).toBeGreaterThan(100);
    });
});
