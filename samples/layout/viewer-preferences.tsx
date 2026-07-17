/**
 * Viewer preferences sample — control how a PDF reader opens the document.
 *
 * Run with: npx tsx samples/layout/viewer-preferences.tsx
 * Writes `viewer-preferences.pdf` to the current directory.
 */

import React from 'react';
import { Document, Heading, Paragraph, renderToFile } from '../../src/index.js';

const doc = (
    <Document
        title="Viewer preferences"
        outline="auto"
        layout={{
            viewerPreferences: {
                pageMode: 'useOutlines', // open with the bookmarks panel visible
                pageLayout: 'oneColumn',
                displayDocTitle: true, // window title shows the document title
                hideToolbar: true,
            },
        }}
    >
        <Heading level={1}>Reader behavior</Heading>
        <Paragraph>
            This document asks the viewer to open with its bookmark panel shown,
            scroll in a single column, display the document title in the window
            bar, and hide the toolbar.
        </Paragraph>
    </Document>
);

await renderToFile(doc, 'viewer-preferences.pdf');
console.log('Wrote viewer-preferences.pdf');
