'use client';

/**
 * Client components for previewing and downloading rendered PDFs.
 *
 * These mirror the ergonomics of `@react-pdf/renderer` (`<PDFViewer>`,
 * `<PDFDownloadLink>`, `<BlobProvider>`) to ease migration.
 *
 * @packageDocumentation
 */

import {
    createElement,
    type CSSProperties,
    type ReactElement,
    type ReactNode,
} from 'react';
import { usePdf, type UsePdfResult } from './hooks.js';
import type { RenderOptions } from './types.js';

/** The render-state handed to function-as-children consumers. */
export interface PdfRenderState {
    readonly url: string | null;
    readonly blob: Blob | null;
    readonly bytes: Uint8Array | null;
    readonly loading: boolean;
    readonly error: Error | null;
}

function toState(result: UsePdfResult): PdfRenderState {
    return {
        url: result.url,
        blob: result.blob,
        bytes: result.bytes,
        loading: result.loading,
        error: result.error,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFViewer
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link PDFViewer}. */
export interface PDFViewerProps {
    /** The document tree to render (root `<Document>`). */
    readonly document: ReactNode;
    /** Layout/font overrides. */
    readonly options?: RenderOptions;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly width?: string | number;
    readonly height?: string | number;
    readonly title?: string;
}

/** Live in-browser PDF preview rendered into an `<iframe>`. */
export function PDFViewer(props: PDFViewerProps): ReactElement {
    const { document, options, title = 'PDF preview', ...rest } = props;
    const { url } = usePdf(document, options);
    return createElement('iframe', {
        ...rest,
        title,
        src: url ?? undefined,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// BlobProvider
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link BlobProvider}. */
export interface BlobProviderProps {
    /** The document tree to render (root `<Document>`). */
    readonly document: ReactNode;
    /** Layout/font overrides. */
    readonly options?: RenderOptions;
    /** Function-as-children receiving the current render state. */
    readonly children: (state: PdfRenderState) => ReactNode;
}

/** Render-prop component exposing the rendered `Blob`/URL and status. */
export function BlobProvider(props: BlobProviderProps): ReactElement {
    const result = usePdf(props.document, props.options);
    return createElement(
        'div',
        { style: { display: 'contents' } },
        props.children(toState(result)),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFDownloadLink
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link PDFDownloadLink}. */
export interface PDFDownloadLinkProps {
    /** The document tree to render (root `<Document>`). */
    readonly document: ReactNode;
    /** Suggested download file name. Default: `'document.pdf'`. */
    readonly fileName?: string;
    /** Layout/font overrides. */
    readonly options?: RenderOptions;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Link content, or a function receiving the current render state. */
    readonly children: ReactNode | ((state: PdfRenderState) => ReactNode);
}

/** An anchor that downloads the rendered PDF. */
export function PDFDownloadLink(props: PDFDownloadLinkProps): ReactElement {
    const { document, fileName = 'document.pdf', options, children, ...rest } = props;
    const result = usePdf(document, options);
    const content =
        typeof children === 'function' ? children(toState(result)) : children;

    return createElement(
        'a',
        {
            ...rest,
            href: result.url ?? undefined,
            download: fileName,
        },
        content,
    );
}
