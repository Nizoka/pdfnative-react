'use client';

/**
 * Client entry point — `pdfnative-react/client`.
 *
 * The published root bundle is a single file, so a `'use client'` directive in
 * `hooks.ts` or `viewer.tsx` does not survive bundling. This entry does: it is
 * built separately with the directive as a banner, which is what a React Server
 * Components app needs in order to import a preview or download component
 * without a hand-written wrapper.
 *
 * ```tsx
 * import { PDFViewer, usePdf } from 'pdfnative-react/client';
 * ```
 *
 * Everything here is also exported from the root barrel, so this is an addition
 * rather than a move — existing imports keep working. Prefer this path in an
 * App Router project; prefer the root for server code (`renderToResponse`,
 * `renderToBytes`, `renderToFile`), which must *not* be marked client.
 *
 * @packageDocumentation
 */

export { usePdf, usePdfStream } from './hooks.js';
export type { UsePdfResult, UsePdfStreamResult } from './hooks.js';

export { PDFViewer, BlobProvider, PDFDownloadLink } from './viewer.js';
export type {
    PDFViewerProps,
    BlobProviderProps,
    PDFDownloadLinkProps,
    PdfRenderState,
} from './viewer.js';

// Re-exported so a client-only module does not need a second import from the
// root just to type its render options.
export type { RenderOptions, FontsMap, FontLoader } from './types.js';
