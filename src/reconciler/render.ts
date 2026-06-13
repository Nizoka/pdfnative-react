/**
 * Compile a React element into a `pdfnative` `DocumentParams` object.
 *
 * The reconciler renders synchronously into an in-memory container; we then
 * serialize that container. No DOM, no async, no side effects.
 */

import type { ReactNode } from 'react';
import type { DocumentParams } from '../types.js';
import { reconciler } from './host-config.js';
import type { RootContainer } from './nodes.js';
import { serialize } from './serialize.js';

const LegacyRoot = 0;

function noop(): void {
    /* intentional no-op */
}

function onError(error: unknown): void {
    // Surface reconciler-level errors instead of swallowing them.
    throw error instanceof Error ? error : new Error(String(error));
}

/**
 * Reconcile `element` and return the compiled document model.
 *
 * @param element - A React element whose root is `<Document>`.
 * @returns The `DocumentParams` consumed by the pdfnative engine.
 */
export function compile(element: ReactNode): DocumentParams {
    const container: RootContainer = { children: [] };

    const root = reconciler.createContainer(
        container,
        LegacyRoot,
        null,
        false,
        null,
        'pdfnative',
        onError,
        onError,
        onError,
        noop,
        null,
    );

    // react-reconciler renamed the synchronous flush API across 0.29 → 0.31.
    // Prefer the current `updateContainerSync` + `flushSyncWork` pair and fall
    // back to the legacy `flushSync(fn)` wrapper when running on older runtimes.
    const r = reconciler as typeof reconciler & {
        updateContainerSync?: (
            element: ReactNode,
            root: ReturnType<typeof reconciler.createContainer>,
            parent: unknown,
            callback: (() => void) | null,
        ) => void;
        flushSyncWork?: () => void;
    };

    const commit = (next: ReactNode): void => {
        if (typeof r.updateContainerSync === 'function') {
            r.updateContainerSync(next, root, null, noop);
            r.flushSyncWork?.();
        } else {
            reconciler.flushSync(() => {
                reconciler.updateContainer(next, root, null, noop);
            });
        }
    };

    commit(element);

    const params = serialize(container);

    // Tear down to release retained fibers.
    commit(null);

    return params;
}
