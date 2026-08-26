# v1.2.0 — Charts v2, print production, and the conformance channel

> **Branch:** `release/v1.2.0` → `main`
> **Type:** Minor release (additive; one install-time floor raised)
> **pdfnative:** peer floor `^1.6.0` → **`^1.7.0`**
> **Node:** `>=22` (unchanged)

## Summary

Tracks the `pdfnative` engine's 1.7.0 release and delivers the one capability
this package had promised in writing (`docs/CHARTS.md`: Charts v2 "reach this
package as new `ChartProps` fields"), plus print production, the PDF/A
conformance diagnostics channel, seven new lint rules (18 → 25), and the
quality backlog deferred from the 1.1.0 review (`cacheControl`/`etag` on
`renderToResponse`, `ErrorOptions`/`cause`, `eslint-plugin-react-hooks`,
`validateSpec` fuzzing, the PDF/UA round-trip test, raised coverage
thresholds). No public API was removed or changed.

## Install-time floors

| Requirement | 1.1.0 | 1.2.0 | Why |
|---|---|---|---|
| `pdfnative` (peer + devDep) | `^1.6.0` | `^1.7.0` | The four new chart kinds, `layout.print` and the diagnostics channel do not exist before 1.7.0; `ChartPropsCoversChartBlock` cannot even compile against 1.6.0 typings. `doctor()` reports a 1.6.x engine with a dedicated upgrade message (second capability probe: `validatePrintOptions`). |

## Changes

### `src/components.tsx`
- `ChartProps` + 5 projections (`axis2`, `xAxis`, `dataLabels`, `labelStride`,
  `labelRotation`), each typed as `ChartBlock['…']` so future inner-shape
  changes absorb automatically. The `ChartType` widening (5 → 9), `axis.scale`
  and `ChartSeries.xValues`/`yAxis` flowed through the existing projections
  with zero code. The `ChartPropsCoversChartBlock` compile lock forced all of
  this on peer bump — exactly its design intent; its docblock now records the
  first firing.
- `DocumentProps.print?: PrintOptions` — new sugar prop (watermark/attachments
  precedent).
- `TableProps.cellVAlign` docblock corrected: omitted ≠ `'top'` (the engine
  keeps its historic baseline placement; behaviour was always right, the
  JSDoc was not).

### `src/reconciler/serialize.ts`
- Chart case forwards the five new keys through `compact()` (no compile-time
  lock covers this list — the extended golden snapshot is the guard).
- `resolveLayout` folds `print` into `layout.print`. Invariants re-pinned by
  tests: explicit `layout` wins; no sugar + no layout ⇒ `layout === undefined`.

### `src/spec/` (types, validate, compile, schema)
- `DocSpec.print` (+ `KNOWN_FIELDS`, forced by `KnownFieldsAreExhaustive`;
  `specToElement` passes it). `ChartSpecBody = ChartProps` inherited everything.
- Schema: chart builder covers the full 1.7.0 surface (9-kind enum in engine
  union order, series `xValues`/`yAxis`, `axis.scale`, `axis2`, `xAxis`,
  `dataLabels` oneOf, `labelStride` ≥ 1, `labelRotation` 0–90); `print` on the
  doc-spec schema (boxes as 4-number arrays, `userUnit` 1–75000, `bleed`
  exclusiveMinimum 0); `metadata` description names `trapped`; render-options
  layout description enumerates `print`/`outputIntent`/`strict`/`onDiagnostic`
  and the four new viewerPreferences keys, with the explicit note that
  `onDiagnostic` is function-valued and JSON-unrepresentable (`strict: true`
  is the JSON-safe switch). Link/svg opts descriptions completed
  (`fontSize`/`color`, `alt`) after the exhaustiveness audit.
- Deliberate non-additions: `outputIntent`, `strict`, `onDiagnostic` are NOT
  DocSpec top-level fields — non-JSON or niche; they remain reachable through
  the `layout` passthrough. Every added top-level field is permanent API.

### `src/registry.ts` + `src/lint.ts` (18 → 25 rules)
- `L_CHART_LOG_SCALE`, `L_CHART_X_AXIS`, `L_CHART_LABELS` (errors) — every
  Charts v2 constraint verified against the engine's `validate()` in
  `pdf-chart.ts`, reported pre-render. `L_CHART_CATEGORIES` now skips
  positional-axis charts (mirrors engine 1.7.0 exactly — the old behaviour
  would have been a false positive).
- `L_PRINT_BOXES` (error) — delegates to the engine's own
  `validatePrintOptions` (with the engine's real `PG_W`/`PG_H` defaults) in a
  try/catch; the finding carries the engine's message verbatim. Zero
  duplicated geometry rules, zero drift, by construction.
- `L_VIEWER_PRINT_RANGE` (error), `L_OUTPUT_INTENT_IGNORED` (warning — the
  engine silently ignores `outputIntent` without `tagged`),
  `L_TAGGED_FORM_FONTS` (warning — mirrors `PDFA_UNEMBEDDED_FORM_FONT`).
- Rejected rule candidates, with reasons: "scatter without `xAxis`" (does not
  throw — scatter defaults to a linear axis; verified in engine source),
  "`axis2` without a right-bound series" (silently ignored, harmless), "CMYK
  image under PDF/A" (would require parsing JPEG bytes in a pure linter; the
  engine's `PDFA_DEVICE_CMYK_IMAGE` diagnostic covers it at render time).

### `src/render.ts` + `src/response.ts`
- **Streaming pre-flight** (exhaustiveness-audit finding): the engine rejects
  `<TableOfContents>` and `{pages}` templates on its streaming path, but
  checked *inside* the generator — `renderToResponse` (streaming by default)
  failed mid-response, after status and headers were sent. `renderToStream`
  now calls the engine's `validateDocumentStreamable` eagerly; all streaming
  entries throw catchably at call time. Two regression tests pin it.
- `renderToResponse`: opt-in `cacheControl` and `etag` (string verbatim, or
  `true` to derive a strong FNV-1a validator from the bytes — implies
  buffering). Defaults byte-identical when unset.

### `src/doctor.ts`, `src/manifest.ts`, `src/core-bridge/index.ts`, `src/index.ts`
- `REQUIRED_ENGINE = '1.7.0'`; graded probe (`validatePrintOptions` → ok;
  `estimateChartHeight` only → "1.6.x — this release needs >= 1.7.0"; neither
  → missing/older).
- `contract.engine: '^1.7.0'`; new manifest entrypoint `setDeflateImpl`.
- Bridge: + `validatePrintOptions` (probe + lint delegate), `PG_W`/`PG_H`,
  `validateDocumentStreamable`, `setDeflateImpl`; − `buildDocumentPDFStream`
  (imported since 1.1.0, used nowhere — dead surface in the "small, auditable
  slice"). New type re-exports: `PrintOptions`, `PrinterMarksOptions`,
  `PageBox`, `CustomOutputIntent`, `PdfDiagnostic`, `PdfDiagnosticCode`,
  `PdfDiagnosticHandler`, `PdfColors`.
- Barrel: + `setDeflateImpl` (closes the browser-compression asymmetry with
  `initNodeCompression`) and the eight new types.

### `src/errors.ts`, `src/hooks.ts`, `eslint.config.js`
- `PdfReactError`/`PdfStructureError` accept ES2022 `ErrorOptions`
  (`error.cause` reachable; JSON envelope unchanged — asserted key-exact by a
  test).
- `eslint-plugin-react-hooks@7` (`recommended-latest`, flat config). Its two
  new rules flag the deliberate latest-value-ref and loading-flag patterns in
  `hooks.ts`; each of the four sites carries a per-site
  `eslint-disable-next-line` with the reason, keeping the rules armed for
  future code instead of a rule-wide opt-out.

### Version plumbing
`src/version.ts` → 1.2.0; `package.json`; `CITATION.cff` (+ `date-released:
2026-08-26`). Governance spec (`.github/ai-governance.json` / `governance.ts`)
stays at 1.1.0 **deliberately**: the policy content is unchanged, and bumping
a spec version without changing the spec is drift in the other direction.

## Samples & tests

- New samples (each run end-to-end, valid PDF verified):
  `samples/charts/charts-v2.tsx` (8 charts: stacked, area, scatter, time axis,
  dual axis, log scale, data labels, label rotation),
  `samples/layout/print-production.tsx` (bleed + marks, `trapped`, duplex /
  printPageRange / numCopies), `samples/quality/diagnostics.tsx`
  (onDiagnostic collector, `strict` throw, and the lint tier side by side).
  `samples/README.md` rows added.
- Tests: 226 → **292** (18 files). Charts v2 round-trips (serialization,
  DocSpec parity, real renders for all four new kinds + time/log/dual-axis),
  print sugar folding + `layout === undefined` re-pinned, one assertion per
  new lint rule (with clean-case counterparts and the positional-axis
  regression), cache-validator behaviour (deterministic ETag, merge-last),
  `cause` in-process but out of the envelope, streaming pre-flight, extended
  golden snapshot (+81/−6, the diff read before `-u`), **new**
  `tests/fuzz-validate.test.ts` (seeded PRNG, 700 malformed/mutated inputs,
  never-throws + well-formed reports), **new** `tests/pdfua.test.tsx` (render
  tagged → engine `validatePdfUA` → no violations; the 1.1.0-deferred
  round-trip).
- Coverage thresholds raised 85/80/85/85 → **90/84/92/90** (measured:
  95.0/90.0/97.8/95.9).

## Docs & governance

- Updated: `README.md` (component table, page-furniture section, "Upgrading
  to 1.2"), `llms.txt` (full 1.2.0 surface, 25-rule table, streaming
  restriction, setDeflateImpl), `docs/CHARTS.md` ("Charts v2 — a promise
  kept"), `docs/LINTING.md` (25 rules, the diagnostics channel as "tier 4½"),
  `docs/SERVER.md` ("What cannot stream", caching), `docs/KNOWLEDGE_BASE.md`
  (probes, test map, design boundaries incl. the newly-written table-builder
  exclusion rationale), `docs/AGENT_CONTRACT.md`, `docs/RECIPES.md` (PAdES
  LTV pointer), `ROADMAP.md` (1.2.0 shipped; fixed the stale "five" count),
  `CLAUDE.md`, `.github/copilot-instructions.md`.
- `release-notes/v1.2.0.md` + this draft.
- **Upstream issue draft** (found by the new PDF/UA test):
  `.github/drafts/issue-validatepdfua-embedded-fonts.md` — the engine's
  `validatePdfUA` fails to parse the engine's own output when `fontEntries`
  are embedded. `npm run verify:issue` passes on it. Human decision to submit.

## Validation

```
npm run typecheck:all   ✔ (src + tests + samples)
npm run lint            ✔ (now includes eslint-plugin-react-hooks)
npm test                ✔ 18 files, 292/292
npm run test:coverage   ✔ 95.03 / 89.95 / 97.83 / 95.90 (thresholds 90/84/92/90)
npm run build           ✔ 8 dist artifacts, tree-shake probe ok (version-only
                          bundle 3302 bytes, no reconciler), 'use client'
                          restored on client bundles, absent from root
npm audit --omit=dev --audit-level=high   ✔ 0 vulnerabilities
verify:issue on the new draft             ✔
New samples executed manually             ✔ 3/3 produce valid PDFs
```

## Adversarial review

### Round 1 — two independent exhaustiveness audits (blind to each other)

Audit A walked the engine's 445-export barrel down; audit B walked every
parity chain (JSX ↔ DocSpec ↔ schema ↔ manifest) field-by-field up. B's
verdict: parity complete, two cosmetic schema-description gaps. A's verdict:
"not exhaustive — narrowly", eight findings. All fixed or dispositioned:

| Finding (auditor) | Resolution |
|---|---|
| Streaming rejects `<TableOfContents>`/`{pages}` inside the generator — breaks `renderToResponse` mid-response, undocumented (A) | **Fixed**: eager `validateDocumentStreamable` in `renderToStream`; documented in SERVER.md, llms.txt, JSDoc (the "feature-equivalent" claim corrected); 2 regression tests |
| `setDeflateImpl` unreachable — browser `layout.compress` silently produced larger output (A) | **Fixed**: bridged + barrel + manifest + llms.txt |
| Table-centric builder (`buildPDF`/`PdfParams`) excluded without recorded rationale (A) | **Fixed**: rationale written into KNOWLEDGE_BASE §8 ("One builder, not two") |
| `PdfColors` not re-exported while `layout.colors` is documented (A) | **Fixed**: type-only re-export |
| `cellVAlign` JSDoc claimed default `'top'`; engine keeps historic baseline (A) | **Fixed**: JSDoc corrected (behaviour was always right) |
| `RenderOptions.fonts` JSDoc omitted `renderToResponse` from the honored list (A) | **Fixed** |
| svg schema description omitted `alt`; link opts omitted `fontSize`/`color` (A + B, independently) | **Fixed**: descriptions + link properties completed |
| Dead bridge import `buildDocumentPDFStream` (A) | **Fixed**: removed |

Rejected findings, with reasons:

| Rejected | Why |
|---|---|
| Surface `buildDocumentPDF` (string twin), `buildDocumentPDFStreamPageByPage`, `wrapText`, `PAGE_SIZES`, font-registry introspection helpers (A: "not-findings") | String output is a legacy shape; the page-by-page stream is superseded by the true stream; page sizes are reachable numerically; registry helpers are dev/test utilities. Concur with the auditor's own disposition. |
| Schema over-constrains `ticks` to `integer >= 2` (B, cosmetic) | Deliberate: the engine treats fewer than 2 ticks as meaningless; a tighter authoring schema that only excludes nonsense inputs is a feature, and `validateSpec` does not enforce it (opts objects stay open). |

### Round 2 — post-implementation conformity / factuality / standards panel

_Recorded below when the panel completes; every legitimate finding becomes a
commit on this branch._

## Backward compatibility

| Change | Impact |
|---|---|
| Peer floor `^1.6.0` → `^1.7.0` | Install-time only; npm refuses a stale engine at install, `doctor()` explains at runtime. Not an API change. |
| `renderToStream` validates streamability eagerly | Previously the same documents failed at first pull (or mid-response); they now fail earlier, catchably, with the same engine message. No working document is affected. |
| `etag: true` implies buffering | New opt-in option; no existing call sites. |
| Engine 1.7.0 rendering changes (RTL, `/ToUnicode`, x-label stride) | Inherited byte-level differences documented under Compatibility in the CHANGELOG; wrong-before-correct-now per the engine's release notes. |
| Coverage thresholds raised | CI-internal. |
| Everything else | Additive. Documents that use no new feature compile byte-identically (`layout === undefined` invariant re-pinned; golden snapshot diff reviewed). |

## Out of scope (by design)

- Engine 1.7.0's PAdES LTV/signing/timestamps/DSS, `PdfModifier.updateMetadata`,
  form fill/flatten, merge/split, extraction — byte-level post-processing
  (golden rule 7); `docs/RECIPES.md` points at the engine, now including the
  LTV ladder.
- The MCP server, React Native renderer, incremental compilation — ROADMAP
  "Later" (user decision on this release's scope).
- Upstream repo updates that belong to `Nizoka/pdfnative`:
  `docs/assets/ecosystem.json` (`packages.pdfnative-react.version`/`pin`) and
  `docs/data/surfaces.json` React cells must move to 1.2.0 / `^1.7.0` as part
  of the engine repo's release train, or its `verify:docs` will fail. Also the
  `validatePdfUA` bug (issue draft in `.github/drafts/`).
- ~21 open dependabot branches — separate housekeeping.

## Self-review checklist

- [x] **1.** Runtime `pdfnative` imports only via `src/core-bridge/index.ts`; `src/types.ts` type-only; peer dependency intact (test-pinned).
- [x] **2.** No CSS layout model; no new composite (`<Section>` remains the only `tag: null` entry); `print` is a prop, not a component, because it is page furniture.
- [x] **3.** Reconciler contract untouched (React 19 / `react-reconciler@^0.31` / `@types@^0.32`).
- [x] **4.** Strict TypeScript, no `any`; lint green including the new hooks plugin.
- [x] **5.** `'use client'` only via the client subpath; `src/spec/` stays pure; postbuild asserts both directions.
- [x] **6.** Full parity JSX ↔ DocSpec ↔ registry ↔ schema for every new capability; `src/version.ts` bumped; version triple + `$id`s test-pinned.
- [x] **7.** Authoring only — every 1.7.0 post-processing capability excluded and the exclusions re-audited one by one (round 1).
- [x] **8.** Draftsman, not submitter: this PR draft and the issue draft await human submission; `verify:issue` passes; no autonomous GitHub writes occurred.

## Compliance report

| Field | Value |
|---|---|
| `no_new_runtime_dependency_confirmed` | Yes — `dependencies` is still exactly `["react-reconciler"]` (test-pinned). `eslint-plugin-react-hooks` is a devDependency. |
| `reproduction_command` | `npm run typecheck:all && npm run lint && npm test && npm run build` |
| `reproduction_result` | All green: 292/292 tests, coverage 95.0/90.0/97.8/95.9, 8 dist artifacts verified. |
| `duplicate_search_performed` | Yes — CHANGELOG, ROADMAP, release notes and open drafts checked; no existing 1.2.0 work, no duplicate of the upstream issue in the engine's CHANGELOG/known issues. |
| `affected_packages` | `pdfnative-react` (this repo). Follow-ups noted for `pdfnative` (ecosystem manifest, surfaces.json, `validatePdfUA` bug). |
| `identity_reminder_shown` | This draft and the issue draft must be reviewed and submitted by a human under their own GitHub identity. No agent will open the PR or the issue. |
