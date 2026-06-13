/**
 * Client hook sample — live PDF preview with `usePdf`.
 *
 * This is a browser/React component (not a standalone script): it renders a
 * document to a blob URL on the client and previews it in an <iframe>, with a
 * button to regenerate. Drop it into any React 19 app.
 */

'use client';

import React from 'react';
import { Document, Heading, Paragraph, usePdf } from '../../src/index.js';

export function Invoice({ customer }: { readonly customer: string }) {
    const { url, loading, error, update } = usePdf(
        <Document title="Invoice">
            <Heading level={1}>Invoice</Heading>
            <Paragraph>{`Billed to: ${customer}`}</Paragraph>
        </Document>,
    );

    if (error) return <p role="alert">{error.message}</p>;

    return (
        <div>
            <button type="button" onClick={update} disabled={loading}>
                {loading ? 'Rendering…' : 'Regenerate'}
            </button>
            {url ? <iframe title="Invoice preview" src={url} width={640} height={480} /> : null}
        </div>
    );
}
