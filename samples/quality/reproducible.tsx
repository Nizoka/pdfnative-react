/**
 * Reproducible output — the same bytes on every host, from a pinned instant.
 *
 * Run with: npx tsx samples/quality/reproducible.tsx
 * Writes `reproducible.pdf` to the current directory and prints the SHA-256
 * of two renders.
 *
 * Unencrypted pdfnative output is a pure function of its inputs plus one
 * date: /CreationDate, /ModDate, the XMP dates, the `{date}` placeholder and
 * therefore the trailer /ID all derive from the creation instant, and since
 * engine 1.8.0 every date is written in UTC (`+00'00'`) whatever the host
 * zone. Pin the instant and the bytes repeat — on Linux, Windows and macOS,
 * which is what this repository's CI proves on its own sample set.
 *
 * Three ways to pin, highest precedence first:
 *   1. `<Document creationDate>` / `DocSpec.creationDate` — per document;
 *   2. `setDefaultCreationDate(date)` — process-wide (null restores the clock);
 *   3. nothing — the wall clock, the historical behaviour.
 * The library reads no environment variable: a build pipeline that exports
 * `SOURCE_DATE_EPOCH` pins it explicitly, as the last block shows.
 *
 * Not covered by design: `layout.encryption` (a fresh file key, salts and IVs
 * on every build — ISO 32000-1 §7.6) and anything done to the bytes afterwards.
 */

import React from 'react';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
    Document,
    Heading,
    Paragraph,
    getDefaultCreationDate,
    renderToBytes,
    setDefaultCreationDate,
} from '../../src/index.js';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const PINNED = new Date('2026-01-01T00:00:00Z');

const doc = (
    <Document
        title="Reproducible"
        creationDate={PINNED} // 1. per document — an ISO string works too, in JSX and in a DocSpec
        header={{ right: 'Built {date}' }} // follows the pin: 2026-01-01
    >
        <Heading level={1}>Reproducible output</Heading>
        <Paragraph>Same inputs, same instant, same bytes — on every host.</Paragraph>
    </Document>
);

const first = renderToBytes(doc);
const second = renderToBytes(doc);
await writeFile('reproducible.pdf', first);
console.log('Wrote reproducible.pdf');
console.log(`render 1: ${sha256(first)}`);
console.log(`render 2: ${sha256(second)}  (${sha256(first) === sha256(second) ? 'identical' : 'DIFFERENT'})`);

// 2. Process-wide: every document without its own creationDate takes the pin.
setDefaultCreationDate(PINNED);
const viaDefault = renderToBytes(
    <Document title="Reproducible" header={{ right: 'Built {date}' }}>
        <Heading level={1}>Reproducible output</Heading>
        <Paragraph>Same inputs, same instant, same bytes — on every host.</Paragraph>
    </Document>,
);
console.log(`via setDefaultCreationDate: ${sha256(viaDefault)}  (${sha256(viaDefault) === sha256(first) ? 'same as the prop' : 'DIFFERENT'})`);
console.log(`pinned instant: ${getDefaultCreationDate()?.toISOString() ?? 'none'}`);
setDefaultCreationDate(null); // back to the wall clock

// 3. A build pipeline's SOURCE_DATE_EPOCH, applied explicitly by the caller —
//    the library itself never reads the environment.
const epoch = process.env['SOURCE_DATE_EPOCH'];
if (epoch !== undefined && /^\d{1,12}$/.test(epoch)) {
    setDefaultCreationDate(new Date(Number(epoch) * 1000));
    console.log(`SOURCE_DATE_EPOCH honoured by this sample: ${new Date(Number(epoch) * 1000).toISOString()}`);
    setDefaultCreationDate(null);
}

const text = new TextDecoder('latin1').decode(first);
console.log(`/CreationDate in the file: ${/\/CreationDate \(([^)]*)\)/.exec(text)?.[1] ?? 'not found'} (UTC, whatever TZ says)`);
