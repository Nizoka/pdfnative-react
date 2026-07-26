# Agent automation contract

How an AI agent uses pdfnative-react without a human in the loop.

Everything here returns plain JSON-serializable data. Nothing in this package
reaches the network, writes to GitHub, or emits telemetry — see
[Governance](#governance) at the bottom, and `aiGovernancePolicy()` for the
machine-readable version.

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
but is **older than 1.6.0**.

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
| `contract` | The invariants: authoring-only, block-flow layout, React 19, engine `^1.6.0`, Node `>=22`, no side effects, no network |
| `components` | Every JSX component, its host tag, and its aliases |
| `specBlocks` | The whole `DocSpec` grammar: tuple form, summary, equivalent component |
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
schemaId('doc-spec');      // https://pdfnative.dev/schema/react/1.1.0/doc-spec.schema.json
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
  "blocks": [
    ["h1", "Q4 revenue review"],
    ["p", "Revenue grew 24% year over year."],
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

Eighteen rules with stable `L_*` codes (10 error, 7 warning, 1 info). **Eight**
pre-empt an exception the engine raises *mid-render*:

| Code | Would otherwise |
|---|---|
| `L_CHART_EMPTY` | Throw — no series, or a series with no values |
| `L_CHART_SERIES` | Throw — pie/donut need exactly one series |
| `L_CHART_CATEGORIES` | Throw — series length must match categories |
| `L_CHART_VALUES` | Throw — non-finite, or negative in a pie/donut |
| `L_CHART_POINTS` | Throw — 10 000-point ceiling |
| `L_ATTACHMENTS_NEED_PDFA3` | Throw — attachments require `tagged="pdfa3b"` |
| `L_TAGGED_ENCRYPTED` | Throw — PDF/A and encryption are mutually exclusive |
| `L_MAX_BLOCKS_EXCEEDED` | Throw — past `maxBlocks`, default 100 000 |

Two more catch output that renders successfully but is wrong:
`L_EMPTY_DOCUMENT` (a blank page) and `L_TAGGED_NO_FONTS` (a PDF/A file veraPDF
rejects).

Gate on `report.ok` (true when no `error`-severity finding). See
[LINTING.md](LINTING.md).

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
