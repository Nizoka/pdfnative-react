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
`lintDocument` reports `L_TAGGED_ENCRYPTED` if you combine them.

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
import { signPdfBytes, createModifier, openPdf, validatePdfUA } from 'pdfnative';

const signed = signPdfBytes(bytes, { /* certificate, key, … */ });

const modifier = createModifier(bytes);
modifier.addAnnotation(0, { /* highlight, note, … */ });

const report = validatePdfUA(bytes);   // accessibility conformance
```

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
