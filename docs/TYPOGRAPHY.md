# Typography

Page breaking, justification, kerning, OpenType features, units and short
words — the `pdfnative` engine's typography options, reachable from JSX and
from a `DocSpec`. Every option is off by default: a document that sets none
renders byte-identically to earlier releases.

_Applies to pdfnative-react v1.3.0 · pdfnative 1.8.0. Verified on 2026-09-22 against the source tree._

Runnable: [`samples/text/typography-engine.tsx`](../samples/text/typography-engine.tsx)
(every key, justification, soft hyphens, a hyphenation provider) and
[`samples/text/typography-french.tsx`](../samples/text/typography-french.tsx)
(the punctuation-spacing presets).

## TL;DR

```tsx
<Document
    fontEntries={fontEntries}                       // kerning, features and 'fr' need a registered font
    typography={{
        splitParagraphs: true, orphans: 2, widows: 2,
        keepHeadingsWithNext: { minLines: 3 },
        unitBinding: true, bindShortWords: true,
        opticalMargins: true, kerning: true,
        fontFeatures: ['smcp', 'onum'],
    }}
>
    <Heading level={2} keepWithNext>Results</Heading>
    <Paragraph align="justify" splittable>…</Paragraph>
</Document>
```

The same document as a `DocSpec`:

```json
{
  "fontEntries": [],
  "typography": { "splitParagraphs": true, "orphans": 2, "widows": 2, "keepHeadingsWithNext": { "minLines": 3 },
                  "unitBinding": true, "bindShortWords": true, "opticalMargins": true, "kerning": true,
                  "fontFeatures": ["smcp", "onum"] },
  "blocks": [
    ["h2", "Results", { "keepWithNext": true }],
    ["p", "…", { "align": "justify", "splittable": true }]
  ]
}
```

## Which surfaces carry it

| Surface | Where | Notes |
|---|---|---|
| JSX | `<Document typography={…}>` | Sugar over `layout.typography`, in the mould of `print`: an explicit `layout` prop wins, and it replaces the object whole (no deep merge) |
| DocSpec | `typography` top-level field | Same object; `schema('doc-spec')` describes every key with its bounds |
| Render options | `RenderOptions.layout.typography` | Merges on top of the document, like every `layout` key |
| Blocks | `<Paragraph align="justify" keepWithNext splittable>`, `<Heading keepWithNext>` — `['p', text, { align, keepWithNext, splittable }]`, `['h1', text, { keepWithNext }]` | Per-block overrides of the document setting |

`ParagraphAlign` is `Align | 'justify'`: only paragraphs justify. `Align` itself
(`'left' | 'center' | 'right'`, shared by images, barcodes, SVG and charts) is
unchanged.

## The twelve keys

| Key | Type | What it does | Needs |
|---|---|---|---|
| `splitParagraphs` | `boolean` | A paragraph that does not fit breaks at a line boundary instead of moving whole to the next page | — |
| `orphans` | `number ≥ 1` | Minimum lines left at the foot of a page when a paragraph splits | `splitParagraphs` |
| `widows` | `number ≥ 1` | Minimum lines carried to the next page when a paragraph splits | `splitParagraphs` |
| `keepHeadingsWithNext` | `boolean \| { minLines }` | A heading moves to the next page when fewer than `minLines` (default 2) lines of its paragraph would follow it | — |
| `unitBinding` | `boolean \| { units }` | A number and its unit never break (`150 €`, `12 kg`, `30 %` — ISO 80000-1); `units` extends the list | — |
| `bindShortWords` | `boolean \| { words }` | A line never ends on a one-letter word (`a`, `I`, …); `words` replaces the list | — |
| `punctuationSpacing` | `'fr' \| 'fr-CA' \| PunctuationSpacingRule[]` | A plain space before `; ! ?` becomes a narrow no-break space and before `:` and inside guillemets a no-break space (`'fr'`); `'fr-CA'` sets none before `; ! ?`; rules are `{ char, side, space: 'nbsp' \| 'narrow' }` | A registered font for the narrow space |
| `opticalMargins` | `boolean` | Hanging punctuation on justified lines | `align: 'justify'` |
| `metrics` | `'approximate' \| 'exact'` | `'exact'` measures base-14 text with the Adobe Core 14 advance widths | Base-14 text |
| `fontFeatures` | `string[]` | OpenType single substitutions: `tnum`, `pnum`, `lnum`, `onum`, `zero`, `ordn`, `sups`, `subs`, `smcp`, `c2sc`, `case` | A registered font |
| `kerning` | `boolean` | GPOS pair kerning, emitted as `TJ` arrays | A registered font |
| `hyphenationLanguage` | `string` | The BCP 47 tag handed to the hyphenation provider with every word | A provider (`setHyphenationProvider`) |

Bounds are enforced by the schema (`schema('doc-spec')`) and, before a render,
by the lint rule `L_TYPOGRAPHY_INEFFECTIVE` — a warning wherever an option can
have no effect as written: `orphans` or `widows` without `splitParagraphs`, an
unknown feature tag, `kerning`, `fontFeatures` or `'fr'` without `fontEntries`,
a line quota below 1.

## Recipes

### A report that breaks well

```tsx
typography={{ splitParagraphs: true, orphans: 2, widows: 2, keepHeadingsWithNext: { minLines: 3 } }}
```

Long paragraphs split line by line, never leaving a lone first line at the foot
of a page or a lone last line at the head of the next; a heading takes three
lines of its paragraph along. `<Paragraph splittable={false}>` keeps one
paragraph whole; `<Paragraph keepWithNext>` glues it to the block that follows.

### Justified text with hanging punctuation

```tsx
<Document typography={{ opticalMargins: true }}>
    <Paragraph align="justify">…</Paragraph>
```

Every line but the last is set flush on both margins as one `TJ` array; with
`opticalMargins`, punctuation hangs slightly into the margin so the edge reads
straight.

### French punctuation spacing

<!-- demo-language: fr (punctuationSpacing 'fr' is a French convention; the sentence exists to be spaced by it) -->
```tsx
<Document fontEntries={fontEntries} typography={{ punctuationSpacing: 'fr' }}>
    <Paragraph>Bonjour ! Comment allez-vous ? Très bien ; merci : « à bientôt ».</Paragraph>
```

The engine only converts a space the author wrote; it inserts nothing. Text
extraction returns the no-break spaces, which is what makes the setting visible
to a search index or a screen reader. Without a registered font there is no
U+202F glyph, so `'fr'` degrades to `'fr-CA'` and the linter says so.

### Units, short words, figures

```tsx
typography={{ unitBinding: { units: ['GB', 'ms'] }, bindShortWords: true, fontFeatures: ['tnum', 'lnum'] }}
```

`unitBinding` binds `12 GB` and `30 ms` beside the default list. `tnum` and
`lnum` request tabular, lining figures — a no-op on the bundled Noto Sans,
whose figures are tabular and lining already; the engine reports
`TYPOGRAPHY_FEATURE_INEFFECTIVE` through `layout.onDiagnostic` (and throws
under `layout.strict`).

### Exact base-14 metrics

```tsx
typography={{ metrics: 'exact' }}
```

Text set in the base-14 faces is measured with the Adobe Core 14 advance
widths instead of the historical approximation; lines break where a viewer
draws them. Registered fonts are always measured exactly.

### A hyphenation provider

```ts
import { setHyphenationProvider } from 'pdfnative-react';

setHyphenationProvider((word, lang) => hypher.hyphenate(word, lang));   // your dictionary
```

No dictionary ships (the engine's limit, tracked in [ROADMAP.md](../ROADMAP.md)).
Soft hyphens (U+00AD) in the text are honoured as break opportunities and never
drawn mid-word; a provider returns the break offsets for a word, and
`hyphenationLanguage` is the tag it receives. `setHyphenationProvider(null)`
removes it. The provider is process-wide, like `setDefaultCreationDate`.

## Previewing the effect

`inspectDocument(node)` (or `inspectSpec(spec)`) returns page count and
per-block geometry without rendering — the cheapest way to see where a
paragraph split or a heading moved.

## Limits

Stated by the engine, repeated here because an agent cannot guess them:

- No hyphenation dictionary is bundled; soft hyphens work, a provider is yours to bring.
- `kerning`, `fontFeatures` and the narrow no-break space need a registered font: the base-14 faces carry no GPOS/GSUB tables and no U+202F.
- `metrics: 'exact'` acts on base-14 text only.
- `fontFeatures` covers single substitutions; ligatures, contextual alternates and stylistic sets are not applied.
- `tnum` / `lnum` change nothing on Noto Sans (`TYPOGRAPHY_FEATURE_INEFFECTIVE`).
- Justification applies to paragraphs, not to table cells or list items.

## See also

- [LINTING.md](LINTING.md) — `L_TYPOGRAPHY_INEFFECTIVE` and the diagnostics channel.
- [REPRODUCIBLE.md](REPRODUCIBLE.md) — the typography options are deterministic; pin the date and the bytes repeat.
- The engine's own guide: [pdfnative docs/guides/typography.md](https://github.com/Nizoka/pdfnative/blob/main/docs/guides/typography.md).
