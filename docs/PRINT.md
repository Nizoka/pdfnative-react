# Print production — CMYK, colour bars, output intents and PDF/X-4

The 1.2.0 `print` prop gave a document its page boxes and printer's marks.
1.3.0 adds the colour side of prepress: CMYK colours on every colour position,
colour control bars in the bleed, CMYK and Gray output intents, and the
PDF/X-4 conformance claim.

_Applies to pdfnative-react v1.3.0 · pdfnative 1.8.0. Verified on 2026-09-22 against the source tree._

Runnable: [`samples/layout/print-pdfx4.tsx`](../samples/layout/print-pdfx4.tsx)
(a press-ready PDF/X-4 sheet, checked with `validatePdfX`),
[`samples/layout/cmyk.tsx`](../samples/layout/cmyk.tsx) (CMYK on every
position) and [`samples/layout/print-production.tsx`](../samples/layout/print-production.tsx)
(boxes and marks, from 1.2.0).

## Boxes and marks (recap)

```tsx
<Document print={{ bleed: 9, marks: true }}>                         // 9 pt bleed, crop + registration marks
<Document print={{ trimBox: [20, 20, 575, 822], artBox: [40, 40, 555, 802] }}>
```

`bleed` is the one-line form; the four boxes are explicit `[llx, lly, urx, ury]`
rectangles. Marks need a TrimBox source; `bleed` and `trimBox` are mutually
exclusive; `userUnit` (1–75 000) scales large formats. The lint rule
`L_PRINT_BOXES` delegates to the engine's own validator, so its message is the
engine's.

## Colour bars

```tsx
<Document print={{ bleed: 14.17, marks: { crop: true, registration: true, colourBars: true } }}>
<Document print={{ bleed: 14.17, marks: { colourBars: { tints: false, size: 10 } } }}>
```

`colourBars: true` draws the four process colours at 100 % and 50 % in the
bottom bleed strip, 12 pt patches by default (`ColourBarOptions`: `tints`
adds the 50 % patches, `size` is the patch edge in points). A 5 mm bleed
(14.17 pt) fits a densitometer aperture; under 4 pt the engine skips the bars
silently — the lint rule `L_PRINT_COLOUR_BARS` warns in both cases. Under a
`tagged` claim the bars are `/Artifact` content, invisible to assistive
technology.

## CMYK colours

The engine reads the colour space from the component count: three values are
DeviceRGB, four are DeviceCMYK.

| Form | Example | Range |
|---|---|---|
| Hex string | `'#1a73e8'` | RGB |
| RGB tuple | `[26, 115, 232]` | 0–255 |
| RGB operands | `'0.1 0.45 0.91'` | 0–1 |
| **CMYK tuple** (`PdfCmykTuple`) | `[0, 60, 100, 0]` | percent, 0–100 |
| **CMYK operands** (`PdfCmykString`) | `'0 0.6 1 0'` | 0–1 |

Every colour position accepts all five: `color` on headings, paragraphs,
sections and links, table `zebra` and `cellBorders.color`, chart `colors` and
series `color`, `watermark`, `header` / `footer` `color`, and the document
palette `layout.colors`. The `Color` type widened to admit the four-element
tuple; `validateSpec` and `schema('doc-spec')` accept both CMYK forms.

Chart tints under a CMYK palette remove ink rather than mixing toward white.
An outline bookmark colour (`/C`) is RGB by the PDF specification; a CMYK
outline colour is approximated.

A CMYK colour under a PDF/A or PDF/X claim whose output intent is not CMYK is
reported by the engine (`PDFA_DEVICE_CMYK_CONTENT`, `PDFX_DEVICE_CMYK`; a throw
under `layout.strict`); the lint rule `L_CMYK_INTENT_MISMATCH` says so first.

## Output intents

```tsx
<Document tagged="pdfa2b" outputIntent={{ iccProfile: profile, outputConditionIdentifier: 'ISO Coated v2' }}>
```

`outputIntent` is a `<Document>` prop (sugar over `layout.outputIntent`;
`DocSpec.outputIntent` carries the same object with the profile as bytes) and
accepts RGB, CMYK and Gray profiles. The profile must be a real ICC file: the
engine checks the `acsp` signature at byte 36 and that the size field fits the
buffer; a hand-made stub is rejected at build time (`L_OUTPUT_INTENT_PROFILE`
pre-empts it). RGB content under a CMYK or Gray intent is remapped by the
engine through `/DefaultRGB`.

No press profile is bundled. The profile of a printing condition (ISO Coated
v2, GRACoL, …) comes from the printer or the standards body; the synthetic
CMYK profile the samples use (`scripts/lib/synthetic-icc.ts`) is structurally
valid and characterises no press. Never send it to one.

Under `tagged` an `outputIntent` is honoured; without `tagged` or `pdfx` it is
silently ignored (`L_OUTPUT_INTENT_IGNORED`).

## PDF/X-4

```tsx
<Document
    pdfx="pdfx4"
    fontEntries={fontEntries}
    metadata={{ trapped: 'False' }}
    outputIntent={{ iccProfile: pressProfile, outputConditionIdentifier: 'FOGRA39' }}
    print={{ bleed: 14.17, marks: { crop: true, colourBars: true } }}
>
```

`pdfx="pdfx4"` (ISO 15930-7; sugar over `layout.pdfx`, `DocSpec.pdfx`) writes a
`%PDF-1.6` header, the PDF/X-4 XMP identification, a `/GTS_PDFX` output intent,
a TrimBox on every page and `/Trapped`. `'pdfx4'` is the only target the engine
knows (`PDF_X_CONFORMANCE_TARGETS`); PDF/X-1a and PDF/X-3 are tracked in
[ROADMAP.md](../ROADMAP.md).

What the engine refuses before writing a byte — each an `L_PDFX_*` lint rule
first, an `E_INPUT` error second:

| Constraint | Lint rule |
|---|---|
| The target must be `'pdfx4'` | `L_PDFX_TARGET` |
| Not combined with `tagged` (one conformance claim per file) | `L_PDFX_TAGGED_CONFLICT` |
| Not combined with `layout.encryption` | `L_PDFX_ENCRYPTED` |
| An `outputIntent` whose profile is a `prtr` (printer) profile, not a monitor profile such as sRGB | `L_PDFX_OUTPUT_INTENT` |
| `metadata.trapped` is `'True'` or `'False'`, never `'Unknown'` (pdfnative never traps: say `'False'`) | `L_PDFX_TRAPPED_UNKNOWN` |
| A TrimBox or an ArtBox per page, not both | `L_PDFX_BOXES` |

What raises a diagnostic (`layout.onDiagnostic`; a throw under `layout.strict`):

| Diagnostic | Lint rule |
|---|---|
| `PDFX_NO_FONT_ENTRIES` — no `fontEntries`, so the base-14 fonts would not be embedded | `L_PDFX_NO_FONTS` (error) |
| `PDFX_ANNOTATIONS` — a link or a form field inside the BleedBox | `L_PDFX_ANNOTATIONS` (warning) |
| `PDFX_DEVICE_CMYK` — CMYK content under a non-CMYK intent | `L_CMYK_INTENT_MISMATCH` (warning) |

## Checking the result

The engine's `validatePdfX()` checks the finished bytes: header, XMP, output
intent, boxes, trapping, embedded fonts (including inside Form XObjects and
appearance streams), transfer functions, OPI, PostScript and reference
XObjects, embedded files, annotations in the BleedBox.

```ts
import { validatePdfX } from 'pdfnative';

const { valid, errors, warnings } = validatePdfX(renderToBytes(doc));
```

It is deliberately **not** re-exported from `pdfnative-react` (golden rule 7:
authoring only); [RECIPES.md](RECIPES.md) shows the one-line import. veraPDF
does not cover PDF/X; before sending a file to press, confirm it with a
certified preflight tool (callas pdfToolbox, Acrobat Preflight). A `valid`
result means the structural prerequisites hold.

The repository runs `validatePdfX` over its own PDF/X corpus on every push
(`npm run validate:pdfx`, gate step `validate:pdfx` — in-process, never
skipped, with a negative canary the validator must reject).

## Limits

- Spot colours, PDF/X-1a, PDF/X-3 and PDF/X-4p are not available (engine "not yet"; ROADMAP).
- A file carries one conformance claim: PDF/A and PDF/X are exclusive.
- Colour emoji stay RGB under a CMYK intent.
- `outputIntent` is passed through; the engine performs no colour conversion beyond `/DefaultRGB`.

## See also

- [TYPOGRAPHY.md](TYPOGRAPHY.md), [REPRODUCIBLE.md](REPRODUCIBLE.md), [LINTING.md](LINTING.md).
- The engine's guide: [pdfnative docs/guides/print.md](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/print.md).
