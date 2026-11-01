# Agent automation contract

How an AI agent uses pdfnative-react without a human in the loop.

_Verified on 2026-11-01 against the source tree (pdfnative-react 1.4.0, pdfnative 1.9.0)._

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
but is **older than 1.9.0** — the probes run newest-first (`resolveBidiLevels`
for 1.9.0, then `setDefaultCreationDate` for 1.8.0, `validatePrintOptions` for
1.7.0 and `estimateChartHeight` for 1.6.0), so a 1.8.x engine is reported as
`1.8.x — this release needs >= 1.9.0`, a 1.7.x or 1.6.x engine gets its own
message, anything older a generic one.

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
| `contract` | The invariants: authoring-only, block-flow layout, React 19, engine `^1.9.0`, Node `>=22`, no side effects, no network |
| `components` | Every JSX component, its host tag, and its aliases |
| `specBlocks` | The whole `DocSpec` grammar: tuple form, summary, equivalent component |
| `specFields` | The 19 top-level `DocSpec` fields, in contract order |
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
schemaId('doc-spec');      // https://pdfnative.dev/schema/react/1.4.0/doc-spec.schema.json
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
| `pdfx`, `outputIntent`, `typography`, `creationDate` | the 1.3.0 layout sugar | `pdfx: 'pdfx4'`; `outputIntent.iccProfile` as bytes; `creationDate` as an ISO 8601 string; `tagged: 'pdfa2b' | 'pdfa2u'` may stand beside `pdfx` (1.4.0) |
| `direction` | the 1.4.0 layout sugar (`layout.direction`) | `'auto' | 'ltr' | 'rtl'`, the base text direction of every paragraph; the `'p'` opt of the same name overrides it per block; omitted, the bytes are those of 1.3.0 |
| `blocks` | the content | the tuples below |

`print.spotColours` (1.4.0) declares named inks —
`[{ name, alternate: [c, m, y, k] | [r, g, b] }]` — that any colour option may
then paint with: `{ spot: 'PANTONE 300 C', tint?: 0.5 }` (a `/Separation`) or
`{ inks: { 'PANTONE 300 C': 1, Varnish: 0.3 } }` (a `/DeviceN` mix).

Block tuples, by tag: `'h1'` `'h2'` `'h3'` (text, `{ color, keepWithNext }`),
`'p'` (text, `{ align: 'left' | 'center' | 'right' | 'justify', keepWithNext, splittable, direction, … }`),
`'ul'` `'ol'` (items), `'table'` (body), `'img'` (body — `data` is a JPEG, a
PNG without an alpha channel (colour types 0, 2, 3; the engine refuses 4 and
6 with `parsePNG: …`, `E_INPUT` — flatten first) or, since 1.4.0, a JPEG 2000
file or J2K codestream, passed through as `/JPXDecode`), `'link'` (text, `{ url }`),
`'sp'` (height), `'br'`, `'page'` (blocks), `'toc'`, `'qr'` `'code128'` `'ean13'`
`'pdf417'` `'datamatrix'` (data), `'svg'` (data), `'chart'` (body — a series is
`{ label?, values, color?, colors?, xValues?, yAxis? }`: `label` is optional
since 1.4.0 and `colors` gives one colour per value on the bar kinds), `'field'`
(body). `capabilityManifest().specBlocks` and `schema('doc-spec')` carry the
exact arities and option keys; every colour option accepts hex, RGB, CMYK
(`[c, m, y, k]` in percent or `'c m y k'`) and the two spot-colour forms
(`$defs.color`).

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

41 lint rules with stable `L_*` codes (26 error, 14 warning, 1 info).
**Twenty-three** pre-empt an exception the engine raises *at build time*:

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
| `L_CHART_SERIES_COLORS` | Throw — a series' `colors` length differs from its `values` (1.4.0) |
| `L_PRINT_BOXES` | Throw — invalid `layout.print` geometry or spot-colour declaration (empty/duplicate name, alternate out of range), checked by the engine's own validator |
| `L_SPOT_UNDECLARED` | Throw — a `{ spot }` / `{ inks }` colour names an ink `print.spotColours` does not declare (1.4.0) |
| `L_SPOT_INK_MIX` | Throw — an ink mix or tint the engine rejects: no inks, a tint outside 0–1, or alternates in different spaces, CMYK beside RGB (1.4.0) |
| `L_VIEWER_PRINT_RANGE` | Throw — malformed `printPageRange`/`numCopies` |
| `L_ATTACHMENTS_NEED_PDFA3` | Throw — attachments require `tagged="pdfa3b"` |
| `L_TAGGED_ENCRYPTED` | Throw — PDF/A and encryption are mutually exclusive |
| `L_MAX_BLOCKS_EXCEEDED` | Throw — past `maxBlocks`, default 100 000 |
| `L_OUTPUT_INTENT_PROFILE` | Throw — an `outputIntent.iccProfile` that is not a real ICC profile (`acsp`, size field, RGB/CMYK/Gray) |
| `L_PDFX_TARGET` | Throw — `pdfx` other than `'pdfx4'` |
| `L_PDFX_TAGGED_CONFLICT` | Throw — `pdfx` with `tagged: 'pdfa1b'` (PDF 1.4) or `'pdfa3b'` (embedded files); `'pdfa2b'` / `'pdfa2u'` combine with PDF/X-4 since 1.4.0 |
| `L_PDFX_ENCRYPTED` | Throw — `pdfx` with `layout.encryption` |
| `L_PDFX_OUTPUT_INTENT` | Throw — `pdfx` without a printer (`prtr`) output intent |
| `L_PDFX_TRAPPED_UNKNOWN` | Throw — `pdfx` with `metadata.trapped: 'Unknown'` |
| `L_PDFX_BOXES` | Throw — `pdfx` with an ArtBox beside a TrimBox source |

For the six PDF/X rules and the two spot-colour rules the finding's message
*is* the engine's message; when an agent skips the linter, the same throw
arrives through `toErrorEnvelope` as `E_INPUT`. `ENGINE_INPUT_ERROR_PREFIXES`
(the authoritative list, exported) holds every prefix: `layout.pdfx`, `PDF/X`,
`PDF/A and encryption`, `File attachments require`, `print.`, `outputIntent.`,
`layout.outputIntent`, `chart:`, `Spot colour`, `Ink mix`, `Invalid ink mix`,
`Invalid tint`, `Invalid spot colour`, `An outline colour`, `parseImage:`,
`parsePNG:`, `parseJPEG:`, `parseJPX:` and `Watermark transparency`.

Six rules mirror an engine diagnostic that becomes a throw under
`layout.strict` — `L_TAGGED_FORM_FONTS`, `L_PDFX_NO_FONTS` (an error),
`L_PDFX_ANNOTATIONS`, `L_TYPOGRAPHY_INEFFECTIVE`, `L_CMYK_INTENT_MISMATCH`
(a spot colour with a CMYK alternate counts as CMYK content),
`L_PDFA_JPX_IMAGE` (a JPEG 2000 image under PDF/A-1, or one with channels
other than 1/3/4 or an opacity channel under PDF/A-2+) — and three catch
output that renders successfully but is wrong: `L_EMPTY_DOCUMENT` (a blank
page), `L_TAGGED_NO_FONTS` (a PDF/A file veraPDF rejects) and
`L_PDFX_NO_FONTS` (a PDF/X-4 file with unembedded fonts). The engine's 13
diagnostic codes — `PDFA_NO_FONT_ENTRIES`, `PDFA_UNEMBEDDED_FORM_FONT`,
`PDFA_DEVICE_CMYK_IMAGE`, `PDFA_DEVICE_CMYK_CONTENT`,
`PDFA_ICC_PROFILE_VERSION`, `PDFX_NO_FONT_ENTRIES`, `PDFX_DEVICE_CMYK`,
`PDFX_ANNOTATIONS`, `TYPOGRAPHY_FEATURE_INEFFECTIVE`, and since engine 1.9.0
`PDFA1_JPX_IMAGE`, `PDFA_JPX_IMAGE`, `PDFA_GLYPH_WITHOUT_UNICODE` (the PDF/A-2u
ToUnicode check; nothing an author writes triggers it) and
`TEXT_GLYPH_NOT_COVERED` — reach `layout.onDiagnostic`; the JSON-safe switch
`layout.strict: true` turns them into thrown errors. `TEXT_GLYPH_NOT_COVERED`
reports a character no registered font covers — it used to render as a box or
`?` silently. It has no lint rule by design: which font covers a character is
the engine's routing, so register the covering font module (or set
`layout.strict` and let the render refuse) rather than expecting the linter
to predict it.

A 1.2.0 document trips none of the twelve rules added in 1.3.0; a 1.3.0
document trips none of the four added in 1.4.0. Gate on `report.ok` (true
when no `error`-severity finding). See [LINTING.md](LINTING.md).

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
shape. An engine build-time input error — PDF/X coherence, print geometry, an
output intent, a chart, and since 1.4.0 the colour input (an undeclared spot
ink `Spot colour '<ink>' is not declared …`, an ink mix across alternate spaces
`Ink mix …`, an empty ink name, a spot value on an outline bookmark), malformed
or unsupported image bytes (`parsePNG: alpha channel PNGs …`, `parseJPX: …`)
and a translucent watermark under PDF/A-1b — is classified `E_INPUT`; anything
else the engine throws is `E_RUNTIME`, **including a `layout.strict`
escalation of a diagnostic** (`pdfnative: TEXT_GLYPH_NOT_COVERED …`,
`PDFA1_JPX_IMAGE`, …): the message names the code and the remedy, and the
same fact reaches `layout.onDiagnostic` without `strict`.
The engine's own `PDF_STREAM_LIMIT` (`PdfStreamLimitError`, raised by
`extractText({ onStreamError })` on hostile streams) is a post-processing
error of the engine, outside this barrel — handle it where you call the engine
on the bytes ([RECIPES.md](RECIPES.md)). Runnable:
[`samples/agent/error-envelope.tsx`](../samples/agent/error-envelope.tsx).

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
- Reproducible across hosts, not across engine minors: 1.4.0 (engine 1.9.0)
  moved the bytes of every font-embedding document — lean font subsets, one
  text object per line, `/ActualText` on right-to-left and reordered runs —
  and the repository rebaselined its sample set accordingly; a base-14-only
  spec gives the same bytes as under 1.3.0. Every embedded `/BaseFont` now
  carries the six-letter subset tag (`ABCDEF+NotoSans-Regular`, bare under
  PDF/A-1): strip `^[A-Z]{6}\+` before matching font names in a
  post-processing check.

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
