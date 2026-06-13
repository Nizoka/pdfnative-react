import { describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    renderToBlob,
    renderToBytes,
    renderToFile,
    renderToStream,
} from '../src/index.js';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sample = (
    <Document title="Render test">
        <Heading>Title</Heading>
        <Paragraph>Hello, pdfnative-react.</Paragraph>
    </Document>
);

function decode(bytes: Uint8Array): string {
    return new TextDecoder('latin1').decode(bytes);
}

describe('renderToBytes', () => {
    it('produces a valid PDF byte stream', () => {
        const bytes = renderToBytes(sample);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.byteLength).toBeGreaterThan(100);

        const text = decode(bytes);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});

describe('renderToBlob', () => {
    it('returns an application/pdf blob', () => {
        const blob = renderToBlob(sample);
        expect(blob.type).toBe('application/pdf');
        expect(blob.size).toBeGreaterThan(100);
    });
});

describe('renderToStream', () => {
    it('streams a complete PDF across chunks', async () => {
        const chunks: Uint8Array[] = [];
        for await (const chunk of renderToStream(sample)) {
            chunks.push(chunk);
        }
        expect(chunks.length).toBeGreaterThan(0);

        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
        }

        const text = decode(merged);
        expect(text.startsWith('%PDF-')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});

describe('renderToFile', () => {
    it('writes a PDF to disk', async () => {
        const path = join(tmpdir(), `pdfnative-react-${Date.now()}.pdf`);
        try {
            await renderToFile(sample, path);
            const bytes = await readFile(path);
            expect(decode(new Uint8Array(bytes)).startsWith('%PDF-')).toBe(true);
        } finally {
            await rm(path, { force: true });
        }
    });
});
