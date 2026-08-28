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

### `scripts/generate-pdfa-corpus.mjs` + `scripts/validate-pdfa.mjs` + `.github/workflows/verapdf.yml` (new)
- The veraPDF conformance gate, ported from the ecosystem's most mature
  implementation (`pdfnative-cli`): a 10-file manifest-driven corpus rendered
  through the **built** package (4 JSX-door + 4 DocSpec-door positives across
  pdfa1b/2b/2u/3b incl. Charts v2 dual axis and print production; 2 negative
  canaries — no-fonts, and the known engine `/Helv` form gap, self-expiring
  via fatal XPASS). Runner: strict single-`<validationReport>` parsing,
  6-outcome taxonomy, fail-closed `VERAPDF_REQUIRED=1`, `.bat`-through-shell
  quoting (CVE-2024-27980), raw-report artifacts. CI **blocking** (user
  decision; engine/CLI precedent), pinned veraPDF greenfield 1.30.2 with
  installer SHA-256 verified before `java -jar`; the same gate runs
  pre-publish in `publish.yml` before the SBOM.
- `samples/layout/page-setup.tsx` fixed: it claimed PDF/A-2b without fonts —
  non-conformant, and invisible to `L_TAGGED_NO_FONTS` (claim via
  `RenderOptions.layout`). Now embeds Noto Sans and documents the blind spot.
- `.gitignore`: root-anchored `/*.pdf` for stray sample outputs.

### Tier 5 — visual verification for vision agents (new)
- `docs/AGENT_CONTRACT.md` gains the post-render tier (`extractText` →
  `validatePdfUA`/veraPDF → rasterize + look); `docs/RECIPES.md` gains the
  matching recipe (also repairing `docs/LINTING.md`'s dangling veraPDF
  cross-reference); `llms.txt` documents it for agents;
  `samples/agent/visual-verify.tsx` runs it end to end with graceful
  degradation to the tier-4 geometry report when no rasterizer
  (`pdftoppm`/`mutool`) is installed. No dependency added — the rasterizer is
  deliberately external.

### Version plumbing
`src/version.ts` → 1.2.0; `package.json`; `CITATION.cff` (+ `date-released:
2026-08-26`). Governance spec (`.github/ai-governance.json` / `governance.ts`)
stays at 1.1.0 **deliberately**: the policy content is unchanged, and bumping
a spec version without changing the spec is drift in the other direction.

## Samples & tests

- New samples (each run end-to-end, valid PDF verified — four in total):
  `samples/charts/charts-v2.tsx` (8 charts: stacked, area, scatter, time axis,
  dual axis, log scale, data labels, label rotation),
  `samples/layout/print-production.tsx` (bleed + marks, `trapped`, duplex /
  printPageRange / numCopies), `samples/quality/diagnostics.tsx`
  (onDiagnostic collector, `strict` throw, and the lint tier side by side),
  and `samples/agent/visual-verify.tsx` (the tier-5 visual loop, described
  below). `samples/README.md` rows added.
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
  95.0/89.8/97.8/95.9).

## Docs & governance

- **`src/fonts.ts` — correctness fix found by the panel** (see round 2):
  `resolveFonts` emitted `fontRef` without the leading slash; the engine
  writes it verbatim into content streams as a PDF *name*, so every document
  produced through the documented font path (`resolveFonts` /
  `options.fonts`) was malformed (`BT latin 10 Tf`). Now normalized
  (`/`-prefix), with the sample and test expectations updated and the PDF/UA
  round-trip upgraded to the embedded-fonts configuration it originally
  could not pass.
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
- An upstream issue draft blaming the engine's `validatePdfUA` was prepared
  during test-writing and **withdrawn in round 2**: the panel's factuality
  validator could not reproduce it, and the arbiter proved by bisection that
  the failure was this package's own `fontRef` bug (above). There is no
  engine bug to report.

## Validation

```
npm run typecheck:all   ✔ (src + tests + samples)
npm run lint            ✔ (now includes eslint-plugin-react-hooks)
npm test                ✔ 18 files, 292/292
npm run test:coverage   ✔ 95.04 / 89.80 / 97.83 / 95.92 (thresholds 90/84/92/90)
npm run build           ✔ 8 dist artifacts, tree-shake probe ok (version-only
                          bundle 3354 bytes, no reconciler), 'use client'
                          restored on client bundles, absent from root
npm audit --omit=dev --audit-level=high   ✔ 0 vulnerabilities
New samples executed manually             ✔ 4/4 produce valid PDFs (incl. visual-verify
                                            with graceful no-rasterizer degradation)
npm run corpus:pdfa                       ✔ 10 files + manifest (2 negative canaries;
                                            engine diagnostics observed on both, as designed)
node scripts/validate-pdfa.mjs            ✔ canaries green; SKIPPED locally (no veraPDF/Java
                                            on the dev machine — exit 0 is a skip, not a pass;
                                            CI runs the same corpus blocking + fail-closed)
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

### Round 2 — post-implementation panel: conformity/standards, factuality, and an arbiter

Two independent validators (one on conformity and OSS/industry standards, one
on factuality — every claim executed, not read), then a third agent arbitrated
the legitimacy of every finding, resolving the one head-on contradiction **by
execution and bisection**.

The headline: the factuality validator could not reproduce the upstream
`validatePdfUA` bug the test-writing pass had reported (and drafted an issue
for), while the original observation demonstrably happened. The arbiter ran
both sides' reproductions and proved a third explanation: **the engine has no
bug — this package's `resolveFonts` emitted `fontRef` without the leading
slash**, so every document rendered through the documented font path was
genuinely malformed (`BT latin 10 Tf` — a keyword where ISO 32000 requires a
name). The validator was the messenger. One bisection table settled it:
`fontRef: '/F3'` valid, `'latin'` invalid, `'/latin'` valid, `'F3'` invalid.

| Finding (validator) | Ruling | Resolution |
|---|---|---|
| Issue draft's central claim does not reproduce (factuality) + pdfua test docblock repeats it | Legitimate symptom, wrong diagnosis (arbiter, by execution) | **Fixed**: `resolveFonts` normalizes `fontRef`; issue draft withdrawn (no engine bug); pdfua test upgraded to the embedded-fonts + `pdfa2b` configuration and its docblock rewritten; sample + test expectations updated; CHANGELOG entry with re-render guidance |
| Release work uncommitted at review start (conformity) | Legitimate | **Fixed**: committed to `release/v1.2.0` before round 2 closed (this table lands as its own commit) |
| `package-lock.json` root version still 1.1.0 (conformity) | Legitimate | **Fixed**: lockfile regenerated (both version fields 1.2.0) |
| Coverage/bundle figures drifted by a hair (both validators) | Legitimate | **Fixed**: re-measured after the round-2 fixes and pasted verbatim (95.04/89.80/97.83/95.92; 3354 bytes) |
| AGENTS.md rule 1 contradicts the sanctioned test-side engine import (conformity) | Legitimate | **Fixed**: rule 1 now scopes the bridge requirement to `src/` and names the tests exception |
| ROADMAP presented a paraphrase as a quotation (factuality) | Legitimate | **Fixed**: quotation restored verbatim |
| CHANGELOG headings carry no ISO date (conformity) | **Rejected** (arbiter) | House style since 0.1.0 is `## [x.y.z] — tagline`; dating only 1.2.0 would be inconsistent *and* break the GitHub anchors the release notes link to. If dates are ever wanted: all headings + both anchors in one housekeeping change, not mid-release. |
| `strongEtag` is FNV-1a, not cryptographic (conformity) | **Rejected — no action** (validator's own disposition, arbiter concurs) | Already documented as change-detection; HTTP strong validators need byte-identity semantics, not a cryptographic hash. |

### Round 3 — full-release control panel (post-veraPDF/vision work)

Two fresh validators re-controlled the entire release (all three commits):
validator A on conformity, project philosophy and breaking changes; validator
B on factuality (every claim executed, both ports diffed against their
pdfnative-cli source) and 2026 OSS standards. A third agent arbitrated.

**Verdicts:** A — *zero breaking changes* (the two judged cases: the
`resolveFonts` byte change corrects spec-violating output and is disclosed
with a re-render note; new lint rules add at most a *warning* on pre-existing
documents, `report.ok` preserved) and *philosophy conformant* on all 8 golden
rules. B — *factual*: both ports are logic-identical to the CLI originals
(prose-only deltas), the SHA-256 pin matches byte-for-byte, fail-closed
behaviour was executed and confirmed (exit 3 under `VERAPDF_REQUIRED=1`
without veraPDF), and the corpus/canaries behave exactly as documented.

| Finding (validator) | Ruling (arbiter) | Resolution |
|---|---|---|
| CONTRIBUTING's local Linux recipe executed the installer without the SHA-256 check CI performs (A) | Legitimate | **Fixed**: `sha256sum -c` line added — local and CI now verify the same pinned artefact |
| PR draft mis-rounded branch coverage to 90.0 in two lines while its own validation block said 89.80 (B) | Legitimate | **Fixed**: 89.8 everywhere |
| "4/4 samples" vs three named in the Samples bullet (B) | Legitimate | **Fixed**: `visual-verify.tsx` named in the bullet |
| KB's "one place a test may import pdfnative directly" overstated — font-data subpaths are a documented consumer pattern (A) | Legitimate | **Fixed**: reworded to "the engine's *API* directly" |
| `failedRules` regex in the validator is attribute-order-dependent (A) | Legitimate — keep verbatim | The verdict parse is independent and an emptied listing prints an explicit marker; fixing only here would diverge the ecosystem port. Noted as an upstream follow-up (fix in `pdfnative-cli` first, re-port everywhere). |
| `2> >(tee …)` flush race in the workflow (A) | **Rejected** | Exit code travels via `PIPESTATUS`; per-file stderr is independently written and uploaded; identical construct runs in production upstream CI. |
| `L_PRINT_BOXES` could surface a raw TypeError on a 1.6.x peer (A) | **Rejected — premise wrong** | The call already sits in the rule's try/catch, and a 1.6.x ESM peer fails at module load before lint runs; out-of-contract regardless (`doctor()` reports it). |

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
  of the engine repo's release train, or its `verify:docs` will fail.
  Optionally, an ergonomics suggestion for the engine: validate or normalize
  `fontRef` format at the API boundary, so a missing slash fails loudly
  instead of corrupting output.
- Ecosystem-wide follow-up: the veraPDF runners' `failedRules` regex (here,
  `pdfnative-cli` and `pdfnative-mcp` — all verbatim ports of the same
  original) assumes veraPDF's `<rule>` attribute order; harden it upstream in
  `pdfnative-cli` first, then re-port, so the three repos stay identical.
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
| `reproduction_result` | All green: 292/292 tests, coverage 95.0/89.8/97.8/95.9, 8 dist artifacts verified. |
| `duplicate_search_performed` | Yes — CHANGELOG, ROADMAP, release notes and open drafts checked; no existing 1.2.0 work. A drafted upstream issue was withdrawn after the panel disproved its central claim (round 2). |
| `affected_packages` | `pdfnative-react` (this repo). Follow-ups noted for `pdfnative` (ecosystem manifest, surfaces.json — doc alignment only; no engine bug). |
| `identity_reminder_shown` | This draft must be reviewed and submitted by a human under their own GitHub identity. No agent will open the PR; no issue remains to submit. |
