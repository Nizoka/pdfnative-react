/**
 * JPEG 2000 images — `<Image>` and `watermark.image` take JP2 and J2K bytes
 * (engine 1.9.0).
 *
 * Run with: npx tsx samples/media/image-jpx.tsx
 * Writes `image-jpx.pdf` to the current directory.
 *
 * The engine passes JPEG 2000 through as `/JPXDecode` — it never decodes it,
 * exactly as it embeds the DCT data of a JPEG — and the file header moves to
 * PDF 1.5. The format is detected from the magic bytes: a JP2 file (the
 * `jP  ` signature box) or a raw J2K codestream (`SOC` + `SIZ`). The two
 * fixtures below are minimal, valid codestreams that decode to a flat mid
 * grey — the same construction the engine's own `images/*` samples use — so
 * that the sample needs no binary file; in a real app the bytes come from
 * disk, a fetch response (`fromUrl`) or an upload.
 *
 * Under PDF/A the claim's rules apply: PDF/A-1 has no JPXDecode filter at
 * all, PDF/A-2 and later take 1, 3 or 4 colour channels and no opacity
 * channel. The lint rule `L_PDFA_JPX_IMAGE` says so before the engine's
 * `PDFA1_JPX_IMAGE` / `PDFA_JPX_IMAGE` diagnostics do (a throw under
 * `layout.strict`).
 */

import React from 'react';
import { Document, Heading, Image, Paragraph, lintDocument, renderToFile } from '../../src/index.js';
import { makeMinimalJ2K, makeMinimalJP2 } from '../../scripts/lib/jpx-fixture.js';

const rgbJp2 = makeMinimalJP2(3, { size: 16 }); // sRGB, declared by the colr box
const greyJ2k = makeMinimalJ2K(1, 16); // a raw codestream: one component, DeviceGray

const doc = (
    <Document
        title="JPEG 2000"
        watermark={{ image: { data: makeMinimalJP2(1, { size: 8 }), width: 240, opacity: 0.1 } }}
    >
        <Heading level={1}>JPEG 2000 pass-through</Heading>
        <Paragraph>A JP2 file (sRGB) and a raw J2K codestream (grey), both embedded as /JPXDecode:</Paragraph>
        <Image data={rgbJp2} width={96} height={96} alt="A flat mid-grey square from an sRGB JP2 file" />
        <Image data={greyJ2k} width={96} height={96} align="center" alt="A flat mid-grey square from a raw J2K codestream" />
        <Paragraph>The watermark behind this page is a JPEG 2000 image too.</Paragraph>
    </Document>
);

// Under PDF/A-1 the same images would be refused — the lint rule says so first.
const underPdfA1 = lintDocument(
    <Document title="JPEG 2000 under PDF/A-1" tagged="pdfa1b">
        <Image data={rgbJp2} width={96} height={96} alt="Refused under PDF/A-1" />
    </Document>,
);
console.log(`Under tagged="pdfa1b": ${underPdfA1.findings.filter((f) => f.code === 'L_PDFA_JPX_IMAGE').map((f) => f.message).join('')}`);

await renderToFile(doc, 'image-jpx.pdf');
console.log('Wrote image-jpx.pdf');
