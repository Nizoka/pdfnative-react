# release: v1.4.0 — Right-to-left text, spot colours, the joint PDF/A + PDF/X claim, JPEG 2000, 32 scripts

> **Branch:** `release/v1.4.0` → `main`
> **Type:** Minor release (additive, fully backward-compatible with v1.3.0)
> **pdfnative peer:** `^1.8.0` → `^1.9.0` <!-- verify-docs:allow engine-version-token -->
> **Prepared:** 2026-11-01 — release note: `release-notes/v1.4.0.md`

## Summary

For an author writing JSX: `<Document direction="auto">` sets Arabic, Hebrew, Persian or Urdu paragraphs from the right
margin (per-paragraph `direction` override, `/ActualText` on every right-to-left run); `print.spotColours` declares named
inks and `{ spot, tint }` / `{ inks }` paint with them on every colour position, including one ink per bar through
`ChartSeries.colors`; `tagged="pdfa2b"` combines with `pdfx="pdfx4"` in one file; `<Image>` and `watermark.image` take
JPEG 2000; a chart series may go unlabelled; five more Indic scripts (32 in all) load through `resolveFonts`. Every
change is opt-in and reaches both doors through `src/registry.ts`.

For an agent emitting a DocSpec: the 19th top-level field `direction`, the paragraph opt `direction`, `print.spotColours`
and the two colour object forms in `$defs.color`, series `colors` with `label` optional, `img` bytes that may be JP2 —
all described in the schema; four lint rules that are the engine's throws one tier earlier (`L_SPOT_UNDECLARED`,
`L_SPOT_INK_MIX`, `L_CHART_SERIES_COLORS`, `L_PDFA_JPX_IMAGE`), `L_PDFX_TAGGED_CONFLICT` narrowed to the two levels the
engine still refuses, 13 diagnostic codes documented (`TEXT_GLYPH_NOT_COVERED` surfaces what used to be a silent box),
`doctor()` at the 1.9.0 floor, `toErrorEnvelope` total on hostile thrown values.

For the repository: the v1.3.0 test suite replayed against the current sources (`compat:previous`, a required check),
frozen v1.3.0 captures beside the v1.2.0 ones, a `workflow lint` check (zizmor + actionlint), a guard → build → publish →
attest release pipeline with blocked egress and a content-pinned npm client, CodeQL on the workflows, a Node 26 advisory
job, Dependabot cooldowns, fast-check property tests, every dev-tree advisory cleared, the Scorecard and CodeQL findings
triaged, the engine-surface matrix rebuilt for 1.9.0 (72 bullets). ROADMAP items delivered: the engine-surface matrix
kept per release (now a shipped process), `harden-runner` block mode on the release pipeline.

Counts (`docs/assets/ecosystem.json`): 19 components, 14 block kinds, 19 DocSpec fields (18 → 19), 41 lint rules
(37 → 41), 6 error codes unchanged; samples in the baseline 38 → 42; conformance corpus 16 → 20 files (16 PDF/A,
5 PDF/X, one file claims both); tests 811 → 949 across 50 files (43 → 50); 27 → 32 Unicode scripts;
9 → 13 diagnostic codes.

## What changed

### Authoring surface (`src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/`, `src/registry.ts`)
- `DocumentProps.direction` / `ParagraphProps.direction` (engine `TextDirection`); `resolveLayout()` folds `direction`
  whole; the paragraph `direction` reaches the block only when set; `DocSpec.direction` (appended to `DOC_SPEC_FIELDS`),
  `specToElement` forwards it; schema `direction` at both levels with the engine enum.
- `Color` admits `PdfSpotColor` and `PdfInkMix`; `$defs.color` gains the two object branches; `print.spotColours` described
  in the schema; `TextDirection`, `PdfSpotColor`, `PdfInkMix`, `SpotColourDef` re-exported (`core-bridge` → `types.ts` → barrel).
- Chart series: schema `required: ['values']`, `colors` array; `ChartProps.series` JSDoc; the engine type passes through.
- `<Image>` / `['img']` / `assets.ts` document JPEG 2000 (JP2 or J2K, `/JPXDecode`, PDF 1.5); `BLOCK_REGISTRY.image.summary`.
- `tagged` / `pdfx` JSDoc and schema descriptions: the joint PDF/A-2 + PDF/X-4 claim; `Document` summary names `direction`.

### Linting, diagnostics and errors (`src/lint.ts`, `src/errors.ts`, `src/doctor.ts`, `src/manifest.ts`)
- `L_CHART_SERIES_COLORS`, `L_SPOT_UNDECLARED`, `L_SPOT_INK_MIX` (errors; the engine messages verbatim), `L_PDFA_JPX_IMAGE`
  (warning; channel facts from the engine's `parseJPX`, bridge-internal); `L_PDFX_TAGGED_CONFLICT` fires for `pdfa1b` /
  `pdfa3b` only with the two engine messages; `L_PRINT_BOXES` carries the `spotColours` declaration errors;
  `L_CMYK_INTENT_MISMATCH` counts CMYK-alternate inks; `colourPositions()` walks `series.colors`; `seriesName()` names an
  unlabelled series `Series N` in every message. 41 rules: 23 pre-empt a throw, 6 mirror a diagnostic.
- `ENGINE_INPUT_ERROR_PREFIXES` += `Spot colour`, `Ink mix`; `toErrorEnvelope` total (object tag when `String()` throws).
- `doctor()`: `REQUIRED_ENGINE` 1.9.0, probe `resolveBidiLevels` newest-first (1.8.x graded down); `contract.engine` `^1.9.0`.

### Tooling (`scripts/`)
- `scripts/run-compat.ts` (`npm run compat:previous`): the v1.3.0 suite as tagged against the current `src/`, driven by
  `tests/regression/compat/allow-v1.3.0.json` (15 exclusions with reasons; C6 and C14 for the behaviour changes); gate
  step `compat:previous` (publish profile) after `test:coverage`.
- `scripts/lib/jpx-fixture.ts` (minimal JP2 / J2K codestreams, shared by tests, the sample and the corpus);
  `scripts/lib/pdfa-corpus.ts` `Claim` gains `'both'` (`claimsPdfA` / `claimsPdfX`); four corpus entries (`jpx-pdfa1b.pdf`
  is a tracked validator gap: ISO 19005-1 forbids JPXDecode, the engine reports `PDFA1_JPX_IMAGE`, veraPDF 1.30.2 accepts);
  `generate-pdfa-corpus.ts` and `react-surface.ts` count the dual claim under both standards.
- `scripts/verify-docs.ts`: `node-pin-parity` exempts `node-current.yml` while its Node major exceeds `.nvmrc`.

### CI / repository (`.github/`, root)
- `publish.yml` rewritten as guard → build → publish → attest (blocked egress on guard / publish / attest, npm client by
  SHA-512 integrity, consumer smoke test with lockfile-pinned peers in `build`, CycloneDX + SPDX SBOMs, fetch-back and digest
  comparison, `attest-build-provenance`, `gh release upload --clobber`); `ci.yml` gains `compat-previous` and `workflow lint`
  (zizmor 1.30.1, actionlint 1.7.12 SHA-256-verified), drops `paths-ignore` and the macOS harden-runner carve-out;
  `codeql.yml` analyses `actions` + `javascript-typescript` with job-level permissions and no path filter; `node-current.yml`
  (Node 26, advisory); `scorecard.yml` v2.4.4; every audit-mode harden-runner carries a dated reason; checkout v7.0.1 /
  setup-node v7.0.0 / download-artifact v8.0.2; `setup-verapdf` hands its directory back as the `home` output.
- `.github/rulesets/main.json`: seven required contexts; `.github/dependabot.yml`: 7-day cooldowns, grouped action bumps,
  `versioning-strategy: increase-if-necessary`, `@eslint/js` majors and `react-reconciler` / `@types/react-reconciler`
  minors ignored; `CONTRIBUTING.md`, `.github/pull_request_template.md`, `release-notes/PR_TEMPLATE.md` name the new step
  and the seven checks.
- `package.json`: version 1.4.0, peer + dev `pdfnative` `^1.9.0`, vitest / `@vitest/coverage-v8` `^4.1.12`, jsdom
  `^29.1.1`, `@testing-library/dom` declared, fast-check added (dev); description and keywords refreshed (103 keywords);
  `CITATION.cff` 1.4.0 + keywords; `SECURITY.md` (advisory URL, contact, timeline, supported runtimes, compatibility
  promise, accepted Scorecard findings); `ROADMAP.md` 1.4.0 section and refreshed Later list.

### Agent layer
- `AGENTS.md` / `CLAUDE.md` (counts, engine 1.9.0, both frozen captures, `compat:previous`, Windows notes under the
  16 KiB budget), `.github/instructions/*` (direction sugar, spot colour forms, both snapshots, property tier, the seven
  checks, the four-job pipeline, the compat ledger rule) → `.claude/rules/*` regenerated; `.claude/skills/release-audit`
  blind spots (subset tag, spot declaration, the joint claim proven twice, `TEXT_GLYPH_NOT_COVERED` under strict, the
  compat allow-list as a ledger); `docs/AGENT_CONTRACT.md` (1.9.0 floor and probe, 19 fields, 41 rules, 13 codes, the
  spot-colour `E_INPUT` classification); `llms.txt`.

### Tests, samples and baselines
- New suites: `direction`, `spot-colours`, `chart-series`, `jpx-image` (+ `tests/helpers/jpx-fixture.ts`), `layout-190`,
  `diagnostics`, `fonts-32` (renamed from `fonts-27`), `property-validate`; `pdfx` gains the dual claim and the per-level
  refusals; `compile-snapshot` gains the `sinceOneNine` fixture (one snapshot added, the 1.2.0 and 1.3.0 ones unchanged);
  `registry`, `schema`, `color`, `agent`, `doctor`, `version`, `lint`, `pdfua` updated; `api-surface`, `schema-superset`,
  `manifest-superset` run over the 1.2.0 and 1.3.0 captures; `tests/tools/workflows`, `gate`, `verify-docs`,
  `react-surface` follow the tooling; `tests/regression/engine-surface.json` rebuilt for 1.9.0.
- Samples: `text/rtl-direction`, `media/image-jpx`, `layout/print-spot-colours`, `layout/print-dual-pdfa2b-pdfx4`,
  `fonts/scripts-32` (replacing `scripts-27`); `charts/charts-v2` and `quality/diagnostics` extended; `samples/README.md`.
- Baselines: `samples.sha256.json` re-anchored (15 entries at 1.4.0, 27 carried forward; provenance rewritten);
  `api-surface.v1.3.0.json`, `doc-spec.schema.v1.3.0.json`, `manifest.v1.3.0.json`, `tests/regression/compat/v1.3.0/`.

### Documentation
- README (features, furniture, right-to-left, spot colours, the joint claim, JPEG 2000, 32 scripts, Upgrading to 1.4,
  Engineering, Ecosystem with zipnative / pkinative), `llms.txt`, `docs/AGENT_CONTRACT.md`, `docs/KNOWLEDGE_BASE.md`,
  `docs/LINTING.md`, `docs/PRINT.md` (§Spot colours, the joint claim), `docs/CHARTS.md`, `docs/RECIPES.md` (link annotations,
  `extractText` + `onStreamError`, `composeLtvData`, `decodePdfTextString`), `docs/REPRODUCIBLE.md`, `docs/TYPOGRAPHY.md`,
  `SECURITY.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`, `CITATION.cff`, `release-notes/v1.4.0.md`.

## Verification

What actually ran on the release branch (Windows 11, Node 22.23.2, veraPDF 1.30.2):

| Command | Result |
|---|---|
| `npx tsx scripts/gate.ts --publish --require-all` | 15 passed, 0 skipped (typecheck:all, lint, build, dist-check, dist-probe, bundle-smoke, pack-check, test:generate, test:coverage, compat:previous, verify:docs, verify:samples, corpus:pdfa, validate:pdfx, validate:pdfa) |
| `npm run test:coverage` — tests | 949 passing across 50 files |
| `npm run test:coverage` — coverage | 96.1 % statements / 92.8 % branches / 98.2 % functions / 97.0 % lines (thresholds 90 / 84 / 92 / 90) |
| `npm run build && npm run test:generate && npm run verify:samples` | 42 tracked samples match the baseline (42 by bytes) |
| `npm run corpus:pdfa && npm run validate:pdfa` | 16 PDF/A files: 14 PASS, 2 XFAIL, 0 FAIL, 0 XPASS, 4 SKIP (the PDF/X-only files) — veraPDF 1.30.2 |
| `npm run validate:pdfx` | 5 PDF/X files: 4 PASS, 1 XFAIL (`pdfx4-nofonts.pdf`) |
| `npm run compat:previous` | 24 files, 403 cases passed, 17 deselected cases, 15 allow-list entries |
| `npm run verify:docs` | 27 rules, 0 problems |
| `npm audit --audit-level=high` | 0 high, 0 critical (11 moderate: `minimatch@3.x` under eslint 9, no fixed 3.x release) |
| `pack-check` (publint, @arethetypeswrong/cli) | every entry point resolves for node10, node16 CJS/ESM and bundler; publint clean |

Independent audit (2026-11-01, the release-audit protocol run at the maintainer's request: Auditor A — claims vs code,
46 rows; Auditor B — docs, agent surfaces, engine 1.9.0 coverage, posture, autonomy pass, 57 rows; one adversarial
verifier re-deriving every row): 0 blockers, 4 majors, 25 minors, 3 notes confirmed; 2 rows rejected (figures the
orchestrator reproduces itself), 6 duplicates. Every confirmed finding is fixed on this branch — the four majors: a spot
colour on an outline bookmark passed the schema and lint and surfaced as `E_RUNTIME` (now `$defs.processColor` +
`E_INPUT`); `layout.colors` was listed as a colour position the block-flow renderer never reads (documented, the sample
line dropped without moving a byte); `tagged: true` is the engine's default PDF/A-2b claim and was described as plain
tagging (documented; the lint widening is a declared 1.4.1 item); an alpha-channel PNG was refused as `E_RUNTIME` with
no surface naming the limit (now `E_INPUT` and stated everywhere). Verdict GO; ledger and verdict under
`.audit/1.4.0/` (git-ignored); a previous-day verifier pass (`verifier-final.md`, 14 criteria, GO) sits beside them.

## Zero-breaking-change audit

- Runtime exports: `tests/api-surface.test.ts` against `api-surface.v1.2.0.json` and `api-surface.v1.3.0.json` — 0
  removed; 4 type names added (`TextDirection`, `PdfSpotColor`, `PdfInkMix`, `SpotColourDef`), 0 runtime exports added.
- Types: `npm run typecheck:compat` compiles the frozen v1.2.0 and v1.3.0 samples against the current `src/` — 0 errors.
- JSON Schema: `tests/schema-superset.test.ts` over both captures — every property, enum member and block branch kept;
  nothing became required. The walk now enters `$defs` and every `oneOf` / `anyOf` branch, so the chart series
  `required` change (`label` became optional — a widening) and the new `outline[].color` definition (`$defs.processColor`,
  the 1.3.0 forms exactly: hex, RGB, CMYK) are inside the proof.
- Manifest and lint: `tests/manifest-superset.test.ts` over both captures — every component, entry point, error code and
  lint rule kept with the same severity; the one accepted contract delta is `engine` `^1.8.0` → `^1.9.0`. <!-- verify-docs:allow engine-version-token -->
- Behaviour: `npm run compat:previous` — the v1.3.0 suite passes against 1.4.0; the four entries that carry a ledger name
  C6 (lean subsets: byte-size assertions in `fonts-27` and `pdfua`) and C14 (the joint claim: `L_PDFX_TAGGED_CONFLICT`
  no longer fires for `pdfa2b`, in `pdfx` and `lint`; `pdfx` cites both); `tests/agent.test.tsx` is replayed with only
  its three inventory locks deselected (the audit found it excluded whole).
- Golden snapshots: `git diff --stat v1.3.0 -- tests/__snapshots__/` — additions only (one compile-snapshot fixture, the
  api-surface snapshot key moved into its describe; the obsolete copy removed).
- Error codes: unchanged (6). New `E_INPUT` prefixes: the engine's colour input (`Spot colour`, `Ink mix`, `Invalid ink
  mix`, `Invalid tint`, `Invalid spot colour`, `An outline colour`), the image decoders (`parseImage:`, `parsePNG:`,
  `parseJPEG:`, `parseJPX:`) and `Watermark transparency`; a `layout.strict` escalation stays `E_RUNTIME`, as documented.
- Type widenings (compile-time, declared in Upgrade step 7): `Color`, `ChartSeries.label`, the `LintRuleCode` /
  `DocSpecField` unions — `SECURITY.md` now states the rule (engine types re-exported may widen; the peer floor follows
  the engine minor).

## Output changes and rebaseline

- Bytes of an unchanged v1.3.0 document: identical when it embeds no font, sets no right-to-left or shaped text and
  carries no translucent watermark. Otherwise they move once, inherited from the engine (ledger C1–C3, C5, C6, C8, C9,
  C11, C14, C20–C22, C25–C28): lean, compact, six-letter-tagged subsets; one text object per line; `/ActualText` spans;
  UAX #9; deeper rows for deep descenders; paginated tables of contents; the page transparency group.
- `tests/regression/baselines/samples.sha256.json`: 10 entries re-anchored at 1.4.0 with
  `npx tsx scripts/verify-samples.ts --update` (`charts/charts-v2` — sample edit; `fonts/fonts-prop`, `fonts/fonts-prop-sync`,
  `layout/page-setup`, `layout/print-pdfx4`, `layout/watermark-header-footer`, `text/math`, `text/typography-engine`,
  `text/typography-french` — subsets, C6/C21/C25/C28; `layout/cmyk` — transparency group, C11), 1 renamed
  (`fonts/scripts-27` → `fonts/scripts-32`), 4 new, 27 unchanged (15 entries at `since: 1.4.0`, 38 → 42) — reason in
  the manifest's `provenance` note. `samples/layout/cmyk.tsx` drops its `layout.colors` line without moving a byte, which
  is the proof that the block-flow renderer never read it.
- Every item above is declared in the Upgrade section of `release-notes/v1.4.0.md`.

## Out of scope (tracked in ROADMAP.md)

- PDF/X-1a, PDF/X-3, PDF/X-4p and PDF/A-4 (upstream limit `pdfx-single-target`); a hyphenation dictionary
  (`no-bundled-hyphenation`); PDF/UA-1 basics (pdfnative 1.9.1).
- A `runtimes` job (Deno / Bun / Chromium), ClusterFuzzLite, `docs/assets/api.json`, `llms-full.txt`, the eslint 10 migration.
- Parser, signing, LTV and annotation exports — golden rule 7, recipes in `docs/RECIPES.md`.

## Dependabot pull requests and security alerts (maintainer disposition)

Every open Dependabot pull request is superseded on this branch; close them after merge: #1 (codeql-action v4 — main
already pins v4.36.0), #7 and #30 (react-reconciler 0.33 / 0.34 — React 19 binding, KB §4; minors now ignored), #8 (jsdom
29 — done here), #9 (@eslint/js 10 — major now ignored), #17 (superseded in 1.3.0), #19 (checkout v7.0.1 — pinned here),
#20 (upload-artifact v7.0.1 — already on main), #21 (scorecard-action v2.4.4 — pinned here), #22 (setup-node v7.0.0 —
pinned here), #34 (dev group — applied here without narrowing the `react` peer), #35 (source-map-js 1.2.2 — done here).
Dependabot alerts #12–#20 are fixed by the lockfile. Code-scanning: #26 fixed (`verify-docs.test.ts`); #18 fixed
(codeql job-level permissions); #23 and #24 fixed structurally (publish pipeline); #25 fixed (`SECURITY.md`); #15 clears
on the next Scorecard run; #13 addressed by the fast-check tier; #22 (attest `contents: write`) and #12 (single-maintainer
code review) are documented accepted findings — dismiss as "won't fix"; #11 (OpenSSF badge) and #1 (branch-protection
policy: reviews, admin bypass, linear history) are maintainer decisions.

## Maintainer steps after merge

Agents stop at this draft; everything below is done by the maintainer (`.github/AGENT_RULES.md`).

1. Apply the `.claude/settings.json` additions the session could not make itself (see the hand-over note): read-only
   `npm view|ls|audit` and `gh pr view|diff|list` / `gh api repos/*` in `permissions.allow`.
2. Push the branch, open the pull request with this body; **re-import `.github/rulesets/main.json` first** (the
   `compat-previous` and `workflow lint` contexts are new); wait for `ci (22)`, `ci (24)`, `os (windows-latest)`,
   `os (macos-latest)`, `compat-previous`, `workflow lint` and `sample-regression`, merge.
3. Tag `v1.4.0` on the merge commit and publish the GitHub Release (title `v1.4.0 - Right-to-left text, spot colours, the
   joint PDF/A + PDF/X claim, JPEG 2000, 32 scripts`, body = `release-notes/v1.4.0.md`).
4. Approve the `npm-publish` environment: `publish.yml` guard → build (the publish gate, the smoke test) → publish (npm
   Trusted Publishing) → attest (SBOMs and the attestation on the release). Confirm with `npm view pdfnative-react version`.
5. Close the Dependabot pull requests and dismiss the accepted Scorecard findings listed above; set the repository
   description and topics (see the hand-over note); optionally register at bestpractices.dev.
6. Update the `pdfnative-react` entry of `docs/assets/ecosystem.json` in the sibling repositories (pdfnative,
   pdfnative-cli, pdfnative-mcp — the engine's copy still says 1.3.0 / `^1.8.0`); in the engine's
   `docs/data/surfaces.json` mark `spot-colours`, `images-jpeg2000` and `rtl-direction` as supported by pdfnative-react
   from 1.4.0, add the spot forms to the `cmyk-colour` React call and `colors` / optional `label` to the `charts` React
   note, and add a row for the joint PDF/A-2 + PDF/X-4 claim. Two engine observations to raise there: the block-flow
   renderer never reads `layout.colors`, and `parsePNG` refuses colour types 4 and 6 while the images guide describes an
   `/SMask` split.
7. Repository settings the files cannot record: turn on **Immutable Releases**; decide whether `codeql` and
   `dependency-review` join the required contexts (ROADMAP).
8. The release audit ran in this session (two auditors, one adversarial verifier, ledger and verdict under
   `.audit/1.4.0/`); re-run `/release-audit release-notes/v1.4.0.md v1.3.0` before tagging if anything changed since.

## Checklist

- [x] `npm run gate` passes — the CI profile in one command (`npm run gate:fast` for a quick loop while iterating; PowerShell swallows a bare `--`, so call `npx tsx scripts/gate.ts --fast` there)
- [x] All tests pass (`npm run test`)
- [x] Type check passes (`npm run typecheck:all` — src, tests, samples, scripts and the v1.2.0 and v1.3.0 compatibility snapshots)
- [x] Lint passes (`npm run lint`)
- [x] New code has tests (coverage thresholds in `vitest.config.ts` must not regress)
- [x] No `any` types introduced
- [x] No new runtime dependency (`react-reconciler` stays the only one; `pdfnative` and `react` stay peers)
- [x] A new authoring capability reaches every wiring point: `src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/{types,compile,schema}.ts`, `src/registry.ts`, `tests/` (serialization, DocSpec parity, the golden snapshot read before `-u`), `samples/` and `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`
- [x] If samples, PDF/A or PDF/X behaviour changed: `npm run build && npm run test:generate && npm run verify:samples && npm run corpus:pdfa && npm run validate:pdfx && npm run validate:pdfa` passes locally (veraPDF installed; new claiming corpus entries bump `declared.pdfaSamples` / `declared.pdfxSamples`; an intended output change is rebaselined with `npx tsx scripts/verify-samples.ts --update` and declared in the release note)
- [x] If docs, README, llms.txt, AGENTS.md, CLAUDE.md or `.claude/` changed: `npm run verify:docs` passes
- [x] No breaking change (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` are green), or documented and versioned accordingly
- [x] `CHANGELOG.md` updated (Unreleased section) if user-facing changes
- [x] For releases: `release-notes/v1.4.0.md` and this draft written, and `npx tsx scripts/gate.ts --publish --require-all` passes locally, which runs every individual gate: `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `compat:previous`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa`
- [x] Every figure above was produced by a command on this branch, not typed from memory
- [x] `release-notes/v1.4.0.md` and the CHANGELOG entry for 1.4.0 say the same things as this body
- [x] No `Co-Authored-By` trailer and no "generated with" footer anywhere on the branch

## Compliance report

| Field | Value |
|---|---|
| `no_new_runtime_dependency_confirmed` | true — `dependencies` is still `react-reconciler` alone; `fast-check`, `@testing-library/dom` and the bumps are devDependencies |
| `reproduction_command` | `npx tsx scripts/gate.ts --publish --require-all` |
| `reproduction_result` | 15 passed, 0 skipped |
| `duplicate_search_performed` | true — no open or closed pull request for 1.4.0; the engine's 1.9.0 release note (§Downstream integration notes) is the reference; the twelve open Dependabot pull requests are superseded here |
| `affected_packages` | pdfnative-react (this release); pdfnative, pdfnative-cli, pdfnative-mcp (ecosystem manifests only) |
| `identity_reminder_shown` | true — this pull request is opened by the maintainer under their own GitHub identity, who shares responsibility for its content |
