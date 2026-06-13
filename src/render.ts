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
} from './core-bridge/index.js';
import { compile } from './reconciler/render.js';
import type { DocumentParams, PdfLayoutOptions, RenderOptions } from './types.js';

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
 */
export function renderToStream(
    node: ReactNode,
    options?: RenderOptions,
): AsyncGenerator<Uint8Array> {
    const { params, layout } = prepare(node, options);
    return buildDocumentPDFStreamTrue(params, layout);
}

/**
 * Render and write the PDF to a file. Node.js only.
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
    const bytes = renderToBytes(node, options);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, bytes);
}
