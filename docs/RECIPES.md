# Recipes — working with the bytes

pdfnative-react is an **authoring** library. It turns a component tree into PDF
bytes and stops there. Everything that operates on *existing* PDF bytes —
merging, splitting, filling forms, extracting text, decrypting, signing,
annotating — belongs to the [`pdfnative`](https://www.npmjs.com/package/pdfnative)
engine, which you already have installed as a peer dependency.

This page shows how to do those things. There is no new API to learn here and
nothing to install: you import from `pdfnative` directly and hand it the
`Uint8Array` this library produced.

## Why the boundary exists

It would be easy to re-export the engine's post-processing functions from this
package. We deliberately do not, for three reasons:

1. **A wrapper that re-exports is a wrapper you must maintain forever.** Every
   engine signature change becomes a breaking change here, and every engine
   feature becomes a release we owe you.
2. **It would lie about what the package is.** `pdfnative-react` is a React
   renderer. `extractText` has nothing to do with React.
3. **You do not need us in the middle.** `pdfnative` is a zero-dependency
   package with a stable API. Calling it directly is one import line, and you
   get its documentation, its types and its release notes unfiltered.

The rule is stated as golden rule 7 in [AGENTS.md](../AGENTS.md).

## Setup

Every recipe assumes:

```ts
import { renderToBytes } from 'pdfnative-react';

const bytes = renderToBytes(<Invoice />);   // authored here
```

…and then imports the operation from the engine.

## Extract text (RAG, search, verification)

New in engine 1.6.0. Decodes content streams into per-page reading-order text,
resolving `/ToUnicode` CMaps, `/Encoding /Differences`, and WinAnsi/MacRoman
tables. Works on encrypted documents via `options.password`.

```ts
import { extractText } from 'pdfnative';

const pages = extractText(bytes);
for (const page of pages) {
    console.log(`--- page ${String(page.pageIndex + 1)} ---`);
    console.log(page.text);
}

// Positioned runs, for layout-aware indexing:
const [first] = extractText(bytes, { pages: [0], includeRuns: true });
for (const run of first.runs ?? []) {
    console.log(run.text, run.x, run.y, run.fontSize);
}
```

A `maxTextLength` cap (16 M characters by default) keeps this safe on untrusted
input. Since engine 1.8.0, extraction honours `/ActualText`, so text shaped for
Indic, Khmer, Myanmar or Tai Tham scripts under `tagged` output round-trips as
its **source** code points rather than as glyph order; since 1.9.0 the same
holds for right-to-left runs and every untagged shaped run.

### An undecodable stream: `onStreamError` and `PdfStreamLimitError`

Since engine 1.9.0 a stream that cannot be decoded is reported, not silently
dropped. `extractText(bytes, { onStreamError })` takes `'limit'` (the
default: a stream whose inflated size would exceed the cap throws
`PdfStreamLimitError`, since an over-cap stream is the one case where a page
without its text hides an attack rather than a defect), `'throw'` (any
undecodable stream — a corrupt Flate stream, an unsupported filter) or
`'skip'` (the pre-1.9.0 lenience: the page comes back without that stream's
text).

```ts
import { extractText, PdfStreamLimitError, setMaxInflateOutputSize } from 'pdfnative';

try {
    const pages = extractText(untrustedBytes);                   // onStreamError: 'limit' by default
} catch (err) {
    if (err instanceof PdfStreamLimitError && err.code === 'PDF_STREAM_LIMIT') {
        console.warn(`${err.filter} output over ${String(err.limit)} bytes — not read`);
        // A trusted document: raise the FlateDecode cap, or read the rest with 'skip'.
        const partial = extractText(untrustedBytes, { onStreamError: 'skip' });
    } else throw err;
}
```

Classify by `code`, never by the message: the message names the remedy that
applies to the filter (`setMaxInflateOutputSize()` for FlateDecode, `'skip'`
for the fixed cap of the other decode filters) and may be reworded. The
`code` is an engine contract; this package has no error code for it because
nothing it authors is ever decoded — the bytes under test already exist.

**Useful as a test assertion.** Extraction is the honest way to check that text
really rendered, rather than falling back to `.notdef` boxes:

```ts
const text = extractText(renderToBytes(<Report />))[0].text;
expect(text).not.toContain('?');   // catches a missing font
expect(text).toContain('Total due');
```

## Fill and flatten an AcroForm

New in engine 1.6.0. `<FormField>` authors the widgets; these read and fill
them back. The update is incremental and non-destructive, so prior signatures
stay valid for their revision.

```ts
import { readFormFields, fillForm, flattenForm } from 'pdfnative';

const form = renderToBytes(<ApplicationForm />);

for (const field of readFormFields(form)) {
    console.log(field.name, field.type, field.value);
}

const filled = fillForm(form, {
    'applicant.email': 'user@example.com',
    'applicant.consent': true,
    'applicant.country': ['FR'],
});

// Stamp the appearances into the page content and drop the interactive layer.
const frozen = flattenForm(filled);
```

Typed failures — `FormFieldNotFoundError`, `FormValueTypeError`,
`FormUnsupportedError` — each carry a `code`.

## Merge, split, extract pages

```ts
import { mergePdfs, splitPdf, extractPages } from 'pdfnative';

const merged = mergePdfs([coverBytes, bodyBytes, appendixBytes]);
const [firstHalf, secondHalf] = splitPdf(merged, [{ start: 0, end: 9 }, { start: 10, end: 19 }]);
const summary = extractPages(merged, [0, 1, 2]);
```

Up to 50 source documents per merge. For large inputs, the streaming variants
hold only the cross-reference offsets in memory and compose with `streamToFile`:

```ts
import { streamMergedPdfs, streamToFile } from 'pdfnative';

await streamToFile(streamMergedPdfs([a, b, c], { chunkSize: 64 * 1024 }), 'out.pdf');
```

## Encrypt, decrypt, rotate passwords

Authoring-side encryption is a layout option, so it stays in this package:

```tsx
<Document layout={{ encryption: { ownerPassword: 'owner', algorithm: 'aes256' } }}>
```

Note that PDF/A forbids encryption (ISO 19005-1 §6.3.2) —
`lintDocument` reports `L_TAGGED_ENCRYPTED` if you combine them, and the engine
throws if you get past the linter.

> **Re-render anything you encrypted on an engine older than 1.6.0.** Two engine
> fixes land with the `^1.6.0` peer floor and both affect files this package
> produced. Strings — outline titles, `<Link url>` targets, `metadata` — were
> previously left *unencrypted* inside an encrypted document, so a
> `outline="auto"` document disclosed its section headings without the password.
> And AES-256 (R6) output was not ISO 32000-2 compliant, so strict readers could
> not open it. See the Security section of the [CHANGELOG](../CHANGELOG.md).

Reading and re-securing an *existing* document is the engine's job:

```ts
import { openPdf, mergePdfs } from 'pdfnative';

const reader = openPdf(protectedBytes, { password: 'user-password' });
console.log(reader.encryption);   // { algorithm: 'aes256', revision: 6, authenticatedAs: 'user' }

// Open with the old password, re-secure with a new one, in a single call.
const rotated = mergePdfs([{ bytes: protectedBytes, password: 'old' }], {
    encrypt: { ownerPassword: 'new', algorithm: 'aes256' },
});
```

`PdfPasswordError` and `PdfEncryptionUnsupportedError` are the typed failures.

## Sign, annotate, inspect

```ts
import { signPdfBytes, validatePdfUA } from 'pdfnative';

const signed = signPdfBytes(bytes, { /* certificate, key, … */ });
const report = validatePdfUA(bytes);   // accessibility conformance
```

Engine 1.7.0 extends signing to the full PAdES LTV ladder (B-B → B-LTA):
`signPdfBytesWithTimestamp` embeds an RFC 3161 timestamp,
`addValidationInfo` writes the `/DSS` revocation material, and
`addDocumentTimestamp` appends `/DocTimeStamp` revisions — all on the bytes
this package produces, with network transport injected via
`setTimestampProvider`/`setRevocationProvider` (the engine never opens a
socket). Multiple signatures are supported through
`addSignaturePlaceholder({ allowMultiple })` and enumerated with
`listSignatures`. See the engine's
[LTV guide](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/ltv.md).

Annotations take three steps, because the modifier works on a *parsed* document
and `addAnnotation` takes a serialized dictionary, not an object:

```ts
import { openPdf, createModifier, buildAnnotationBody } from 'pdfnative';

const modifier = createModifier(openPdf(bytes));   // a PdfReader, not raw bytes

const body = buildAnnotationBody({
    type: 'text',
    rect: [72, 700, 92, 720],
    contents: 'Check this figure against the source data.',
    title: 'Reviewer',
});

modifier.addAnnotation(0, body);                    // 0-based page index
const annotated = modifier.save();                  // incremental update appended
```

`buildAnnotationBody` emits the `<< … >>` dictionary; `buildAnnotation` emits a
full indirect object instead, for when you are assembling a PDF yourself. Both
accept the typed markup shapes — text note, highlight, underline, strikeout,
squiggly, square, circle, line, free text and, since engine 1.9.0, a link.

Note that `addRawObject` throws on encrypted documents (a verbatim body cannot
be transparently encrypted); `addAnnotation` handles encryption correctly.

### Add a link to an existing PDF

`<Link url>` authors a link in the flow; adding one to bytes that already
exist — a cover page produced elsewhere, a signed file whose earlier revision
must stay intact — is the same three steps with the `'link'` shape
(`LinkMarkupAnnotation`: `{ type: 'link', rect, url, contents? }`, engine
1.9.0). The URL goes through the engine's scheme allow-list (`http:`,
`https:`, `mailto:`), as it does for the authored block:

```ts
import { openPdf, createModifier, buildAnnotationBody } from 'pdfnative';

const modifier = createModifier(openPdf(bytes));
modifier.addAnnotation(0, buildAnnotationBody({
    type: 'link',
    rect: [36, 700, 300, 716],                      // PDF user space, origin bottom-left
    url: 'https://pdfnative.dev',
    contents: 'Open the changelog',
}));
const linked = modifier.save();                     // an incremental update: the original bytes stay its prefix
```

Why not here: the annotation is written onto a *parsed* document, after
authoring is over — golden rule 7. In the flow, `<Link>` is the right tool.

### Compose LTV material collected offline

`addValidationInfo` fetches revocation material through the providers you
inject. When the material arrives out of band — an air-gapped pipeline, a
corporate PKI export, a cached validator run — `composeLtvData(pdfBytes,
material, options?)` (engine 1.9.0) builds the `LtvData` that
`embedValidationInfo` expects from flat lists, with no network and no
provider:

```ts
import { composeLtvData, embedValidationInfo } from 'pdfnative';
import type { LtvMaterial } from 'pdfnative';

const material: LtvMaterial = { certificates, ocspResponses, crls };   // DER Uint8Arrays, each list optional
const data = composeLtvData(signedBytes, material, { match: 'chain' });  // 'all' (default) references everything from every /VRI
const ltv = embedValidationInfo(signedBytes, data);                     // /DSS + /VRI as an incremental update
```

`match: 'chain'` keeps, per signature, only what validates it — the
certificates of its CMS and timestamp tokens plus their reachable issuers,
the OCSP responses whose CertID names one of them, the CRLs their issuers
signed; `'all'` is the Adobe-tolerant superset. It throws when the document
has no signed signature or the material is empty. Why not here: it operates
on a signed file, which this package never produces — signing itself is
already the engine's (see above and its
[LTV guide](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/ltv.md)).

The two lower-level 1.9.0 exports of the same module stay there too.
`ocspResponseMatchesCertificate(response, cert, issuer)` is the predicate
`match: 'chain'` uses — call it yourself to pick, from a cache of parsed OCSP
responses, the one whose `CertID` names a given certificate; and the ECDSA
primitives (`ecdsaSignHash(hash, privateKey)`, `ecdsaVerifyHash(hash, r, s,
publicKey)`, `encodeDerSignature` / `decodeDerSignature`) are what
`signPdfBytes` builds on when you bring your own key material:

```ts
import { ecdsaSignHash, encodeDerSignature, ocspResponseMatchesCertificate } from 'pdfnative';

const { r, s } = ecdsaSignHash(sha256Digest, privateKey);   // P-256 scalar pair
const der = encodeDerSignature(r, s);                         // the CMS SignatureValue bytes
const mine = parsedResponses.filter((o) => ocspResponseMatchesCertificate(o, signerCert, issuerCert));
```

Why not here: signing and revocation checking are the engine's cryptographic
surface; the authoring barrel never becomes a signing surface (golden rule 7).

### Decode a PDF text string

`openPdf()` returns the strings of an `/Info` dictionary or an outline exactly
as the file stores them — a byte-per-character string that may be UTF-16BE
behind a `FE FF` byte-order mark, UTF-8 behind `EF BB BF`, or PDFDocEncoding.
`decodePdfTextString(raw)` (engine 1.9.0) is the one decoder for ISO 32000-1
§7.9.2.2 text strings, the same one every engine reader uses:

```ts
import { openPdf, decodePdfTextString } from 'pdfnative';

const reader = openPdf(bytes);
const info = reader.resolveValue(reader.trailer.get('Info'));
const title = decodePdfTextString(info.get('Title') as string);   // 'Annual report — 2026', not 'þÿ\u0000A…'
```

An odd trailing byte of a UTF-16BE string becomes U+FFFD rather than being
dropped. Why not here: the function reads bytes; this package writes
`metadata` as JavaScript strings and the engine encodes them, so an author
never meets the raw form.

## Validate — and *see* — the output

`lintDocument` checks the model; these two recipes check the finished bytes.

**Conformance (veraPDF).** The repo validates its own PDF/A-claiming corpus
against the [veraPDF](https://verapdf.org) reference validator — locally and
as a blocking CI gate:

```bash
npm run validate:pdfa   # build → render the corpus → veraPDF each claiming file
```

Without veraPDF installed the runner skips with exit 0 (a skip, not a pass —
the gate's `--require-all` flag, which CI and the publish workflow pass, turns
that skip into a failure). Install hints and the pinned validator version live
in [CONTRIBUTING.md](../CONTRIBUTING.md). To validate *your own* output the
same way, render to a file and run
`verapdf --format xml --flavour 2b yourfile.pdf`, or use the engine's
`validatePdfUA(bytes)` in-process for the PDF/UA structural checks (see the
signing recipe above and `tests/pdfua.test.tsx`). Since engine 1.9.0 tagged
tables carry `/Scope` on their header cells, `/Headers` on their data cells
and an `/IDTree` in the structure tree root, and `validatePdfUA()` gained the
rules that check them — a table authored with `<Table headers>` passes; one
with no header row is what `L_TABLE_HEADERS` warns about first.

**PDF/X-4 (`validatePdfX`).** veraPDF does not cover PDF/X. The engine's
structural validator does, in-process, and is one import away:

```ts
import { validatePdfX } from 'pdfnative';

const { valid, errors, warnings } = validatePdfX(renderToBytes(<PressSheet />));
if (!valid) throw new Error(errors.join('\n'));
```

It checks the header, the XMP identification, the `/GTS_PDFX` output intent,
the boxes, `/Trapped`, embedded fonts (including inside Form XObjects, patterns
and appearance streams), transfer functions, OPI, PostScript and reference
XObjects, embedded files and annotations in the BleedBox. Since engine 1.9.0
it also reads device colour inside Form XObjects (their own resources or the
page's) and images, resolves every `/Separation`, `/DeviceN` and `/Indexed`
alternate against the output intent — so a spot ink with an RGB alternate
under a CMYK intent is reported — and checks the operators of every type-4
tint transform the content selects; it accepts the dual PDF/A-2 + PDF/X-4
file of [PRINT.md](PRINT.md). It is deliberately not re-exported from this
package (golden rule 7). Before sending a file to
press, confirm it with a certified preflight tool (callas pdfToolbox, Acrobat
Preflight): a `valid` result means the structural prerequisites hold. The
repository runs it over its own PDF/X corpus on every push
(`npm run validate:pdfx`); see [PRINT.md](PRINT.md).

**Appearance (vision-capable agents).** Nothing in the model tells you whether
the page *looks* right. Rasterize with a standard external tool and look:

```bash
pdftoppm -png -r 144 out.pdf page          # poppler-utils
mutool draw -o page-%d.png -r 144 out.pdf  # mupdf-tools alternative
```

An agent with vision reads the PNG and judges it against its intent — layout,
chart shape, nothing clipped. pdfnative-react deliberately bundles no
rasterizer (a runtime dependency for a verification concern would violate
golden rule 1). Runnable, with graceful degradation to the geometry report
when no rasterizer is installed:
[`samples/agent/visual-verify.tsx`](../samples/agent/visual-verify.tsx).

## Pin the creation date — reproducible bytes

Not a post-processing recipe, but the question it answers ("why do two renders
differ?") arrives with the others. Every date the engine writes is UTC since
1.8.0; pin the instant and the bytes repeat on every host:

```tsx
<Document creationDate={new Date('2026-01-01T00:00:00Z')}>      // this document
```

```ts
import { setDefaultCreationDate } from 'pdfnative-react';

setDefaultCreationDate(new Date('2026-01-01T00:00:00Z'));       // every document in this process
setDefaultCreationDate(null);                                   // back to the clock
```

The `{date}` header/footer placeholder and the trailer `/ID` follow the pin.
Two things never repeat, by design: `layout.encryption` (fresh keys, salts,
IVs) and anything applied to the bytes afterwards. The library reads no
environment variable — a pipeline that exports `SOURCE_DATE_EPOCH` applies it
in one line of its own. Full guide: [REPRODUCIBLE.md](REPRODUCIBLE.md).

## Inject a compressor

`layout.compress` needs a DEFLATE implementation. Node gets one from
`initNodeCompression()`; a browser, a Worker, Bun or Deno injects its own:

```ts
import { setDeflateImpl, setDeflateRawImpl, wrapZlib } from 'pdfnative-react';

setDeflateImpl((bytes) => pako.deflate(bytes));              // a zlib-wrapped compressor (RFC 1950)
setDeflateRawImpl((bytes) => fflate.deflateSync(bytes));      // a RAW compressor (RFC 1951) — the engine adds the zlib framing
setDeflateImpl(wrapZlib((bytes) => fflate.deflateSync(bytes))); // the same, spelled out
```

Since engine 1.8.0, `setDeflateImpl` rejects a raw-DEFLATE function at build
time (pdfnative #78) instead of writing an unreadable file — a document built
with `fflate.deflateSync` through `setDeflateImpl` was silently corrupt before.
Pass zlib output to `setDeflateImpl`, or use `setDeflateRawImpl`.

## Compile a font at runtime

Useful in serverless or sandboxed runtimes where you cannot spawn the
`pdfnative-build-font` CLI:

```ts
import { parseFontData, compileFontData } from 'pdfnative/tools';
import { registerFont } from 'pdfnative-react';

const data = parseFontData(ttfBuffer);
registerFont('brand', () => Promise.resolve(data));
```

`registerFont`, `registerFonts`, `loadFontData` and `validateFontData` *are*
re-exported from this package, because font registration happens before
authoring, not after.

## What stays here

| Concern | Where |
|---|---|
| Composing a document | `pdfnative-react` |
| Fonts, images, assets | `pdfnative-react` (`resolveFonts`, `fromUrl`, `fromBase64`) |
| Layout, watermark, header/footer, attachments, PDF/A, PDF/X-4, output intent | `pdfnative-react` (`<Document>` props, `layout`) |
| Typography, page breaking, justification | `pdfnative-react` (`typography`, `align`, `keepWithNext`, `splittable`) |
| A pinned creation date | `pdfnative-react` (`creationDate`, `setDefaultCreationDate`) |
| A compressor or a hyphenation provider | `pdfnative-react` (`setDeflateImpl`, `setDeflateRawImpl`, `setHyphenationProvider`) |
| Encryption **of a document you are authoring** | `pdfnative-react` (`layout.encryption`) |
| Checking a document before rendering | `pdfnative-react` (`lintDocument`, `inspectDocument`) |
| Checking the finished bytes (`validatePdfX`, `validatePdfUA`, `extractText`, `decodePdfTextString`) | **`pdfnative`** |
| Anything applied to bytes that already exist (a link annotation, `composeLtvData`, …) | **`pdfnative`** |

## See also

- [pdfnative on npm](https://www.npmjs.com/package/pdfnative) — the engine's own
  guides cover each of these in depth.
- [AGENTS.md](../AGENTS.md) — golden rule 7 and the rest of the contract.
- [LINTING.md](LINTING.md) — catching PDF/A, PDF/X and chart problems before rendering.
- [PRINT.md](PRINT.md), [REPRODUCIBLE.md](REPRODUCIBLE.md) — the guides behind the two new recipes.
