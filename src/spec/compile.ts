/**
 * Compile a compact {@link DocSpec} into PDF output.
 *
 * The spec is projected onto the **existing** JSX components (so the spec and
 * component surfaces can never drift), then handed to the normal render
 * pipeline. Everything here is pure and isomorphic — the same code path as
 * authoring with `<Document>` by hand, just far cheaper to express.
 *
 * @packageDocumentation
 */

import { createElement, type ReactElement, type ReactNode } from 'react';
import {
    Barcode,
    Document,
    FormField,
    Heading,
    Image,
    Link,
    List,
    Page,
    PageBreak,
    Paragraph,
    Spacer,
    Svg,
    Table,
    TableOfContents,
    type SpacerProps,
    type TableOfContentsProps,
} from '../components.js';
import {
    compileDocument,
    renderToBlob,
    renderToBytes,
    renderToFile,
    renderToStream,
} from '../render.js';
import { PdfStructureError } from '../reconciler/serialize.js';
import type { DocumentParams, PdfRow, RenderOptions } from '../types.js';
import type { BlockSpec, DocSpec, TableRowSpec } from './types.js';

function toRows(rows: readonly TableRowSpec[]): PdfRow[] {
    return rows.map((row) =>
        Array.isArray(row)
            ? { cells: row as readonly string[], type: 'default', pointed: false }
            : (row as PdfRow),
    );
}

/** Project a single {@link BlockSpec} tuple onto its component element. */
function blockToElement(block: BlockSpec, key: number): ReactElement {
    switch (block[0]) {
        case 'h1':
            return createElement(Heading, { key, level: 1, ...block[2] }, block[1]);
        case 'h2':
            return createElement(Heading, { key, level: 2, ...block[2] }, block[1]);
        case 'h3':
            return createElement(Heading, { key, level: 3, ...block[2] }, block[1]);
        case 'p':
            return createElement(Paragraph, { key, ...block[2] }, block[1]);
        case 'ul':
            return createElement(List, { key, items: block[1], ...block[2] });
        case 'ol':
            return createElement(List, { key, ordered: true, items: block[1], ...block[2] });
        case 'table':
            return createElement(Table, {
                key,
                headers: block[1].h,
                rows: toRows(block[1].r),
                columns: block[1].columns,
                zebra: block[1].zebra,
                caption: block[1].caption,
                clipCells: block[1].clipCells,
                autoFitColumns: block[1].autoFitColumns,
                wrap: block[1].wrap,
                repeatHeader: block[1].repeatHeader,
                minRowHeight: block[1].minRowHeight,
                cellPadding: block[1].cellPadding,
            });
        case 'img':
            return createElement(Image, { key, ...block[1] });
        case 'link':
            return createElement(Link, { key, ...block[2] }, block[1]);
        case 'sp':
            return createElement<SpacerProps>(Spacer, { key, height: block[1] });
        case 'br':
            return createElement(PageBreak, { key });
        case 'page':
            return createElement(Page, { key }, block[1].map(blockToElement));
        case 'toc':
            return createElement<TableOfContentsProps>(TableOfContents, { key, ...block[1] });
        case 'qr':
        case 'code128':
        case 'ean13':
        case 'pdf417':
        case 'datamatrix':
            return createElement(Barcode, {
                key,
                format: block[0],
                data: block[1],
                ...block[2],
            });
        case 'svg':
            return createElement(Svg, { key, data: block[1], ...block[2] });
        case 'field':
            return createElement(FormField, { key, ...block[1] });
        default: {
            const kind: never = block[0];
            throw new PdfStructureError(`Unknown DocSpec block kind: ${String(kind)}`);
        }
    }
}

/**
 * Turn a compact {@link DocSpec} into a `<Document>` React element. Useful for
 * embedding a spec-authored document inside a larger JSX tree, or for passing to
 * the hooks/viewer components.
 */
export function specToElement(spec: DocSpec): ReactElement {
    const children: ReactNode = spec.blocks.map(blockToElement);
    return createElement(
        Document,
        {
            title: spec.title,
            footerText: spec.footerText,
            metadata: spec.metadata,
            fontEntries: spec.fontEntries,
            layout: spec.layout,
        },
        children,
    );
}

/** Compile a {@link DocSpec} into the `pdfnative` document model (no rendering). */
export function compileSpec(spec: DocSpec): DocumentParams {
    return compileDocument(specToElement(spec));
}

/** Render a {@link DocSpec} to raw PDF bytes (`Uint8Array`). */
export function renderSpecToBytes(spec: DocSpec, options?: RenderOptions): Uint8Array {
    return renderToBytes(specToElement(spec), options);
}

/** Render a {@link DocSpec} to a `Blob` (`application/pdf`). */
export function renderSpecToBlob(spec: DocSpec, options?: RenderOptions): Blob {
    return renderToBlob(specToElement(spec), options);
}

/** Render a {@link DocSpec} to a constant-memory async byte stream. */
export function renderSpecToStream(
    spec: DocSpec,
    options?: RenderOptions,
): AsyncGenerator<Uint8Array> {
    return renderToStream(specToElement(spec), options);
}

/** Render a {@link DocSpec} and write the PDF to a file. Node.js only. */
export function renderSpecToFile(
    spec: DocSpec,
    path: string,
    options?: RenderOptions,
): Promise<void> {
    return renderToFile(specToElement(spec), path, options);
}
