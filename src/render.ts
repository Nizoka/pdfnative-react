/**
 * Render entry points: turn a React element into PDF output.
 *
 * Every function reconciles the tree once (via {@link compile}) and then hands
 * the resulting `DocumentParams` to the `pdfnative` engine. Layout and font
 * options provided here are merged on top of anything set on `<Document>`.
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import {
    buildDocumentPDFBytes,
    buildDocumentPDFStreamTrue,
    inspectDocumentLayout,
    streamToFile,
    validateDocumentStreamable,
} from './core-bridge/index.js';
import { optionsWithFonts } from './fonts.js';
import { compile } from './reconciler/render.js';
import type {
    DocumentParams,
    LayoutInspection,
    PdfLayoutOptions,
    RenderOptions,
    StreamToFileResult,
} from './types.js';

/** Reconcile a React tree into the `pdfnative` document model (no rendering). */
export function compileDocument(node: ReactNode): DocumentParams {
    return compile(node);
}

function prepare(
    node: ReactNode,
    options?: RenderOptions,
): { params: DocumentParams; layout: Partial<PdfLayoutOptions> | undefined } {
    const compiled = compile(node);

    const params: DocumentParams =
        options?.fontEntries && options.fontEntries.length > 0
            ? {
                  ...compiled,
                  fontEntries: [...(compiled.fontEntries ?? []), ...options.fontEntries],
              }
            : compiled;

    const layout =
        options?.layout || params.layout
            ? { ...params.layout, ...options?.layout }
            : undefined;

    return { params, layout };
}

/** Render to raw PDF bytes (`Uint8Array`). Works in Node and the browser. */
export function renderToBytes(node: ReactNode, options?: RenderOptions): Uint8Array {
    const { params, layout } = prepare(node, options);
    return buildDocumentPDFBytes(params, layout);
}

/** Render to a `Blob` (`application/pdf`) — ideal for browser download/preview. */
export function renderToBlob(node: ReactNode, options?: RenderOptions): Blob {
    const bytes = renderToBytes(node, options);
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/**
 * Render to a true, page-by-page async byte stream — constant-memory output for
 * very large documents.
 *
 * The engine's streaming path does not support `<TableOfContents>` blocks or
 * `{pages}` in header/footer templates (both need the final page count before
 * the first page is emitted). That check is run **eagerly here**, so an
 * unstreamable document throws at call time — before a single byte is
 * produced, and in particular before `renderToResponse` has handed a
 * `Response` to the framework. Use the buffered entry points for those
 * documents.
 */
export function renderToStream(
    node: ReactNode,
    options?: RenderOptions,
): AsyncGenerator<Uint8Array> {
    const { params, layout } = prepare(node, options);
    // The engine runs this inside the generator, i.e. at first pull — too late
    // for a streaming HTTP response. Fail fast instead.
    validateDocumentStreamable(params, layout);
    return buildDocumentPDFStreamTrue(params, layout);
}

/**
 * Report how a document lays out — page count, margins, and the position/size
 * of every block — without rendering any PDF bytes. Deterministic and
 * read-only; ideal for tests, tooling, and layout debugging (pair with
 * `layout.debug` for a visual overlay).
 */
export function inspectDocument(node: ReactNode, options?: RenderOptions): LayoutInspection {
    const { params, layout } = prepare(node, options);
    return inspectDocumentLayout(params, layout);
}

/**
 * Render and write the PDF to a file. Node.js only.
 *
 * Buffers the whole document in memory before writing. For very large
 * documents, prefer {@link renderToFileStream}, which writes page by page
 * with constant memory.
 *
 * @param node - A React element whose root is `<Document>`.
 * @param path - Destination file path.
 * @param options - Optional layout/font overrides.
 */
export async function renderToFile(
    node: ReactNode,
    path: string,
    options?: RenderOptions,
): Promise<void> {
    const bytes = renderToBytes(node, await optionsWithFonts(options));
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, bytes);
}

/**
 * Stream the PDF to a file with constant memory. Node.js only.
 *
 * Pages are generated and flushed incrementally with back-pressure, so peak
 * memory stays flat regardless of document size. Outline/bookmarks and page
 * labels are preserved; the two features the engine's streaming path cannot
 * provide — `<TableOfContents>` and `{pages}` in header/footer templates —
 * are rejected eagerly (see {@link renderToStream}). For those documents use
 * {@link renderToFile}.
 *
 * @param node - A React element whose root is `<Document>`.
 * @param path - Destination file path.
 * @param options - Optional layout/font overrides.
 * @returns Bytes written and page count.
 */
export async function renderToFileStream(
    node: ReactNode,
    path: string,
    options?: RenderOptions,
): Promise<StreamToFileResult> {
    const stream = renderToStream(node, await optionsWithFonts(options));
    return streamToFile(stream, path);
}
