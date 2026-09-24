# Agent automation contract

How an AI agent uses pdfnative-react without a human in the loop.

_Verified on 2026-09-22 against the source tree (pdfnative-react 1.3.0, pdfnative 1.8.0)._

Everything here returns plain JSON-serializable data. Nothing in this package
reaches the network, writes to GitHub, reads an environment variable, or emits
telemetry — see [Governance](#governance) at the bottom, and
`aiGovernancePolicy()` for the machine-readable version.

Runnable version of this whole page:
[`samples/agent/agent-loop.ts`](../samples/agent/agent-loop.ts).

## The recommended loop

```
1. doctor()              will this environment work at all?
2. capabilityManifest()  what can I do here?
3. schema('doc-spec')    what grammar do I emit?
4. validateSpec(json)    is what I produced well-formed?      dry run, tier 1
5. compileSpec(spec)     does it map onto the document model?  dry run, tier 2
6. lintSpec(spec)        is it accessible and engine-legal?    dry run, tier 3
7. renderSpecTo*(spec)   only now, produce bytes.
```

Steps 4–6 are cheap and catch different classes of problem. Step 7 is the only
one that costs real work.

## 1. Pre-flight

```ts
import { doctor } from 'pdfnative-react';

const report = doctor();
// { ok: true, checks: [{ name, status: 'ok' | 'warn' | 'error', value, detail }] }
```

`doctor()` **never throws** — it reports rather than raises, which is what makes
it safe to call first. Checks cover the package version, Node, React, the engine
(via a capability probe rather than a version string, so it survives bundling),
Web Crypto, the Fetch API and `Blob`.

One limit worth knowing: `core-bridge` re-exports the engine with a *static*
`export … from 'pdfnative'`, so if the peer is not installed at all the module
graph fails to resolve and `doctor()` is never reached — you get
`ERR_MODULE_NOT_FOUND` at import time instead, which is already an unambiguous
diagnosis. What `doctor()` catches is the subtler case: an engine that resolves
but is **older than 1.8.0** — the probes run newest-first, so a 1.7.x engine
is reported as `1.7.x — this release needs >= 1.8.0`, a 1.6.x engine gets its
own message, anything older a generic one.

Branch on `report.ok`. When it is `false`, report the failing checks rather than
attempting work that cannot succeed.

Schema: `schema('doctor')`.

## 2. Discovery

```ts
import { capabilityManifest } from 'pdfnative-react';

const m = capabilityManifest();
```

One object describing:

| Field | Contents |
|---|---|
| `contract` | The invariants: authoring-only, block-flow layout, React 19, engine `^1.8.0`, Node `>=22`, no side effects, no network |
| `components` | Every JSX component, its host tag, and its aliases |
| `specBlocks` | The whole `DocSpec` grammar: tuple form, summary, equivalent component |
| `specFields` | The 18 top-level `DocSpec` fields, in contract order |
| `entrypoints` | Every callable, with signature, sync/async/stream, and Node-only flag |
| `errorCodes` | The `E_*` taxonomy |
| `lintRules` | Every `L_*` rule with its severity |
| `schemaSubjects` | What `schema()` will answer to |

The manifest is derived from the same internal registries that build the JSON
Schema, and a test asserts every name it advertises resolves to a real export.
It cannot describe a capability that does not exist.

Schema: `schema('manifest')`. CLI-style dump:
`npx tsx samples/agent/manifest.ts --json`.

## 3. Schemas

```ts
import { schema, schemaId, SCHEMA_SUBJECTS } from 'pdfnative-react';

schema('list');            // the self-describing index
schema();                  // defaults to 'doc-spec'
schemaId('doc-spec');      // https://pdfnative.dev/schema/react/1.3.0/doc-spec.schema.json
```

Seven subjects: `doc-spec`, `render-options`, `lint-report`, `spec-validation`,
`doctor`, `manifest`, `list`.

Each `$id` **embeds the package version**. If you cache a schema, compare `$id`s
to detect that the contract moved. An unknown subject throws with `E_INPUT`.

No validator is bundled — the package only *emits* schemas, so it stays
dependency-free. Validate with whatever you already use, or use `validateSpec`
below when you cannot bring a validator at all.

## 4. Authoring: prefer `DocSpec`

`DocSpec` is a compact, JSON-serializable grammar of positional tuples that
compiles to **exactly** the same document as the equivalent JSX — it is built on
the same components, so the two cannot drift.

```json
{
  "title": "Q4 revenue review",
  "footer": { "right": "Page {page} of {pages}" },
  "creationDate": "2026-01-01T00:00:00Z",
  "typography": { "splitParagraphs": true, "orphans": 2, "widows": 2, "unitBinding": true },
  "blocks": [
    ["h1", "Q4 revenue review", { "keepWithNext": true }],
    ["p", "Revenue grew 24 % year over year.", { "align": "justify" }],
    ["chart", {
      "chartType": "bar",
      "series": [{ "label": "2026", "values": [15400, 21200, 29800, 38600] }],
      "categories": ["Q1", "Q2", "Q3", "Q4"],
      "altText": "Revenue rises each quarter from 15.4k to 38.6k."
    }],
    ["table", { "h": ["Channel", "Share"], "r": [["Direct", "46%"]] }]
  ]
}
```

Emit this, not JSX. It costs a fraction of the tokens and it is data you can
validate before executing.

### The grammar in one table

| DocSpec field | Mirrors | Notes |
|---|---|---|
| `title`, `footerText`, `metadata`, `fontEntries`, `layout`, `outline`, `pageLabels` | the same `<Document>` props | `metadata.trapped` is required to be known under `pdfx` |
| `watermark`, `header`, `footer`, `attachments`, `tagged`, `print` | the 1.1.0/1.2.0 layout sugar | `print.marks.colourBars` (1.3.0) wants a 5 mm bleed |
| `pdfx`, `outputIntent`, `typography`, `creationDate` | the 1.3.0 layout sugar | `pdfx: 'pdfx4'`; `outputIntent.iccProfile` as bytes; `creationDate` as an ISO 8601 string |
| `blocks` | the content | the tuples below |

Block tuples, by tag: `'h1'` `'h2'` `'h3'` (text, `{ color, keepWithNext }`),
`'p'` (text, `{ align: 'left' | 'center' | 'right' | 'justify', keepWithNext, splittable, … }`),
`'ul'` `'ol'` (items), `'table'` (body), `'img'` (body), `'link'` (text, `{ url }`),
`'sp'` (height), `'br'`, `'page'` (blocks), `'toc'`, `'qr'` `'code128'` `'ean13'`
`'pdf417'` `'datamatrix'` (data), `'svg'` (data), `'chart'` (body), `'field'`
(body). `capabilityManifest().specBlocks` and `schema('doc-spec')` carry the
exact arities and option keys; every colour option accepts hex, RGB and CMYK
(`[c, m, y, k]` in percent or `'c m y k'`).

## 5. The four dry-run tiers

| Tier | Call | Cost | Catches |
|---|---|---|---|
| 1 | `validateSpec(unknown)` | trivial | Malformed shape: unknown kind, wrong arity, wrong payload type |
| 2 | `compileSpec(spec)` | cheap | Structure that cannot map onto the document model |
| 3 | `lintSpec(spec)` | cheap | Accessibility problems, and engine constraints that would throw |
| 4 | `inspectSpec(spec)` | ≈ a render | Pagination and per-block geometry |

### Tier 1 — `validateSpec`

```ts
const result = validateSpec(JSON.parse(untrusted));
// { ok, errors: [{ code, severity, path, message }], warnings: [...] }
```

Never throws — including on deliberately hostile input. Page nesting is bounded
at 64 levels (`V_TOO_DEEP`), so a deep payload cannot exhaust the call stack.
Findings are path-anchored (`blocks[3][1]`), so an agent can repair its own
output rather than guessing. Codes: `V_NOT_OBJECT`, `V_BLOCKS`,
`V_BLOCK_SHAPE`, `V_UNKNOWN_KIND`, `V_ARITY`, `V_PAYLOAD_TYPE`, `V_OPTS_TYPE`,
`V_TOO_DEEP`, and `V_UNKNOWN_FIELD` (warning only — unknown fields are ignored,
not fatal, so forward compatibility is preserved).

Arity and payload rules derive from the same table that builds the JSON Schema,
so the two can never disagree.

### Tier 3 — `lintSpec`

37 lint rules with stable `L_*` codes (23 error, 13 warning, 1 info).
**Twenty** pre-empt an exception the engine raises *at build time*:

| Code | Would otherwise |
|---|---|
| `L_CHART_EMPTY` | Throw — no series, or a series with no values |
| `L_CHART_SERIES` | Throw — pie/donut need exactly one series |
| `L_CHART_CATEGORIES` | Throw — series length must match categories (category axes) |
| `L_CHART_VALUES` | Throw — non-finite, or negative in a pie/donut |
| `L_CHART_POINTS` | Throw — 10 000-point ceiling |
| `L_CHART_LOG_SCALE` | Throw — log scale on stacked kinds, or non-positive log data/bounds |
| `L_CHART_X_AXIS` | Throw — positional-axis misuse, missing/mismatched `xValues` |
| `L_CHART_LABELS` | Throw — invalid `labelStride`/`labelRotation` |
| `L_PRINT_BOXES` | Throw — invalid `layout.print` geometry (checked by the engine's own validator) |
| `L_VIEWER_PRINT_RANGE` | Throw — malformed `printPageRange`/`numCopies` |
| `L_ATTACHMENTS_NEED_PDFA3` | Throw — attachments require `tagged="pdfa3b"` |
| `L_TAGGED_ENCRYPTED` | Throw — PDF/A and encryption are mutually exclusive |
| `L_MAX_BLOCKS_EXCEEDED` | Throw — past `maxBlocks`, default 100 000 |
| `L_OUTPUT_INTENT_PROFILE` | Throw — an `outputIntent.iccProfile` that is not a real ICC profile (`acsp`, size field, RGB/CMYK/Gray) |
| `L_PDFX_TARGET` | Throw — `pdfx` other than `'pdfx4'` |
| `L_PDFX_TAGGED_CONFLICT` | Throw — `pdfx` with `tagged` |
| `L_PDFX_ENCRYPTED` | Throw — `pdfx` with `layout.encryption` |
| `L_PDFX_OUTPUT_INTENT` | Throw — `pdfx` without a printer (`prtr`) output intent |
| `L_PDFX_TRAPPED_UNKNOWN` | Throw — `pdfx` with `metadata.trapped: 'Unknown'` |
| `L_PDFX_BOXES` | Throw — `pdfx` with an ArtBox beside a TrimBox source |

For the six PDF/X rules the finding's message *is* the engine's message; when
an agent skips the linter, the same throw arrives through `toErrorEnvelope`
as `E_INPUT` (its message starts with `layout.pdfx`, `PDF/X`, `print.`,
`outputIntent.` or `chart:` — the prefixes of `ENGINE_INPUT_ERROR_PREFIXES`).

Five warnings mirror an engine diagnostic that becomes a throw under
`layout.strict` — `L_TAGGED_FORM_FONTS`, `L_PDFX_NO_FONTS` (an error),
`L_PDFX_ANNOTATIONS`, `L_TYPOGRAPHY_INEFFECTIVE`, `L_CMYK_INTENT_MISMATCH` —
and three catch output that renders successfully but is wrong:
`L_EMPTY_DOCUMENT` (a blank page), `L_TAGGED_NO_FONTS` (a PDF/A file veraPDF
rejects) and `L_PDFX_NO_FONTS` (a PDF/X-4 file with unembedded fonts). The
engine's 9 diagnostic codes — `PDFA_NO_FONT_ENTRIES`,
`PDFA_UNEMBEDDED_FORM_FONT`, `PDFA_DEVICE_CMYK_IMAGE`,
`PDFA_DEVICE_CMYK_CONTENT`, `PDFA_ICC_PROFILE_VERSION`,
`PDFX_NO_FONT_ENTRIES`, `PDFX_DEVICE_CMYK`, `PDFX_ANNOTATIONS`,
`TYPOGRAPHY_FEATURE_INEFFECTIVE` — reach `layout.onDiagnostic`; the
JSON-safe switch `layout.strict: true` turns them into thrown errors.

A 1.2.0 document trips none of the twelve rules added in 1.3.0. Gate on
`report.ok` (true when no `error`-severity finding). See
[LINTING.md](LINTING.md).

### Tier 5 — verifying the rendered output (post-render)

Tiers 1–4 check the document *model* before spending a render. Tier 5 checks
the *output* — the finished bytes — and is where an autonomous agent proves
its work rather than trusting it. Four ascending checks, each answering a
different question:

| Check | Question it answers | How |
|---|---|---|
| `inspectSpec` / `inspectDocument` | Where did every block land? | Structured geometry, no bytes needed (tier 4, listed for contrast) |
| `extractText` (engine) | Did the text really render, or fall back to `.notdef`? | `import { extractText } from 'pdfnative'` on the rendered bytes — see [RECIPES.md](RECIPES.md) |
| `validatePdfUA` (engine) / **veraPDF** | Is the PDF/A or PDF/UA claim true? | `npm run validate:pdfa` runs the veraPDF reference validator over the repo's PDF/A corpus; agents can validate their own output the same way — see [RECIPES.md](RECIPES.md) |
| `validatePdfX` (engine) | Is the PDF/X-4 claim structurally true? | `import { validatePdfX } from 'pdfnative'` on the bytes — the structural prerequisites, not a certified preflight; `npm run validate:pdfx` runs it over the repo's corpus — see [PRINT.md](PRINT.md) |
| **Rasterize + look** (vision agents) | Does the page *look* right? | Rasterize with a standard external tool and read the PNG |

The last row is for agents with vision capability. pdfnative-react bundles no
rasterizer (no new dependency, ever — golden rule 1); use a standard tool:

```bash
pdftoppm -png -r 144 out.pdf page        # poppler-utils → page-1.png, page-2.png…
mutool draw -o page-%d.png -r 144 out.pdf  # mupdf-tools alternative
```

Render → rasterize → **read the image** → judge against your intent: is the
layout what you meant, are the chart bars in the right order, is anything
clipped or overlapping? Geometry (`inspectSpec`) tells you where blocks are;
only looking tells you whether the page communicates. Runnable, with graceful
degradation to tier 4 when no rasterizer is installed:
[`samples/agent/visual-verify.tsx`](../samples/agent/visual-verify.tsx).

## 6. Errors

Every error carries a stable `code`. **Branch on the code, never on the
message** — messages are reworded freely between releases, codes are not.

```ts
import { PdfReactError, ErrorCode, toErrorEnvelope } from 'pdfnative-react';

try {
    render();
} catch (err) {
    const envelope = toErrorEnvelope(err);
    // { ok: false, error: { code: 'E_STRUCTURE', message: '…' } }
    if (err instanceof PdfReactError && err.code === ErrorCode.STRUCTURE) { /* … */ }
}
```

| Code | Meaning |
|---|---|
| `E_STRUCTURE` | The tree or spec cannot map onto the pdfnative model |
| `E_INPUT` | Invalid input (bad props, malformed spec, unknown schema subject) |
| `E_UNSUPPORTED` | The capability exists but is not available here |
| `E_ENV` | Missing peer, Node too old, absent Web API |
| `E_POLICY` | An AI-governance rule was violated |
| `E_RUNTIME` | Anything else |

`toErrorEnvelope` accepts *any* thrown value, so a caller only ever handles one
shape. Runnable: [`samples/agent/error-envelope.tsx`](../samples/agent/error-envelope.tsx).

## 7. Rendering

| Target | Call |
|---|---|
| Bytes | `renderSpecToBytes(spec)` |
| HTTP response | `renderSpecToResponse(spec, { fileName, disposition })` |
| File | `renderSpecToFile(spec, path)` (Node) |
| Large file, flat memory | `renderSpecToFileStream(spec, path)` (Node) |
| Byte stream | `renderSpecToStream(spec)` |

Each has a JSX twin (`renderTo*`). See [SERVER.md](SERVER.md) for the response
helpers.

## 8. Reproducible output for agents

Set `creationDate` in the spec (an ISO 8601 string) and the same spec renders
to the same bytes on every host: every date is written in UTC, the `{date}`
placeholder and the trailer `/ID` follow the pin. That makes bytes comparable
across runs — hash them, cache them, diff them — and makes
`renderSpecToResponse(spec, { etag: true })` a stable validator.

- The pin is explicit. The library never reads `SOURCE_DATE_EPOCH` or any
  other environment variable; `setDefaultCreationDate(date)` is the
  process-wide alternative when many specs share one instant.
- An unparseable `creationDate` string is an `E_INPUT` error, never a silent
  fallback to the clock.
- Not reproducible by design: a spec with `layout.encryption` (fresh keys per
  build), and anything done to the bytes afterwards.

Guide: [REPRODUCIBLE.md](REPRODUCIBLE.md).

## Token economy

Three levers, in order of impact:

1. **Use `DocSpec`, not JSX.** Positional tuples cost a fraction of the tokens
   of the equivalent component tree.
2. **Read the manifest once**, not the documentation repeatedly. It is the
   compressed form of everything on this page.
3. **Fetch only the schema subject you need.** `schema('list')` is small;
   `schema('doc-spec')` is the large one, and you rarely need it more than once.

## Governance

pdfnative-react ships **no code path** that writes to GitHub or makes an
outbound network call. An agent's authority ends at producing a local draft plus
a compliance report; a human reviews and submits it under their own identity.

```ts
import { aiGovernancePolicy, agentRulesText, validateIssueDraft } from 'pdfnative-react';

aiGovernancePolicy();          // the machine-readable policy
agentRulesText();              // the protocol, as text
validateIssueDraft(markdown);  // gate a draft: { ok, errors, warnings, code? }
```

`validateIssueDraft` is a pure string function. It rejects drafts that propose a
new runtime dependency or omit a reproduction block, and warns about missing
recommended fields. The repository's `npm run verify:issue` runs the same rules;
a test asserts the two implementations stay byte-identical.

Full narrative: [AI_GOVERNANCE.md](AI_GOVERNANCE.md).
Agent-facing protocol: [`.github/AGENT_RULES.md`](../.github/AGENT_RULES.md).

## Boundaries an agent must respect

- **Authoring only.** Merging, splitting, form filling, text extraction,
  signing, decryption — all belong to the `pdfnative` engine, operating on the
  bytes this package produces. See [RECIPES.md](RECIPES.md).
- **No CSS layout model.** There is no `<View>`, no flexbox, no absolute
  positioning. pdfnative is a declarative block flow. Do not attempt to emulate
  HTML layout; map onto the blocks in `capabilityManifest().specBlocks`.
- **React 19 only.** The reconciler is bound to a single, pinned version
  contract.
- **No new runtime dependency**, in any proposal. The only one is
  `react-reconciler`; `pdfnative` and `react` are peers.
- **No environment variables.** Nothing in the package reads `process.env`;
  a pinned date, a compressor or a hyphenation provider is set explicitly
  through the exported helpers.
