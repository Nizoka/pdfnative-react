# Server rendering

`renderToResponse` turns a document into a web-standard `Response`. That is the
whole API — and because `Response` is a platform primitive rather than a
framework type, the same code runs unchanged on Node, the Edge runtime, Deno,
Bun and Cloudflare Workers.

Runnable: [`samples/server/next-route-handler.tsx`](../samples/server/next-route-handler.tsx).

## Next.js App Router

```tsx
// app/invoice/[id]/route.tsx
import { renderToResponse } from 'pdfnative-react';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const invoice = await loadInvoice(id);

    return renderToResponse(<InvoiceDocument invoice={invoice} />, {
        fileName: `invoice-${id}.pdf`,
        disposition: 'inline',
    });
}
```

No `'use client'`, no dynamic import, no `runtime` pragma. This is ordinary
server code.

## Options

```ts
interface PdfResponseOptions extends RenderOptions {
    fileName?: string;                     // default 'document.pdf'
    disposition?: 'inline' | 'attachment'; // default 'inline'
    buffered?: boolean;                    // default false (stream)
    status?: number;                       // default 200
    headers?: HeadersInit;                 // merged last — can override defaults
}
```

`RenderOptions` (`layout`, `fontEntries`, `fonts`) is inherited, so everything
you can pass to `renderToBytes` works here. Because `renderToResponse` is async,
the `fonts` loader-map shortcut **is** honoured — unlike the synchronous entry
points.

## Streaming versus buffered

**Streaming is the default.** The body is a `ReadableStream` fed by the engine's
page-by-page generator: peak memory stays flat regardless of document size, and
the browser starts receiving bytes before the last page exists.

```ts
renderToResponse(doc);                    // ReadableStream body, no Content-Length
renderToResponse(doc, { buffered: true }); // single buffer, Content-Length set
```

Choose `buffered: true` when something downstream needs the size up front — a
CDN, a proxy that will not chunk, or a client showing a determinate progress
bar. The bytes are identical either way; a test asserts it.

If the client disconnects mid-stream, the generator's cleanup runs via the
stream's `cancel` hook.

## Filenames

`Content-Disposition` is built to RFC 6266. Non-ASCII names get both forms — an
ASCII fallback and the encoded `filename*` — so every reader gets something
sensible:

```
inline; filename="facture-_crite.pdf"; filename*=UTF-8''facture-%C3%A9crite.pdf
```

## From a `DocSpec`

```ts
import { renderSpecToResponse, validateSpec } from 'pdfnative-react';

export async function POST(request: Request) {
    const body: unknown = await request.json();

    const check = validateSpec(body);
    if (!check.ok) {
        return Response.json({ ok: false, errors: check.errors }, { status: 400 });
    }

    return renderSpecToResponse(body as DocSpec, { fileName: 'report.pdf' });
}
```

Validate before rendering when the spec came from outside — `validateSpec` is
cheap, never throws, and returns path-anchored findings you can hand straight
back to the caller.

## Other frameworks

**Remix / React Router** — a loader returns a `Response`, so this is a direct fit:

```ts
export async function loader({ params }: LoaderFunctionArgs) {
    return renderToResponse(<Invoice id={params.id} />, { fileName: 'invoice.pdf' });
}
```

**Hono, Elysia, Deno, Bun, Workers** — all handlers return `Response`:

```ts
app.get('/invoice.pdf', async () => renderToResponse(<Invoice />));
```

**Express / Node `http`** — these want a Node stream, so convert:

```ts
import { Readable } from 'node:stream';

app.get('/invoice.pdf', async (_req, res) => {
    const response = await renderToResponse(<Invoice />);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', response.headers.get('content-disposition')!);
    Readable.fromWeb(response.body as never).pipe(res);
});
```

## Server Actions

A Server Action cannot return a `Response`, so return the bytes and let the
client build the download — or, better, point the client at a route handler and
keep the PDF out of the RSC payload entirely:

```tsx
'use server';
import { renderToBytes } from 'pdfnative-react';

export async function generate(id: string): Promise<Uint8Array> {
    return renderToBytes(<InvoiceDocument invoice={await loadInvoice(id)} />);
}
```

## Runtime requirements

`Response` and `ReadableStream` are required. Both are global from Node 18
onward, and this package's floor is Node 22, so on a supported install they are
always present. `doctor()` reports them as the `fetch-api` check — useful if you
are targeting an unusual runtime.

Rendering itself is pure computation: no filesystem, no network, no native
modules. It works in a sandbox, a Worker, or a read-only container.

## Caching

The PDF is a deterministic function of your data, so cache it like any other
derived resource:

```ts
return renderToResponse(doc, {
    headers: {
        'cache-control': 'public, max-age=3600, immutable',
        etag: `"invoice-${id}-${String(invoice.updatedAt)}"`,
    },
});
```

`headers` is merged last, so it overrides the defaults — including
`content-type` if you really mean to.
