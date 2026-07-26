# Linting

`lintDocument` checks a document for accessibility and layout problems — and for
constraints the engine would otherwise enforce by throwing at render time.

It runs on the **compiled document model**, so JSX and `DocSpec` share one
implementation and always agree. It is pure: it never writes to the console and
never throws for a finding. What you do with the report is your call.

Runnable: [`samples/quality/lint.tsx`](../samples/quality/lint.tsx).

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

**Engine constraints throw.** A pie chart with two series, a PDF/A document with
no embedded fonts, an attachment outside PDF/A-3 — these fail *inside* the
engine, mid-render, with a stack trace. Linting turns them into a finding with a
hint, before you spend the work.

## Rules

Eighteen rules, each with a stable code. Branch on the code, not the message.

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
| `L_CHART_CATEGORIES` | Series length ≠ `categories.length` | **Throw** |
| `L_CHART_VALUES` | Non-finite value, or a negative in a pie/donut | **Throw** |
| `L_CHART_POINTS` | Chart past the engine's 10 000-point ceiling | **Throw** |

**Eight of these ten pre-empt an exception the engine raises mid-render** — the
five chart rules, `L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED` and
`L_MAX_BLOCKS_EXCEEDED`. `L_MAX_BLOCKS_EXCEEDED` fires against the engine's
`DEFAULT_MAX_BLOCKS` of 100 000 even when you set no `maxBlocks` yourself, since
that is the ceiling the engine actually enforces.

The remaining two catch output that renders successfully but is wrong:
`L_EMPTY_DOCUMENT` (a blank page) and `L_TAGGED_NO_FONTS` (a PDF/A file veraPDF
rejects).

### Warnings

| Code | Rule |
|---|---|
| `L_IMAGE_ALT` | Image with no alt text |
| `L_TABLE_HEADERS` | Table with no header row |
| `L_HEADING_HIERARCHY` | Heading level skipped, including a first heading deeper than h1 |
| `L_FIELD_LABEL` | Form field with no label |
| `L_LINK_TEXT` | Link with no text, or whose text is the bare URL |
| `L_MAX_BLOCKS` | Block count within 10% of the `maxBlocks` ceiling |
| `L_OVERFLOW` | Block taller than the content box, or past the bottom margin |

### Info

| Code | Rule |
|---|---|
| `L_CHART_ALT` | Chart with no `altText` — the engine's auto-generated one is generic |

The full registry, with descriptions, is available at runtime:

```ts
import { LINT_RULES, LINT_RULE_CODES } from 'pdfnative-react';
```

…and in `capabilityManifest().lintRules`.

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

## What it does not do

It checks the *document model*, not the rendered bytes. It cannot tell you that
a glyph fell back to `.notdef`, or that a colour contrast is too low. For
conformance verification of finished bytes, use the engine's `validatePdfUA` or
run veraPDF — see [RECIPES.md](RECIPES.md).
