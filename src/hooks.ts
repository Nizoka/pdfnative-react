'use client';

/**
 * React hooks for rendering PDFs on the client.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { renderToBytes, renderToStream } from './render.js';
import type { RenderOptions } from './types.js';

/** State returned by {@link usePdf}. */
export interface UsePdfResult {
    /** Object URL pointing at the rendered PDF blob (revoked automatically). */
    readonly url: string | null;
    /** The rendered PDF as a `Blob` (`application/pdf`). */
    readonly blob: Blob | null;
    /** The rendered PDF bytes. */
    readonly bytes: Uint8Array | null;
    /** `true` while the first render is in flight. */
    readonly loading: boolean;
    /** Any error thrown during reconciliation or rendering. */
    readonly error: Error | null;
    /** Force a re-render (e.g. after changing render options). */
    readonly update: () => void;
}

interface PdfState {
    url: string | null;
    blob: Blob | null;
    bytes: Uint8Array | null;
    loading: boolean;
    error: Error | null;
}

const INITIAL: PdfState = {
    url: null,
    blob: null,
    bytes: null,
    loading: true,
    error: null,
};

/**
 * Render a React element to a PDF and expose it as bytes, a `Blob`, and an
 * object URL. Re-renders whenever `element` changes or {@link UsePdfResult.update}
 * is called.
 *
 * @param element - A React element whose root is `<Document>`.
 * @param options - Optional layout/font overrides (read on each render).
 */
export function usePdf(element: ReactNode, options?: RenderOptions): UsePdfResult {
    const [state, setState] = useState<PdfState>(INITIAL);
    const [nonce, setNonce] = useState(0);

    const optionsRef = useRef(options);
    optionsRef.current = options;

    const update = useCallback(() => {
        setNonce((n) => n + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let url: string | null = null;

        setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));

        // Defer the render out of the commit phase. `renderToBytes` drives a
        // *separate* React reconciler; running it synchronously inside this
        // effect would re-enter React's work loop and deadlock. A microtask
        // lets the host renderer finish committing first.
        queueMicrotask(() => {
            if (cancelled) return;
            try {
                const bytes = renderToBytes(element, optionsRef.current);
                const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
                url = URL.createObjectURL(blob);
                setState({ url, blob, bytes, loading: false, error: null });
            } catch (err) {
                setState({
                    url: null,
                    blob: null,
                    bytes: null,
                    loading: false,
                    error: err instanceof Error ? err : new Error(String(err)),
                });
            }
        });

        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [element, nonce]);

    return { ...state, update };
}

/** State returned by {@link usePdfStream}. */
export interface UsePdfStreamResult {
    /**
     * Create a fresh true-streaming async generator of PDF byte chunks.
     * Each call starts a new render, so iterate the returned generator once.
     */
    readonly getStream: () => AsyncGenerator<Uint8Array>;
}

/**
 * Expose a stable factory that produces a constant-memory PDF byte stream for
 * the given element. Useful for piping very large documents to the network.
 */
export function usePdfStream(
    element: ReactNode,
    options?: RenderOptions,
): UsePdfStreamResult {
    const elementRef = useRef(element);
    elementRef.current = element;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const getStream = useCallback(
        () => renderToStream(elementRef.current, optionsRef.current),
        [],
    );

    return { getStream };
}
