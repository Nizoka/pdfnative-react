# v1.1.0 — Charts, server rendering, and an autonomous agent surface

> **Branch:** `release/v1.1.0` → `main`
> **Type:** Minor release. No API removed or changed; two install-time floors raised.
> **pdfnative:** `^1.6.0` (peer + dev), was `^1.5.0`
> **Node:** `>=22`, was `>=20`

## Summary

Tracks the [`pdfnative` 1.6.0](https://github.com/Nizoka/pdfnative/releases/tag/v1.6.0)
engine release, and closes the two gaps that were costing adoption: there was no
first-class way to serve a PDF from a modern React server, and no way for an AI
agent to check its environment, discover the API, or verify its own output.

Four themes:

1. **Engine 1.6.0 authoring surface** — `<Chart>`, the *only* authoring
   capability 1.6.0 adds, with full `DocSpec` parity and schema coverage.
2. **Server rendering** — `renderToResponse` / `renderSpecToResponse` returning a
   web-standard `Response`, streaming by default.
3. **Document-level layout sugar + linting** — `watermark`, `header`, `footer`,
   `attachments`, `tagged` as first-class props; and `lintDocument`/`lintSpec`,
   whose rules include five that pre-empt engine-level render failures.
4. **The agent automation contract** — `ErrorCode`, `capabilityManifest()`,
   `doctor()`, `validateSpec()`, multi-subject `schema()`, and the governance
   contract exported as runtime capability. Backed by a new single-source
   registry with compile-time anti-drift locks.

## Install-time floors (no API break, but read this)

Neither is a source-breaking change; both are install-time requirements.

- **`pdfnative` peer `^1.5.0` → `^1.6.0`.** `<Chart>` compiles to a `chart`
  block that does not exist before 1.6.0; a 1.5 engine would receive an unknown
  block and silently drop or mis-render it. A loud install error beats a quiet
  wrong PDF. The alternative (`^1.5.0 || ^1.6.0` plus a capability guard on every
  chart path) trades a build-time error for a runtime surprise.
- **Node `>=20` → `>=22`.** Inherited, not invented: `pdfnative@1.6.0` requires
  Node ≥ 22, so any compliant install is already there. CI matrix is now 22/24.

## Changes

### New: `src/registry.ts` — the anti-drift mechanism

Three single-source tables (`BLOCK_REGISTRY`, `COMPONENT_REGISTRY`,
`LINT_RULES`) that `spec/schema.ts`, `spec/validate.ts` and `manifest.ts` all
*derive* from rather than restate. Pure data; imports nothing at runtime, which
is what keeps schema emission free of the engine.

Two independent locks:

- Compile-time — `Assert<Equals<RegisteredBlockKind, BlockSpecKind>>` and the
  `HostTag` twin; plus `satisfies Record<BlockGroupId, …>` on `BLOCK_SCHEMAS`.
- Test-time — `tests/registry.test.ts` pins the exact ordered contents;
  `tests/agent.test.tsx` asserts every manifest name resolves to a real export.

**Verified destructively:** removing the `chart` entry produces two independent
compile errors (`registry.ts` `TS2344`, `schema.ts` `TS2353`) *and* fails
`tests/registry.test.ts`. If a future change leaves only one half failing, the
lock has become decorative.

### `src/core-bridge/index.ts`

- Type re-exports for `ChartBlock`/`ChartSeries`/`ChartType`, and for the layout
  sugar (`PageTemplate`, `WatermarkOptions`/`WatermarkText`/`WatermarkImage`,
  `PdfAttachment`/`PdfAttachmentRelationship`, `EncryptionOptions`).
- One new *runtime* import: `estimateChartHeight`, used **solely as a capability
  probe** by `doctor()` — it first exists in 1.6.0. Probing beats parsing a
  version string: it survives bundling into a browser build (the trap
  `pdfnative-cli` hit when tsup flattened its `require`). Deliberately not
  re-exported from the public barrel.

### `src/components.tsx`

- `<Chart>` — props mirror `ChartBlock` one-for-one.
- `<Document>` gains `watermark` (accepts a plain string as shorthand for
  `{ text: { text } }`), `header`, `footer`, `attachments`, `tagged`.

These are props, not child components, because they are document-level page
furniture; a component would mean a host tag with no corresponding pdfnative
block, which golden rule 2 forbids. `<Document>` already has precedent
(`outline`, `pageLabels`, `metadata`).

### `src/reconciler/serialize.ts` + `nodes.ts`

- `HostTag` gains `'chart'`; `toBlock` gains the `chart` case.
- New `resolveLayout()` folds the sugar props into `layout` under the engine's
  keys, with an explicit `layout` always winning — matching `prepare()`'s
  precedence in `render.ts`.
- **Critical invariant:** with no sugar and no `layout`, `resolveLayout` returns
  `undefined`, never `{}`. An empty object would change the serialized bytes of
  every existing document. Pinned by three assertions in
  `tests/layout-sugar.test.tsx`.
- `PdfStructureError` moves to `src/errors.ts` but is **re-exported from here**,
  so the original import path and class identity are preserved.

### New: `src/response.ts`

`renderToResponse(node, options?)` → `Promise<Response>`. Streams via a
`ReadableStream` over the existing `renderToStream` generator (with a `cancel`
hook so the generator cleans up on client disconnect); `buffered: true` uses
`renderToBytes` and sets `Content-Length`. RFC 6266 `Content-Disposition`
including `filename*` for non-ASCII. `async`, so `options.fonts` is honoured.

Stays on the root barrel rather than a subpath: `sideEffects: false` plus tsup
already give tree-shaking, and another `exports` condition would be cost without
benefit. No `'use client'` — this is server code.

### New: `src/lint.ts`

`lintDocument(node, options?)` → `LintReport`. Runs on the **compiled**
`DocumentParams`, so JSX and `DocSpec` share one implementation for free
(`lintSpec` is a two-line delegate, and a test asserts they agree).

Eighteen rules (10 error, 7 warning, 1 info). Six pre-empt failures the engine
raises by throwing mid-render; `L_ATTACHMENTS_NEED_PDFA3` exists because writing
`samples/layout/watermark-header-footer.tsx` hit exactly that throw, and
`L_CHART_EMPTY` because the architecture review found two more.

Pure by design: no console output, no throwing, `overflow` opt-in because it
costs a layout pass.

### New: `src/errors.ts`, `src/manifest.ts`, `src/doctor.ts`, `src/governance.ts`

- `ErrorCode` (`E_STRUCTURE`, `E_INPUT`, `E_UNSUPPORTED`, `E_ENV`, `E_POLICY`,
  `E_RUNTIME`), `PdfReactError` with `.code` and `.toJSON()`, and
  `toErrorEnvelope(unknown)` so a caller only ever handles one shape.
- `capabilityManifest()` — derived wholly from the registries.
- `doctor()` — every check wrapped; must never throw, since a missing peer is
  the case it exists to report.
- `governance.ts` — `aiGovernancePolicy`, `agentRulesText`, `validateIssueDraft`.
  The regex tables are **duplicated** from `scripts/verify-issue.mjs` because
  that script must stay zero-dependency and runnable in an unbuilt checkout;
  `tests/governance.test.ts` parses its source and asserts both tables are
  literally identical. Duplication with a proof, not with a comment.

### `src/spec/` (DocSpec parity)

- `ChartSpec` = `['chart', ChartSpecBody]` — a body object like `table`/`img`/
  `field`, since the payload is nested (`series[].values`, `axis.yMin`) and named
  keys measurably reduce generation errors.
- Five new top-level `DocSpec` fields mirroring the layout sugar.
- `schema.ts` refactored: `$defs.block.oneOf` assembled from the registry, with
  arity and descriptions sourced there too (removed from the builders, so they
  cannot disagree). Seven subjects; `docSpecSchema()`/`docSpecSchemaId()` retained
  and delegating, pinned by a `toEqual` test.
- New `spec/validate.ts` — `validateSpec(unknown)`, zero-dependency structural
  validation with path-anchored `V_*` findings. Unknown top-level fields are a
  *warning*, preserving forward compatibility.

### Samples & tests

- 7 new samples: `charts/charts.tsx`, `layout/watermark-header-footer.tsx`,
  `server/next-route-handler.tsx`, `quality/lint.tsx`, `agent/agent-loop.ts`,
  `agent/manifest.ts`, `agent/error-envelope.tsx`. All added to
  `samples/README.md` (with new "Server" and "Quality" sections) and all executed
  end to end, not just type-checked.
- 7 new test files: `registry`, `chart`, `layout-sugar`, `response`, `lint`,
  `agent`, `schema`. `governance` and `version` extended.
- **79 → 219 tests**, 8 → 15 files. Coverage improved on every axis.

### Docs & governance

- New guides: `docs/CHARTS.md`, `docs/SERVER.md`, `docs/LINTING.md`,
  `docs/AGENT_CONTRACT.md`, and **`docs/RECIPES.md`** — the counterpart to golden
  rule 7, with working code for `extractText`, `fillForm`/`flattenForm`,
  `openPdf({ password })`, merge/split and re-encryption.
- `docs/KNOWLEDGE_BASE.md` — new §9 "Agent automation contract"; §3 module map,
  §5 serialization rules and §6 test map updated.
- `README.md`, `llms.txt`, `AGENTS.md`, `CLAUDE.md`, `ROADMAP.md`,
  `CHANGELOG.md`, `CITATION.cff`, `.github/ai-governance.json` all updated.
- `AGENTS.md` gains an "adding a block kind" checklist that now routes through
  the registry, and a "recommended agent loop" section.
- **CI** — Node matrix 20/22/24 → 22/24, and a new advisory governance step that
  validates any staged draft. `ai-governance.json` declared `advisory_in_ci: true`
  but no workflow had ever run it.
- `package.json` — `files` now includes `llms.txt` (it was never shipped), and
  keywords extended for discovery.

## Validation

```
npm run typecheck:all   clean (src + tests + samples)
npm run lint            clean, zero warnings
npm test                219 passed / 219, 15 files
npm run test:coverage   95.41 stmts · 86.94 branches · 97.76 funcs · 96.32 lines
                        (thresholds 85/80/85/85 — unchanged, not lowered)
npm run build           ESM 84.9kB · CJS 87.2kB · d.ts + d.cts 66.7kB
npm pack --dry-run      llms.txt present in the tarball
```

Additionally verified by hand:

- CJS `require` and ESM `import` smoke tests against the **built** artifacts,
  covering all new exports; `doctor().ok === true`, manifest reports 14 block
  kinds, `schema()['$id']` carries `1.1.0`.
- Every new sample executed and confirmed to write a valid PDF.
- The registry lock verified destructively (see above).
- The corrected annotation recipe in `docs/RECIPES.md` executed end to end.

## Adversarial review

Two independent reviews were run before this draft: one on architecture and
state of the art, one on documentation accuracy. Both found real defects. Every
confirmed finding is fixed:

| Finding | Fix |
|---|---|
| `validateSpec` — the "never throws" untrusted-input gate — overflowed the stack on a ~44 kB deeply nested payload | Nesting bounded at 64 levels, new `V_TOO_DEEP` code, regression test at depth 5000 |
| `schema('toString')` resolved through `Object.prototype` and returned a string | `Object.hasOwn` guard; test covers five prototype keys |
| `schema('lint-report')` handed out a live reference to `LINT_RULES`; mutating the returned schema changed every subsequent lint severity process-wide | Fresh copy; regression test |
| `L_CHART_VALUES` missed an `undefined` value (`.find()` returns `undefined` for a *found* `undefined`) | `.some()`; test |
| `L_MAX_BLOCKS` reported "within 10% of the ceiling" when 5× over it, as a warning | New `L_MAX_BLOCKS_EXCEEDED` error; both tested |
| `L_HEADING_HIERARCHY` never flagged a document whose *first* heading was h2/h3 | Guard removed; test |
| Two engine throws had no lint rule (empty series, empty values) | New `L_CHART_EMPTY`; test |
| `capabilityManifest()` claimed to describe "everything" while omitting 24 of 73 exports | All added, plus `clientComponents`/`errorClasses`; a test now locks **both** directions |
| `schema.ts` hardcoded every kind discriminator, so the registry and the schema could disagree (proved: registry `h1–h4`, schema `h1–h3`, typecheck green) | `blockDefs()` overwrites the discriminator from the registry; `registry.test.ts` asserts it |
| `KNOWN_FIELDS` in `validate.ts` had no lock | `satisfies readonly (keyof DocSpec)[]` plus an `Assert<Equals<…>>` |
| `LINT_RULES` was not locked in either direction — a declared-but-unimplemented rule would ship into the schema and the manifest | New `EMITTED_LINT_RULES` + equality test |
| `Content-Disposition` `filename*` emitted `' ( ) ! *`, which are not RFC 8187 `attr-char`; a raw apostrophe mis-parses the ext-value | Percent-escaped; test |
| `docs/RECIPES.md` annotation example was wrong on both arguments and could not run | Rewritten against the real API (`createModifier(openPdf(bytes))`, `buildAnnotationBody`, `save()`) and **executed** |
| `.github/copilot-instructions.md` and `.github/instructions/spec.instructions.md` still described pre-1.1.0 architecture — no `chart`, no `registry.ts` — so an agent following them would fail the repo's own compile-time lock | Both rewritten, including the 10-step block checklist |
| `doctor()`'s headline claim ("works when the peer is missing") was false — a static re-export means the module graph fails first | Claim corrected in code and docs to what is actually true |
| `docs/SERVER.md` documented a Server Action, but RSC-layer imports fail at module load (`react-server` has no `createContext`); `'use client'` is stripped from the bundle | New "React Server Components boundary" section stating the real constraint and the wrapper pattern; README and `llms.txt` corrected |
| Hand-maintained counts wrong in six places ("five rules" over six-row tables, "6 new samples" over a list of seven) | All recounted against the code: 18 rules (10/7/1), 7 samples, 7 test files |

Findings acknowledged but **not** acted on, with reasons:

- **The two install-time floors as a minor.** One reviewer argues `^1.6.0` + Node
  `>=22` warrant a major. Neither is source-breaking, both are documented at the
  top of the release notes, and the alternative for the peer (`^1.5.0 || ^1.6.0`
  plus a capability guard on every chart path) trades a build-time error for a
  runtime surprise. Recorded here so a reviewer can overrule it.
- **Subpath exports (`./client`, `./server`).** The right long-term fix for the
  RSC boundary, but architectural rather than a patch. Documented accurately for
  1.1.0; tracked for a future release.

## Backward compatibility

| Change | Impact |
|---|---|
| Schema `$id` now `/1.1.0/` | By design — the versioned `$id` *is* the drift-detection contract |
| `params.layout` populated by sugar | Only when a sugar prop is used; `undefined` invariant preserved and tested |
| `PdfStructureError extends PdfReactError` | `instanceof` (both classes and `Error`) and `.name` unchanged |
| `PdfStructureError` moved to `errors.ts` | Same class object re-exported from the old path; identity asserted in tests |
| `docSpecSchema()` / `docSpecSchemaId()` | Retained; `toEqual` test against `schema('doc-spec')` |
| `files` += `llms.txt` | Tarball grows ~9 kB; no API impact |
| peer `^1.6.0`, Node `>=22` | Install-time only — the two friction points, headlined above |

## Out of scope (by design)

pdfnative 1.6.0 also shipped `extractText`, `readFormFields`/`fillForm`/
`flattenForm`, `openPdf({ password })`, `streamMergedPdfs`/`streamSplitPdf`/
`streamExtractPages`, and `MergeOptions.encrypt`. None are re-exported: they
operate on *existing* bytes, and this package authors documents (golden rule 7).
`docs/RECIPES.md` shows how to call each of them on the bytes we produce.

Also dropped, with reasons recorded in `ROADMAP.md`:

- `<Outline>` / `<Bookmark>` sugar — `outline="auto"` already covers the common
  case; permanent public surface for a marginal gain.
- Automatic dev-mode lint warnings — would make render behaviour depend on
  `NODE_ENV` and emit unrequested output; also would make `lintDocument` impure,
  ruling out its best use (a test assertion).

## Self-review checklist

- [x] **1.** All runtime `pdfnative` imports still go through `core-bridge`;
      `types.ts` remains the one type-only exception; `pdfnative` is still a peer.
- [x] **2.** No CSS layout model introduced. `<Chart>` maps 1:1 onto the engine's
      `chart` block; the layout sugar is `<Document>` props, not new host tags.
      `<Section>` is still the only composite.
- [x] **3.** react-reconciler contract untouched — no change to `host-config.ts`
      or `reconciler/render.ts`.
- [x] **4.** Strict TypeScript, no `any`; lint clean with zero warnings.
- [x] **5.** `'use client'` unchanged on `hooks.ts`/`viewer.tsx`; none added to
      `src/spec/`; `response.ts` is explicitly server-side.
- [x] **6.** `DocSpec` ↔ JSX parity holds — every new capability reaches both
      surfaces, with `compileSpec` `toEqual` `compileDocument` tests for charts
      and the layout sugar. `src/version.ts` bumped; `package.json` and
      `CITATION.cff` in sync (pinned by test).
- [x] **7.** Authoring only — nothing byte-level re-exported;
      `docs/RECIPES.md` added as the documented alternative.
- [x] **8.** This PR is a **draft**. No issue, PR, comment, branch push, release
      or publish was performed autonomously. A human reviews and submits it
      under their own identity.

## Compliance report

| Field | Value |
|---|---|
| `no_new_runtime_dependency_confirmed` | ✅ `dependencies` is still exactly `["react-reconciler"]`, asserted by `tests/version.test.ts` |
| `reproduction_command` | `npm run typecheck:all && npm run lint && npm run test:coverage && npm run build && npm pack --dry-run` |
| `reproduction_result` | All green; 205/205 tests; coverage above thresholds on all four axes |
| `duplicate_search_performed` | N/A — release PR, not an issue report |
| `affected_packages` | `pdfnative-react` only. Upstream `pdfnative` docs still reference `pdfnative-react v1.0.0` in `docs/guides/react.md`, `llms.txt`, `AGENTS.md` and `README.md` — a companion PR there would be worthwhile, and is **not** included here. |
| `identity_reminder_shown` | ✅ This draft must be reviewed and submitted by a human under their own GitHub identity. You share responsibility for its content. |
