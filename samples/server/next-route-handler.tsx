/**
 * Next.js App Router — a PDF route handler and a Server Action.
 *
 * This is a *module*, not a runnable script: copy it into a Next.js 15+ app at
 * `app/invoice/[id]/route.tsx`. It is type-checked in CI like every other sample.
 *
 * `renderToResponse` returns a web-standard `Response`, so the same code runs
 * unchanged on the Node runtime, the Edge runtime, Deno, Bun and Cloudflare
 * Workers. It streams by default: the engine emits page by page, so peak memory
 * stays flat and the browser starts receiving bytes immediately.
 *
 * There is no 'use client' here on purpose — this is server-only code.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    Table,
    renderToResponse,
    renderSpecToResponse,
} from '../../src/index.js';
import type { DocSpec, PdfRow } from '../../src/index.js';

interface Invoice {
    readonly id: string;
    readonly customer: string;
    readonly lines: readonly { readonly label: string; readonly total: string }[];
}

async function loadInvoice(id: string): Promise<Invoice> {
    // Stand-in for your data layer.
    return await Promise.resolve({
        id,
        customer: 'Globex Corporation',
        lines: [
            { label: 'Pro plan (annual)', total: '€490.00' },
            { label: 'Priority support', total: '€99.00' },
        ],
    });
}

function InvoiceDocument({ invoice }: { readonly invoice: Invoice }): React.ReactElement {
    const rows: PdfRow[] = invoice.lines.map((line) => ({
        cells: [line.label, line.total],
        type: 'default',
        pointed: false,
    }));

    return (
        <Document
            title={`Invoice #${invoice.id}`}
            footer={{ left: 'Acme Inc', right: 'Page {page} of {pages}' }}
        >
            <Heading level={1}>Invoice #{invoice.id}</Heading>
            <Paragraph>Billed to: {invoice.customer}</Paragraph>
            <Table headers={['Item', 'Total']} rows={rows} zebra />
        </Document>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler — app/invoice/[id]/route.tsx
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    const { id } = await params;
    const invoice = await loadInvoice(id);

    return await renderToResponse(<InvoiceDocument invoice={invoice} />, {
        fileName: `invoice-${id}.pdf`,
        // 'inline' opens in the browser's viewer; 'attachment' forces a download.
        disposition: 'inline',
        headers: { 'cache-control': 'private, max-age=0, must-revalidate' },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buffered mode. Costs peak memory proportional to the document, and buys a
 * `Content-Length` header — worth it behind a CDN that needs the size up front.
 */
export async function GET_buffered(): Promise<Response> {
    const invoice = await loadInvoice('2048');
    return await renderToResponse(<InvoiceDocument invoice={invoice} />, {
        buffered: true,
        fileName: 'invoice.pdf',
        disposition: 'attachment',
    });
}

/**
 * The DocSpec twin, for when an agent or a config file produced the document.
 * Validate untrusted input with `validateSpec` before rendering it.
 */
export async function GET_fromSpec(): Promise<Response> {
    const spec: DocSpec = {
        title: 'Invoice #2048',
        footer: { right: 'Page {page} of {pages}' },
        blocks: [
            ['h1', 'Invoice #2048'],
            ['table', { h: ['Item', 'Total'], r: [['Pro plan', '€490.00']] }],
        ],
    };

    return await renderSpecToResponse(spec, { fileName: 'invoice.pdf' });
}

/**
 * Node's `http`/Express want a Node stream. Convert the web stream:
 *
 * ```ts
 * import { Readable } from 'node:stream';
 *
 * app.get('/invoice.pdf', async (_req, res) => {
 *     const response = await renderToResponse(<InvoiceDocument invoice={invoice} />);
 *     res.setHeader('content-type', 'application/pdf');
 *     Readable.fromWeb(response.body as never).pipe(res);
 * });
 * ```
 */
export const expressRecipe = true;
