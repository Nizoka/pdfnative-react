import { describe, expect, it, vi } from 'vitest';
import {
    Document,
    Heading,
    PageBreak,
    Paragraph,
    TableOfContents,
    fromBase64,
    fromUrl,
    inspectDocument,
    renderToBlob,
    renderToBytes,
    renderToFile,
    renderToFileStream,
    renderToStream,
    resolveFonts,
    validateFontData,
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

    it('rejects an unstreamable document at call time, not at first pull', () => {
        // The engine cannot know the final page count when page 1 is emitted,
        // so a <TableOfContents> is unstreamable. The engine's own check runs
        // inside the generator — too late for renderToResponse, which has
        // already handed the Response to the framework by then. renderToStream
        // must therefore throw synchronously, before the generator exists.
        const unstreamable = (
            <Document title="Unstreamable">
                <TableOfContents />
                <Heading>Title</Heading>
            </Document>
        );
        expect(() => renderToStream(unstreamable)).toThrowError(/toc|table of contents/i);
    });

    it('rejects a {pages} footer template at call time', () => {
        const unstreamable = (
            <Document title="Unstreamable" footer={{ right: 'Page {page} of {pages}' }}>
                <Paragraph>Body</Paragraph>
            </Document>
        );
        expect(() => renderToStream(unstreamable)).toThrowError(/\{pages\}|pages/i);
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

describe('renderToFileStream', () => {
    it('streams a PDF to disk and preserves the outline', async () => {
        const path = join(tmpdir(), `pdfnative-react-stream-${Date.now()}.pdf`);
        const doc = (
            <Document title="Streamed" outline="auto">
                <Heading>One</Heading>
                <PageBreak />
                <Heading>Two</Heading>
            </Document>
        );
        try {
            const result = await renderToFileStream(doc, path);
            expect(result.bytesWritten).toBeGreaterThan(100);
            const text = decode(new Uint8Array(await readFile(path)));
            expect(text.startsWith('%PDF-')).toBe(true);
            // Document-level features survive the streaming path (verified
            // against the engine: buildDocumentPDFStreamTrue emits /Outlines).
            expect(text.includes('/Outlines')).toBe(true);
        } finally {
            await rm(path, { force: true });
        }
    });
});

describe('inspectDocument', () => {
    it('reports page count and per-block geometry without rendering', () => {
        const report = inspectDocument(sample);
        expect(report.totalPages).toBeGreaterThanOrEqual(1);
        expect(report.pageWidth).toBeGreaterThan(0);
        const first = report.pages[0].blocks[0];
        expect(first.type).toBe('heading');
        expect(first.page).toBe(0);
    });
});

describe('assets', () => {
    it('decodes a base64 payload (with and without a data URI prefix)', () => {
        const bare = fromBase64('aGVsbG8=');
        expect(new TextDecoder().decode(bare)).toBe('hello');

        const prefixed = fromBase64('data:image/png;base64,aGVsbG8=');
        expect(new TextDecoder().decode(prefixed)).toBe('hello');
    });

    it('fetches bytes from a URL via the global fetch', async () => {
        const payload = new Uint8Array([1, 2, 3, 4]);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => payload.buffer,
        } as Response);
        vi.stubGlobal('fetch', fetchMock);
        try {
            const bytes = await fromUrl('https://example.test/x.png');
            expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
            expect(fetchMock).toHaveBeenCalledOnce();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('throws a descriptive error on a non-OK response', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' } as Response),
        );
        try {
            await expect(fromUrl('https://example.test/missing.png')).rejects.toThrow(/404/);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('resolveFonts', () => {
    it('registers loaders and returns font entries', async () => {
        const fakeFont = {
            metrics: {
                unitsPerEm: 1000,
                ascent: 800,
                descent: -200,
                capHeight: 700,
                stemV: 80,
                bbox: [0, -200, 1000, 800],
                defaultWidth: 500,
                numGlyphs: 1,
            },
            fontName: 'Fake',
            cmap: {},
            defaultWidth: 500,
            widths: {},
            gsub: {},
            ligatures: {},
            markAnchors: {},
            mark2mark: {},
            pdfWidthArray: '[500]',
            ttfBase64: '',
        };
        const entries = await resolveFonts({ fake: () => Promise.resolve(fakeFont) });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ fontRef: 'fake', lang: 'fake' });
    });
});

describe('validateFontData', () => {
    it('rejects a non-font payload', () => {
        const result = validateFontData({ not: 'a font' });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts a bundled font-data module', async () => {
        const mod = await import('pdfnative/fonts/noto-sans-data.js');
        const result = validateFontData(mod);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});
