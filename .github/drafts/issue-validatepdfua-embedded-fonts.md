# [DRAFT — for human review and submission to Nizoka/pdfnative]

> Drafted by an AI agent during the pdfnative-react 1.2.0 release work, under
> the ecosystem HITL governance contract (draftsman, not submitter). A human
> must review this and submit it under their own identity, or discard it.

## Title

`validatePdfUA` fails to parse the engine's own output when `fontEntries` are embedded

## Summary

`validatePdfUA(bytes)` returns
`valid: false` with
`"Unable to enumerate pages: parseDict: expected name key, got keyword at offset …"`
when the input was produced by `buildDocumentPDFBytes` **with embedded
`fontEntries`**. The same document without `fontEntries` validates cleanly.
The validator's lightweight object parser appears to trip inside the raw
embedded-font stream. Reproduced with pdfnative 1.7.0 on every block content
tried (minimal paragraph, table, image, chart, link) — the trigger is the
presence of an embedded font, not the content.

## minimal_reproduction

```ts
import { buildDocumentPDFBytes, loadFontData, registerFonts, validatePdfUA } from 'pdfnative';

registerFonts({ latin: () => import('pdfnative/fonts/noto-sans-data.js') });
const fontData = await loadFontData('latin');

const bytes = buildDocumentPDFBytes(
    {
        title: 'Repro',
        blocks: [{ type: 'paragraph', text: 'Hello' }],
        fontEntries: [{ fontData, fontRef: '/F3', lang: 'latin' }],
    },
    { tagged: true },
);

const report = validatePdfUA(bytes);
console.log(report);
// → { valid: false, errors: ['Unable to enumerate pages: parseDict: expected name key, got keyword at offset …'], … }
// Remove `fontEntries` (and the engine falls back to base-14) → validates cleanly.
```

## environment

- pdfnative 1.7.0 (npm), Node 22, Windows 11 (also expected on Linux — the
  parser path is platform-independent).
- Found while adding a PDF/UA round-trip test to pdfnative-react 1.2.0
  (`tests/pdfua.test.tsx`), which had to fall back to a no-embedded-fonts
  document to validate cleanly.

## expected_behavior

`validatePdfUA` should parse any well-formed document the engine itself
produces — embedded font streams included — and report on PDF/UA structure
rather than failing page enumeration. Ideally the round trip
`buildDocumentPDFBytes(…, { tagged })` → `validatePdfUA` is green for the
engine's own output with embedded fonts, since PDF/UA in practice requires
embedded fonts.

## Notes

- No new runtime dependency is proposed.
- Adjacent observation, possibly intentional: the `PDFA_NO_FONT_ENTRIES`
  diagnostic fires for any truthy `tagged` (message hardcodes `pdfa2b` when
  `tagged === true`), not only for PDF/A string targets.
