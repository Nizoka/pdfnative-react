/**
 * Client component sample — PDFViewer, PDFDownloadLink, BlobProvider.
 *
 * Browser/React component module (not a standalone script). Mirrors the
 * familiar `@react-pdf/renderer` ergonomics.
 */

'use client';

import React from 'react';
import {
    BlobProvider,
    Document,
    Heading,
    PDFDownloadLink,
    PDFViewer,
    Paragraph,
} from '../../src/index.js';

const report = (
    <Document title="Report">
        <Heading level={1}>Quarterly report</Heading>
        <Paragraph>Generated entirely on the client.</Paragraph>
    </Document>
);

export function ReportPage() {
    return (
        <div>
            {/* Live preview */}
            <PDFViewer document={report} width={640} height={480} />

            {/* One-click download */}
            <PDFDownloadLink document={report} fileName="report.pdf">
                {({ loading }) => (loading ? 'Preparing…' : 'Download report')}
            </PDFDownloadLink>

            {/* Raw blob access (e.g. to upload) */}
            <BlobProvider document={report}>
                {({ blob, loading }) => (
                    <span>{loading ? 'Building…' : `${blob ? blob.size : 0} bytes ready`}</span>
                )}
            </BlobProvider>
        </div>
    );
}
