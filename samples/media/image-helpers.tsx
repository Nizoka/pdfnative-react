/**
 * Image source helpers — `fromBase64` and `fromUrl` produce the bytes that
 * `<Image data>` expects.
 *
 * Run with: npx tsx samples/media/image-helpers.tsx
 * Writes `image-helpers.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Image,
    Paragraph,
    fromBase64,
    fromUrl,
    renderToFile,
} from '../../src/index.js';

// A 1×1 red RGB PNG (no alpha) as a data URI — decoded with fromBase64
// (offline, deterministic).
const redDot =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4o6YGAAMKASng8MlTAAAAAElFTkSuQmCC';
const inline = fromBase64(redDot);

// Optionally fetch a remote image; skipped gracefully when offline.
let remote: Uint8Array | null = null;
try {
    remote = await fromUrl('https://raw.githubusercontent.com/Nizoka/pdfnative/main/docs/favicon.png');
} catch {
    console.warn('fromUrl skipped (offline or unreachable).');
}

const doc = (
    <Document title="Image helpers">
        <Heading level={1}>From base64</Heading>
        <Paragraph>A 1×1 PNG decoded inline with `fromBase64`:</Paragraph>
        <Image data={inline} width={24} height={24} alt="red dot" />
        {remote && (
            <>
                <Heading level={1}>From URL</Heading>
                <Image data={remote} width={48} alt="fetched logo" />
            </>
        )}
    </Document>
);

await renderToFile(doc, 'image-helpers.pdf');
console.log('Wrote image-helpers.pdf');
