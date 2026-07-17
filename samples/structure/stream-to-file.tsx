/**
 * Constant-memory streaming sample — `renderToFileStream` writes a large
 * document page by page without buffering the whole PDF in memory.
 *
 * Run with: npx tsx samples/structure/stream-to-file.tsx
 * Writes `stream-to-file.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Paragraph,
    renderToFileStream,
} from '../../src/index.js';

// A few hundred sections — enough to span many pages.
const sections = Array.from({ length: 300 }, (_, i) => (
    <React.Fragment key={i}>
        <Heading level={2}>{`Section ${i + 1}`}</Heading>
        <Paragraph>
            {`Streamed content for section ${i + 1}. Pages are flushed to disk `
            + 'incrementally, so peak memory stays flat regardless of length.'}
        </Paragraph>
    </React.Fragment>
));

const doc = (
    <Document title="Streamed report" outline="auto">
        <Heading level={1}>Large streamed document</Heading>
        {sections}
    </Document>
);

const result = await renderToFileStream(doc, 'stream-to-file.pdf');
console.log(`Wrote ${result.path} — ${result.bytesWritten} bytes (constant memory)`);
