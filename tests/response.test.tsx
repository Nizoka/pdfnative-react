/**
 * `renderToResponse` — the server entry point.
 *
 * Asserts the HTTP contract (headers, status, disposition), that the streamed
 * body really is a complete PDF, and that the buffered mode adds a
 * `Content-Length`.
 */
import { describe, expect, it } from 'vitest';
import {
    Document,
    Heading,
    Paragraph,
    renderSpecToResponse,
    renderToResponse,
} from '../src/index.js';

const DOC = (
    <Document title="Invoice">
        <Heading level={1}>Invoice #1024</Heading>
        <Paragraph>Thank you for your business.</Paragraph>
    </Document>
);

async function body(response: Response): Promise<string> {
    return new TextDecoder('latin1').decode(new Uint8Array(await response.arrayBuffer()));
}

describe('renderToResponse', () => {
    it('streams a complete PDF with the right content type', async () => {
        const response = await renderToResponse(DOC);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.body).not.toBeNull();

        const pdf = await body(response);
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('defaults to an inline disposition named document.pdf', async () => {
        const response = await renderToResponse(DOC);
        expect(response.headers.get('content-disposition')).toBe('inline; filename="document.pdf"');
    });

    it('honours fileName and an attachment disposition', async () => {
        const response = await renderToResponse(DOC, {
            fileName: 'invoice-1024.pdf',
            disposition: 'attachment',
        });
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="invoice-1024.pdf"',
        );
    });

    it('adds filename* for a non-ASCII filename', async () => {
        const response = await renderToResponse(DOC, { fileName: 'facture-écrite.pdf' });
        const disposition = response.headers.get('content-disposition') ?? '';
        expect(disposition).toContain('filename="facture-_crite.pdf"');
        expect(disposition).toContain("filename*=UTF-8''facture-%C3%A9crite.pdf");
    });

    it('percent-escapes characters that are not RFC 8187 attr-char', async () => {
        // encodeURIComponent leaves ' ( ) ! * ~ alone. A raw apostrophe is
        // actively harmful: a strict parser splits the ext-value on ' as
        // charset'lang'value and mis-reads the filename.
        const response = await renderToResponse(DOC, { fileName: "O'Néill (final)!.pdf" });
        const disposition = response.headers.get('content-disposition') ?? '';
        const ext = /filename\*=UTF-8''(.+)$/.exec(disposition)?.[1] ?? '';

        expect(ext).not.toContain("'");
        expect(ext).not.toContain('(');
        expect(ext).not.toContain(')');
        expect(ext).not.toContain('!');
        expect(decodeURIComponent(ext)).toBe("O'Néill (final)!.pdf");
    });

    it('releases the generator when the client disconnects', async () => {
        const response = await renderToResponse(DOC);
        expect(response.body).not.toBeNull();
        await expect(response.body?.cancel()).resolves.toBeUndefined();
    });

    it('sets content-length only in buffered mode', async () => {
        const streamed = await renderToResponse(DOC);
        expect(streamed.headers.get('content-length')).toBeNull();

        const buffered = await renderToResponse(DOC, { buffered: true });
        const length = Number(buffered.headers.get('content-length'));
        expect(length).toBeGreaterThan(0);

        const pdf = await body(buffered);
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.length).toBe(length);
    });

    it('produces the same bytes streamed and buffered', async () => {
        const [streamed, buffered] = await Promise.all([
            renderToResponse(DOC).then(body),
            renderToResponse(DOC, { buffered: true }).then(body),
        ]);
        expect(streamed).toBe(buffered);
    });

    it('accepts a custom status and extra headers, letting callers override defaults', async () => {
        const response = await renderToResponse(DOC, {
            status: 201,
            headers: { 'cache-control': 'no-store', 'content-type': 'application/octet-stream' },
        });
        expect(response.status).toBe(201);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('content-type')).toBe('application/octet-stream');
    });
});

describe('cache validators — cacheControl and etag', () => {
    const OTHER_DOC = (
        <Document title="Receipt">
            <Heading level={1}>Receipt #7</Heading>
            <Paragraph>Different bytes on purpose.</Paragraph>
        </Document>
    );

    it('sets neither cache-control nor etag unless asked — defaults unchanged', async () => {
        const response = await renderToResponse(DOC);
        expect(response.headers.get('cache-control')).toBeNull();
        expect(response.headers.get('etag')).toBeNull();
    });

    it('sets cache-control from the cacheControl option', async () => {
        const response = await renderToResponse(DOC, { cacheControl: 'private, max-age=60' });
        expect(response.headers.get('cache-control')).toBe('private, max-age=60');
    });

    it('sends a string etag verbatim and keeps streaming', async () => {
        // A caller-supplied validator needs nothing from the bytes, so the
        // constant-memory streaming path must survive it.
        const response = await renderToResponse(DOC, { etag: '"invoice-1024-r3"' });
        expect(response.headers.get('etag')).toBe('"invoice-1024-r3"');
        expect(response.headers.get('content-length')).toBeNull();

        const pdf = await body(response);
        expect(pdf.startsWith('%PDF-')).toBe(true);
    });

    it('etag: true derives a quoted, deterministic validator and implies buffering', async () => {
        const [first, second] = await Promise.all([
            renderToResponse(DOC, { etag: true }),
            renderToResponse(DOC, { etag: true }),
        ]);

        const etag = first.headers.get('etag') ?? '';
        expect(etag.startsWith('"')).toBe(true);
        expect(etag.endsWith('"')).toBe(true);
        // Deterministic: the same document always yields the same validator —
        // otherwise every response would bust the cache it claims to feed.
        expect(second.headers.get('etag')).toBe(etag);

        // Hashing needs the whole PDF up front, so buffering is implied.
        const length = Number(first.headers.get('content-length'));
        expect(length).toBeGreaterThan(0);
        const pdf = await body(first);
        expect(pdf.length).toBe(length);
        expect(pdf.startsWith('%PDF-')).toBe(true);
    });

    it('etag: true distinguishes different documents', async () => {
        const [a, b] = await Promise.all([
            renderToResponse(DOC, { etag: true }),
            renderToResponse(OTHER_DOC, { etag: true }),
        ]);
        expect(a.headers.get('etag')).not.toBe(b.headers.get('etag'));
    });

    it('lets the headers option override cache-control (merge-last)', async () => {
        const response = await renderToResponse(DOC, {
            cacheControl: 'public, max-age=600',
            headers: { 'cache-control': 'no-store' },
        });
        expect(response.headers.get('cache-control')).toBe('no-store');
    });
});

describe('renderSpecToResponse', () => {
    it('is the DocSpec twin of renderToResponse', async () => {
        const response = await renderSpecToResponse(
            { title: 'Invoice', blocks: [['h1', 'Invoice #1024']] },
            { fileName: 'spec.pdf', disposition: 'attachment' },
        );

        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="spec.pdf"',
        );
        const pdf = await body(response);
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });
});
