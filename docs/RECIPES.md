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
input.

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
squiggly, square, circle, line, free text.

Note that `addRawObject` throws on encrypted documents (a verbatim body cannot
be transparently encrypted); `addAnnotation` handles encryption correctly.

## Validate — and *see* — the output

`lintDocument` checks the model; these two recipes check the finished bytes.

**Conformance (veraPDF).** The repo validates its own PDF/A-claiming corpus
against the [veraPDF](https://verapdf.org) reference validator — locally and
as a blocking CI gate:

```bash
npm run validate:pdfa   # build → render the corpus → veraPDF each claiming file
```

Without veraPDF installed the runner skips with exit 0 (a skip, not a pass —
CI sets `VERAPDF_REQUIRED=1` to fail closed). Install hints and the pinned
validator version live in [CONTRIBUTING.md](../CONTRIBUTING.md). To validate
*your own* output the same way, render to a file and run
`verapdf --format xml --flavour 2b yourfile.pdf`, or use the engine's
`validatePdfUA(bytes)` in-process for the PDF/UA structural checks (see the
signing recipe above and `tests/pdfua.test.tsx`).

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
| Layout, watermark, header/footer, attachments, PDF/A | `pdfnative-react` (`<Document>` props, `layout`) |
| Encryption **of a document you are authoring** | `pdfnative-react` (`layout.encryption`) |
| Checking a document before rendering | `pdfnative-react` (`lintDocument`, `inspectDocument`) |
| Anything applied to bytes that already exist | **`pdfnative`** |

## See also

- [pdfnative on npm](https://www.npmjs.com/package/pdfnative) — the engine's own
  guides cover each of these in depth.
- [AGENTS.md](../AGENTS.md) — golden rule 7 and the rest of the contract.
- [LINTING.md](LINTING.md) — catching PDF/A and chart problems before rendering.
