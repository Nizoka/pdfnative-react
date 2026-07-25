/**
 * Web-standard `Response` helpers — the server-side entry point.
 *
 * These turn a document straight into an HTTP response, which is what a
 * Next.js Route Handler, a Server Action, a Remix loader, a Hono/Elysia route
 * or any Fetch-API server actually needs:
 *
 * ```ts
 * // app/invoice/route.ts
 * import { renderToResponse } from 'pdfnative-react';
 *
 * export async function GET() {
 *     return renderToResponse(<Invoice />, { fileName: 'invoice.pdf' });
 * }
 * ```
 *
 * By default the body is a `ReadableStream` fed by the engine's page-by-page
 * generator, so peak memory stays flat and the client sees bytes immediately.
 * Pass `buffered: true` when you need a `Content-Length` up front.
 *
 * Nothing here touches the DOM or React client APIs — **do not** add
 * `'use client'` to this module.
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import { renderToBytes, renderToStream } from './render.js';
import { optionsWithFonts } from './fonts.js';
import type { RenderOptions } from './types.js';

/** Options for {@link renderToResponse} / {@link renderSpecToResponse}. */
export interface PdfResponseOptions extends RenderOptions {
    /** Filename advertised in `Content-Disposition`. Default: `'document.pdf'`. */
    readonly fileName?: string;
    /**
     * `'inline'` renders in the browser's PDF viewer, `'attachment'` forces a
     * download. Default: `'inline'`.
     */
    readonly disposition?: 'inline' | 'attachment';
    /**
     * Buffer the whole PDF before responding, which allows a `Content-Length`
     * header. Default: `false` (stream with constant memory).
     */
    readonly buffered?: boolean;
    /** HTTP status code. Default: `200`. */
    readonly status?: number;
    /** Extra response headers, merged last so they can override the defaults. */
    readonly headers?: HeadersInit;
}

/**
 * Build an RFC 6266 `Content-Disposition` value, adding the `filename*`
 * parameter only when the name is not plain ASCII.
 */
function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(fileName);
    const base = `${disposition}; filename="${ascii}"`;
    return encoded === ascii ? base : `${base}; filename*=UTF-8''${encoded}`;
}

/** Adapt the engine's async byte generator to a web `ReadableStream`. */
function toReadableStream(source: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            const next = await source.next();
            if (next.done === true) {
                controller.close();
                return;
            }
            controller.enqueue(next.value);
        },
        async cancel() {
            // Let the generator run its cleanup when the client disconnects.
            await source.return(undefined);
        },
    });
}

function buildHeaders(options: PdfResponseOptions | undefined, byteLength?: number): Headers {
    const headers = new Headers({
        'content-type': 'application/pdf',
        'content-disposition': contentDisposition(
            options?.disposition ?? 'inline',
            options?.fileName ?? 'document.pdf',
        ),
    });
    if (byteLength !== undefined) headers.set('content-length', String(byteLength));
    if (options?.headers) {
        // Merge last so callers can override any default (e.g. cache-control).
        new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    }
    return headers;
}

/**
 * Render a document straight to a web-standard `Response`.
 *
 * Streams by default. Works in Node ≥ 22, the Edge runtime, Deno, Bun and
 * Cloudflare Workers — anywhere `Response` and `ReadableStream` exist.
 *
 * @param node - A React element whose root is `<Document>`.
 * @param options - Render options plus response shaping (filename, disposition…).
 */
export async function renderToResponse(
    node: ReactNode,
    options?: PdfResponseOptions,
): Promise<Response> {
    const resolved = await optionsWithFonts(options);
    const status = options?.status ?? 200;

    if (options?.buffered === true) {
        const bytes = renderToBytes(node, resolved);
        return new Response(bytes as BodyInit, {
            status,
            headers: buildHeaders(options, bytes.byteLength),
        });
    }

    const stream = toReadableStream(renderToStream(node, resolved));
    return new Response(stream, { status, headers: buildHeaders(options) });
}
