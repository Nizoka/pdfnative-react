# Linting

`lintDocument` checks a document for accessibility and layout problems — and for
constraints the engine would otherwise enforce by throwing at render time.

It runs on the **compiled document model**, so JSX and `DocSpec` share one
implementation and always agree. It is pure: it never writes to the console and
never throws for a finding. What you do with the report is your call.

Runnable: [`samples/quality/lint.tsx`](../samples/quality/lint.tsx) and, for
the engine's render-time diagnostics channel that complements it,
[`samples/quality/diagnostics.tsx`](../samples/quality/diagnostics.tsx).

## Quick start

```ts
import { lintDocument } from 'pdfnative-react';

const report = lintDocument(<Invoice />);
// { ok, findings: [{ code, severity, message, blockIndex?, hint? }], counts }

if (!report.ok) {
    for (const f of report.findings) console.error(`${f.code}: ${f.message}`);
    process.exit(1);
}
```

`ok` is `true` when no finding has severity `'error'`. `lintSpec(spec, options?)`
is the `DocSpec` twin.

## Why this exists

Two different problems, one tool.

**Accessibility is invisible until someone is harmed by its absence.** An image
with no alt text, a table with no header row, a heading hierarchy that skips a
level — none of these break the render, and none are visible in the output. They
only surface when a screen reader hits them.

**Engine constraints throw.** A pie chart with two series, a PDF/X-4 document
with no output intent, an attachment outside PDF/A-3 — these fail *inside* the
engine, mid-render, with a stack trace. Linting turns them into a finding with a
hint, before you spend the work.

## Rules

37 lint rules, each with a stable code (23 error, 13 warning, 1 info). Branch on
the code, not the message.

### Errors — these clear `ok`

| Code | Rule | Would otherwise |
|---|---|---|
| `L_EMPTY_DOCUMENT` | The document has no blocks | Render a blank page |
| `L_TAGGED_NO_FONTS` | PDF/A requested with no `fontEntries` | Produce a file veraPDF rejects (6.2.11.4.1) |
| `L_TAGGED_ENCRYPTED` | PDF/A and encryption combined | **Throw** (ISO 19005-1 §6.3.2) |
| `L_ATTACHMENTS_NEED_PDFA3` | Attachments outside `tagged="pdfa3b"` | **Throw** |
| `L_MAX_BLOCKS_EXCEEDED` | Block count past the `maxBlocks` ceiling | **Throw** |
| `L_CHART_EMPTY` | Chart with no series, or a series with no values | **Throw** |
| `L_CHART_SERIES` | Pie or donut with anything other than one series | **Throw** |
| `L_CHART_CATEGORIES` | On a category axis, series length ≠ `categories.length` | **Throw** |
| `L_CHART_VALUES` | Non-finite value, or a negative in a pie/donut | **Throw** |
| `L_CHART_POINTS` | Chart past the engine's 10 000-point ceiling | **Throw** |
| `L_CHART_LOG_SCALE` | Log scale on a stacked kind, log bounds ≤ 0, or non-positive values on a log-bound axis | **Throw** |
| `L_CHART_X_AXIS` | Positional axis misuse: wrong chart kind, scatter on `'category'`, missing/mismatched `xValues`, date strings without `'time'`, `yAxis: 'right'` on pie/donut | **Throw** |
| `L_CHART_LABELS` | `labelStride`/`labelRotation` on scatter, non-integer stride < 1, rotation outside 0–90 | **Throw** |
| `L_PRINT_BOXES` | Invalid `layout.print` geometry (bleed/box constraints, marks without a TrimBox, `userUnit` limits) | **Throw** |
| `L_VIEWER_PRINT_RANGE` | Malformed `viewerPreferences.printPageRange` pair or `numCopies` | **Throw** |
| `L_OUTPUT_INTENT_PROFILE` | `outputIntent.iccProfile` is not a usable ICC profile: under 128 bytes, no `acsp` signature, a size field outside the buffer, or a colour space other than RGB/CMYK/Gray | **Throw** |
| `L_PDFX_TARGET` | `pdfx` names a target other than `'pdfx4'` | **Throw** |
| `L_PDFX_TAGGED_CONFLICT` | `pdfx` and `tagged` both set (one conformance claim per file) | **Throw** |
| `L_PDFX_ENCRYPTED` | `pdfx` and `layout.encryption` combined (ISO 15930-7) | **Throw** |
| `L_PDFX_OUTPUT_INTENT` | `pdfx` without an `outputIntent`, or with a monitor (`mntr`) profile instead of a printer (`prtr`) profile | **Throw** |
| `L_PDFX_TRAPPED_UNKNOWN` | `pdfx` with `metadata.trapped: 'Unknown'` | **Throw** |
| `L_PDFX_BOXES` | `pdfx` with `print.artBox` beside `print.trimBox` or `print.bleed` | **Throw** |
| `L_PDFX_NO_FONTS` | `pdfx` requested with no `fontEntries` | The engine reports `PDFX_NO_FONT_ENTRIES` (a throw under `layout.strict`) |

**Twenty of these twenty-three pre-empt an exception the engine raises at
build time** — the eight chart rules, `L_PRINT_BOXES`, `L_VIEWER_PRINT_RANGE`,
`L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED`, `L_MAX_BLOCKS_EXCEEDED`,
`L_OUTPUT_INTENT_PROFILE` and the six PDF/X coherence rules. For the PDF/X
rules the finding's message *is* the engine's message, and the same throw
reaches `toErrorEnvelope` as `E_INPUT` when you skip the linter.
`L_MAX_BLOCKS_EXCEEDED` fires against the engine's `DEFAULT_MAX_BLOCKS` of
100 000 even when you set no `maxBlocks` yourself, since that is the ceiling
the engine actually enforces. `L_PRINT_BOXES` does not re-state the engine's
geometry rules — it *calls* the engine's own `validatePrintOptions` and
reports its message verbatim, so the two can never drift.

The remaining three catch output that renders successfully but is wrong:
`L_EMPTY_DOCUMENT` (a blank page), `L_TAGGED_NO_FONTS` (a PDF/A file veraPDF
rejects) and `L_PDFX_NO_FONTS` (a PDF/X-4 file with unembedded fonts).

### Warnings

| Code | Rule |
|---|---|
| `L_IMAGE_ALT` | Image with no alt text |
| `L_TABLE_HEADERS` | Table with no header row |
| `L_HEADING_HIERARCHY` | Heading level skipped, including a first heading deeper than h1 |
| `L_FIELD_LABEL` | Form field with no label |
| `L_LINK_TEXT` | Link with no text, or whose text is the bare URL |
| `L_MAX_BLOCKS` | Block count within 10% of the `maxBlocks` ceiling |
| `L_OUTPUT_INTENT_IGNORED` | `outputIntent` set without `tagged` or `pdfx` — the engine silently ignores it |
| `L_TAGGED_FORM_FONTS` | PDF/A target with form fields — the engine reports `PDFA_UNEMBEDDED_FORM_FONT` (and throws under `layout.strict`) |
| `L_OVERFLOW` | Block taller than the content box, or past the bottom margin |
| `L_PDFX_ANNOTATIONS` | PDF/X-4 document with a link or a form field — ISO 15930-7 forbids annotations inside the BleedBox; the engine reports `PDFX_ANNOTATIONS` |
| `L_TYPOGRAPHY_INEFFECTIVE` | A typography option that can have no effect: `orphans`/`widows` without `splitParagraphs`, an unknown `fontFeatures` tag, `kerning`/`fontFeatures`/`'fr'` without a registered font, a line quota below 1 |
| `L_PRINT_COLOUR_BARS` | `print.marks.colourBars` with a bottom bleed strip under 5 mm (the patches fall below a densitometer aperture; under 4 pt the engine skips the bars) |
| `L_CMYK_INTENT_MISMATCH` | A CMYK colour under a PDF/A or PDF/X claim whose output intent is not CMYK — the engine reports `PDFA_DEVICE_CMYK_CONTENT` / `PDFX_DEVICE_CMYK` |

Five of the warnings (`L_TAGGED_FORM_FONTS`, `L_PDFX_NO_FONTS` above,
`L_PDFX_ANNOTATIONS`, `L_TYPOGRAPHY_INEFFECTIVE`, `L_CMYK_INTENT_MISMATCH`)
mirror an engine diagnostic: a warning on the default channel, a throw under
`layout.strict`.

### Info

| Code | Rule |
|---|---|
| `L_CHART_ALT` | Chart with no `altText` — the engine's auto-generated one is generic |

The full registry, with descriptions, is available at runtime:

```ts
import { LINT_RULES, LINT_RULE_CODES } from 'pdfnative-react';
```

…and in `capabilityManifest().lintRules`. A 1.2.0 document trips none of the
twelve rules added in 1.3.0: every one needs a 1.3.0 input (`pdfx`,
`typography`, `colourBars`, a CMYK colour, an ICC profile) to fire.

## Options

```ts
interface LintOptions extends RenderOptions {
    overflow?: boolean;         // default false
    rules?: readonly LintRuleCode[];  // default: all
}
```

**`overflow`** enables `L_OVERFLOW`, which needs a full layout pass via
`inspectDocument` — roughly the cost of a render. Off by default for that
reason; turn it on in CI rather than in a hot path.

**`rules`** filters the report. This is how you adopt the linter on an existing
codebase without a wall of findings: fix one class at a time.

```ts
lintDocument(doc, { rules: ['L_IMAGE_ALT', 'L_TABLE_HEADERS'] });
```

## Findings

```ts
interface LintFinding {
    code: LintRuleCode;   // stable — branch on this
    severity: 'error' | 'warning' | 'info';
    message: string;      // human-readable; not stable across releases
    blockIndex?: number;  // index into DocumentParams.blocks, when block-scoped
    hint?: string;        // how to fix it
}
```

`counts` gives `{ error, warning, info }` for quick triage without a filter pass.

## Using it

### As a test

The most natural home. It is deterministic and fast.

```ts
it('has no accessibility errors', () => {
    expect(lintDocument(<Invoice invoice={fixture} />).findings).toEqual([]);
});
```

### As a CI gate

```ts
const report = lintDocument(doc);
if (!report.ok) {
    for (const f of report.findings.filter((f) => f.severity === 'error')) {
        console.error(`${f.code} ${f.message}`);
        if (f.hint) console.error(`  → ${f.hint}`);
    }
    process.exit(1);
}
```

### Before rendering

Worth it when the document is data-driven and the data is not yours — a chart
built from a user upload, a spec produced by an agent:

```ts
const report = lintSpec(spec);
if (!report.ok) return Response.json({ errors: report.findings }, { status: 422 });
return renderSpecToResponse(spec);
```

## Why there is no automatic dev warning

`lintDocument` never logs. Emitting warnings implicitly would make render
behaviour depend on `NODE_ENV`, put output you did not ask for into your logs,
and make the function impure — which would rule out calling it inside a test
assertion, its single most useful application.

Call it explicitly. It is one line.

## The engine's diagnostics channel (tier 4½)

Since engine 1.7.0, conformance problems only a render can see are reported
*at render time* through a diagnostics channel; engine 1.8.0 brings the list
to 9 diagnostic codes (`PdfDiagnosticCode`, an additions-only union):

| Code | Raised when | Lint rule ahead of it |
|---|---|---|
| `PDFA_NO_FONT_ENTRIES` | PDF/A claim, no embedded fonts | `L_TAGGED_NO_FONTS` |
| `PDFA_UNEMBEDDED_FORM_FONT` | PDF/A claim with AcroForm fields | `L_TAGGED_FORM_FONTS` |
| `PDFA_DEVICE_CMYK_IMAGE` | A CMYK JPEG under a PDF/A claim | — (needs the image bytes) |
| `PDFA_DEVICE_CMYK_CONTENT` | A CMYK colour under a non-CMYK PDF/A intent | `L_CMYK_INTENT_MISMATCH` |
| `PDFA_ICC_PROFILE_VERSION` | An ICC v4 profile under a PDF/A-1 claim | `L_OUTPUT_INTENT_PROFILE` (header checks only) |
| `PDFX_NO_FONT_ENTRIES` | PDF/X-4 claim, no embedded fonts | `L_PDFX_NO_FONTS` |
| `PDFX_DEVICE_CMYK` | A CMYK colour under a non-CMYK PDF/X intent | `L_CMYK_INTENT_MISMATCH` |
| `PDFX_ANNOTATIONS` | A link or form field inside the BleedBox | `L_PDFX_ANNOTATIONS` |
| `TYPOGRAPHY_FEATURE_INEFFECTIVE` | A `fontFeatures` tag the font cannot substitute (`tnum` on Noto Sans) | `L_TYPOGRAPHY_INEFFECTIVE` (tag validity only) |

By default the engine `console.warn`s once per code; `layout.onDiagnostic`
receives them programmatically, and `layout.strict: true` escalates them to
thrown errors.

The two tiers complement each other: `lintDocument` is pure, pre-render and
covers the document model; the diagnostics channel sees what only the render
can see — such as a CMYK JPEG under a PDF/A claim, or whether a font actually
carries the feature you asked for, which linting the model cannot know
without parsing font bytes. Gate CI on the linter, and set `strict: true`
when a silently-invalid conformance claim would be worse than a failed render.
See [`samples/quality/diagnostics.tsx`](../samples/quality/diagnostics.tsx).

## What it does not do

It checks the *document model*, not the rendered bytes. It cannot tell you that
a glyph fell back to `.notdef`, that a colour contrast is too low, or whether a
font declares an OpenType feature — the engine's diagnostic does. For
conformance verification of finished bytes, use the engine's `validatePdfUA`
or `validatePdfX`, or run veraPDF — see [RECIPES.md](RECIPES.md).
