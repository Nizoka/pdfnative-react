# Print production — CMYK, colour bars, output intents and PDF/X-4

The 1.2.0 `print` prop gave a document its page boxes and printer's marks.
1.3.0 added the colour side of prepress: CMYK colours on every colour position,
colour control bars in the bleed, CMYK and Gray output intents, and the
PDF/X-4 conformance claim. 1.4.0 (engine 1.9.0) adds spot colours —
`/Separation` inks and `/DeviceN` mixes with a process alternate — and the
joint PDF/A-2 + PDF/X-4 claim in one file.

_Applies to pdfnative-react v1.4.0 · pdfnative 1.9.0. Verified on 2026-11-01 against the source tree._

Runnable: [`samples/layout/print-pdfx4.tsx`](../samples/layout/print-pdfx4.tsx)
(a press-ready PDF/X-4 sheet, checked with `validatePdfX`),
[`samples/layout/print-spot-colours.tsx`](../samples/layout/print-spot-colours.tsx)
(named inks on a PDF/X-4 sheet, one ink per bar in a chart),
[`samples/layout/print-dual-pdfa2b-pdfx4.tsx`](../samples/layout/print-dual-pdfa2b-pdfx4.tsx)
(PDF/A-2b and PDF/X-4 in one file),
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
engine's — and since engine 1.9.0 that validator also checks the
`print.spotColours` declarations (below).

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
series `color`, `watermark`, `header` / `footer` `color`. The `Color` type
widened to admit the four-element tuple; `validateSpec` and
`schema('doc-spec')` accept both CMYK forms. `layout.colors` (the engine's
`PdfColors` palette) is accepted and forwarded, but the block-flow renderer
this package drives never reads it — it is the palette of the engine's
table-report builder (`buildPDF`), so it is not a colour position here.

Chart tints under a CMYK palette remove ink rather than mixing toward white.
An outline bookmark colour (`/C`) is RGB by the PDF specification; a CMYK
outline colour is approximated, and a spot or ink-mix value is refused by the
engine (`An outline colour (/C) is a process RGB colour …`, `E_INPUT`) — the
schema types `outline[].color` as `$defs.processColor` for that reason.

A CMYK colour under a PDF/A or PDF/X claim whose output intent is not CMYK is
reported by the engine (`PDFA_DEVICE_CMYK_CONTENT`, `PDFX_DEVICE_CMYK`; a throw
under `layout.strict`); the lint rule `L_CMYK_INTENT_MISMATCH` says so first.

## Spot colours

A spot colour is an ink the press mixes beforehand — a brand blue, a
metallic, a varnish — rather than a CMYK build. Since engine 1.9.0 a document
declares each ink once under `print.spotColours`, with the process
*alternate* a viewer or a press without the ink shows in its place, then
paints with it on any colour position:

```tsx
<Document
    pdfx="pdfx4"
    fontEntries={fontEntries}
    metadata={{ trapped: 'False' }}
    outputIntent={{ iccProfile: pressProfile, outputConditionIdentifier: 'FOGRA39' }}
    print={{
        bleed: 14.17,
        marks: { crop: true, colourBars: true },
        spotColours: [
            { name: 'Brand Blue', alternate: [100, 44, 0, 0] },   // four CMYK percentages, 0–100
            { name: 'Varnish', alternate: [0, 0, 0, 8] },
        ],
    }}
>
    <Heading level={1} color={{ spot: 'Brand Blue' }}>One plate of its own</Heading>
    <Paragraph color={{ spot: 'Brand Blue', tint: 0.5 }}>A 50 % tint — one /Separation space, screened by the RIP.</Paragraph>
    <Paragraph color={{ inks: { 'Brand Blue': 1, Varnish: 0.6 } }}>Two inks through one /DeviceN space.</Paragraph>
    <Chart chartType="bar" series={[{ values: [100, 44, 8], colors: [{ spot: 'Brand Blue' }, '#1a73e8', { spot: 'Varnish' }] }]} categories={['Blue', 'Cyan', 'Varnish']} altText="Ink coverage per plate." />
</Document>
```

The `DocSpec` twin carries the same objects:

```json
{
  "pdfx": "pdfx4",
  "print": { "bleed": 14.17, "spotColours": [{ "name": "Brand Blue", "alternate": [100, 44, 0, 0] }] },
  "blocks": [
    ["h1", "One plate of its own", { "color": { "spot": "Brand Blue" } }],
    ["p", "A 50 % tint.", { "color": { "spot": "Brand Blue", "tint": 0.5 } }]
  ]
}
```

| Value | Writes | Notes |
|---|---|---|
| `print.spotColours: [{ name, alternate }]` (`SpotColourDef`) | One declaration per ink | `alternate` is four CMYK percentages (0–100) or three RGB values (0–255); a name must be non-empty and unique |
| `{ spot: name, tint? }` | A `/Separation` colour space with a generated tint transform to the alternate | `tint` is 0–1, default 1 |
| `{ inks: { name: tint, … } }` | A `/DeviceN` space over the named inks — the five-element array with its `/Colorants` attributes dictionary (ISO 19005-2 §6.2.4.4) | Every ink of a mix needs the same alternate space |

Both forms are `Color` values, so they reach every painted colour position the
CMYK forms reach — headings, paragraphs, links, table `zebra` and
`cellBorders.color`, chart `colors` and series `color`, `watermark`, `header`
/ `footer` — and, new in 1.9.0, `ChartSeries.colors`, one ink per bar (see
[CHARTS.md](CHARTS.md)). Two positions stay process: colour bars paint the
four process inks only (the registration colour of the marks stays `/All`),
and an outline bookmark colour is an RGB triple by the PDF specification —
`{ spot }` / `{ inks }` on `outline[].color` is an engine throw (`E_INPUT`)
and a schema error (`$defs.processColor`).

Three lint rules pre-empt the engine's throws, each with the engine's own
message:

| Constraint | Lint rule |
|---|---|
| Every ink a colour names is declared in `print.spotColours` — `Spot colour '<ink>' is not declared — add { name: '<ink>', alternate: [c, m, y, k] } to layout.print.spotColours` | `L_SPOT_UNDECLARED` |
| The inks of a mix share one alternate space — `Ink mix <a> + <b>: every ink of a mix needs the same alternate space (all CMYK or all RGB)` | `L_SPOT_INK_MIX` |
| A declaration is valid: non-empty, unique name; alternate values in range | `L_PRINT_BOXES` (the engine's `validatePrintOptions`) |

Under a PDF/A or PDF/X claim an ink whose alternate is CMYK is CMYK content:
it needs a CMYK output intent, and `L_CMYK_INTENT_MISMATCH` counts it like a
CMYK tuple. `validatePdfX()` resolves each `/Separation` and `/DeviceN`
alternate against the output intent and checks the operators of every tint
transform the content selects, so a file painting an undeclared or
mis-mixed ink can neither be written nor validated.

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
valid and characterises no press. Never send it to one. Outside this
repository the same structurally valid test profile comes from the engine's
tools entry — `import { buildSyntheticCmykProfile } from 'pdfnative/tools'`
(and `buildSyntheticGrayProfile`) — the one in-package way to a `prtr`
profile that `L_OUTPUT_INTENT_PROFILE` and `validatePdfX()` accept.

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
| Not combined with `tagged: 'pdfa1b'` (PDF 1.4 has no PDF/X-4) or `'pdfa3b'` (embedded files, which PDF/X forbids) — the engine's two per-level messages | `L_PDFX_TAGGED_CONFLICT` |
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

### One file, both claims — PDF/A-2 and PDF/X-4

A print file that must also be archived used to be two documents. Since
engine 1.9.0, `tagged="pdfa2b"` or `tagged="pdfa2u"` (and the plain
`tagged` form) combine with `pdfx="pdfx4"`:

```tsx
<Document tagged="pdfa2b" pdfx="pdfx4" fontEntries={fontEntries} metadata={{ trapped: 'False' }}
          outputIntent={{ iccProfile: pressProfile, outputConditionIdentifier: 'FOGRA39' }}
          print={{ bleed: 9, marks: true }}>
```

The XMP carries both identifications (`pdfaid` and `pdfxid`, with the PDF/X
ID extension schema), the structure tree and the TrimBox coexist on every
page, and the one output intent serves both standards (`/GTS_PDFA1` and
`/GTS_PDFX`, sharing one ICC stream). Everything each claim needs still
applies: embedded fonts, a `prtr` profile, a known trapping state, no
encryption, no annotations in the BleedBox. `pdfa1b` (PDF 1.4) and `pdfa3b`
(embedded files) still refuse the pair, with the engine's level-specific
messages — `L_PDFX_TAGGED_CONFLICT` reports them one tier before the throw.
Runnable: [`samples/layout/print-dual-pdfa2b-pdfx4.tsx`](../samples/layout/print-dual-pdfa2b-pdfx4.tsx);
the repository's conformance corpus runs the same file through veraPDF (the
PDF/A side) and `validatePdfX()` (the PDF/X side).

## Checking the result

The engine's `validatePdfX()` checks the finished bytes: header, XMP, output
intent, boxes, trapping, embedded fonts (including inside Form XObjects and
appearance streams), transfer functions, OPI, PostScript and reference
XObjects, embedded files, annotations in the BleedBox — and, since engine
1.9.0, device colour inside Form XObjects and images, with every
`/Separation`, `/DeviceN` and `/Indexed` alternate resolved against the
output intent.

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

- PDF/X-1a, PDF/X-3, PDF/X-4p and PDF/A-4 are not available (engine "not yet"; [ROADMAP.md](../ROADMAP.md)).
- PDF/A and PDF/X combine for PDF/A-2 only: a PDF/A-1 or PDF/A-3 file cannot carry a PDF/X claim.
- Colour bars paint process inks; a bar built from spot inks is upstream "not yet".
- Colour emoji stay RGB under a CMYK intent.
- `outputIntent` is passed through; the engine performs no colour conversion beyond `/DefaultRGB`.

## See also

- [TYPOGRAPHY.md](TYPOGRAPHY.md), [REPRODUCIBLE.md](REPRODUCIBLE.md), [LINTING.md](LINTING.md).
- The engine's guide: [pdfnative docs/guides/print.md](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/print.md).
