# Changelog

All notable changes to **pdfnative-react** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] — Typography, CMYK & PDF/X-4, reproducible output, and the hardened repository

Tracks the `pdfnative` engine's 1.8.0 release. Every 1.8.0 authoring
capability reaches both authoring doors: the typography engine
(`<Document typography>` / `DocSpec.typography` — paragraphs that split across
pages under widow and orphan rules, headings kept with what follows,
`align="justify"` with optical margins, unit and short-word binding, French
punctuation spacing, kerning, OpenType features, exact base-14 metrics), CMYK
colours on every colour prop and colour bars on the printer's marks, PDF/X-4
output (`pdfx="pdfx4"` with a CMYK or Gray output intent), a pinnable
`creationDate` that makes output byte-identical on every host, and 27 bundled
Unicode scripts. The repository adopts the engineering standard of pdfnative
1.8.0, pdfnative-cli 1.5.0 and pdfnative-mcp 1.7.0: one quality gate, a
byte-exact sample baseline held on Linux, Windows and macOS, an in-process
PDF/X-4 gate beside the blocking veraPDF gate, verified documentation,
hardened workflows, and a committed Claude Code layer.

No public API was removed or renamed; every new behaviour is opt-in, and a
document that uses none of it compiles to the same `DocumentParams` (the
golden snapshot of the 1.2.0 fixture is unchanged; four superset proofs run on
every push). One *install-time* floor was raised — see **Compatibility** first.

### Compatibility

- **Peer floor raised: `pdfnative` `^1.7.0` → `^1.8.0`.** `layout.typography`,
  `layout.pdfx`, CMYK colour operands, `print.marks.colourBars` and
  `setDeflateRawImpl` do not exist before 1.8.0; an older engine would throw
  mid-render or silently write RGB. `doctor()` now tells a 1.7.x engine apart
  (third capability probe, `setDefaultCreationDate`, probed newest-first) and
  says what to upgrade. Install-time only; not an API change.
- Rendering behaviour inherited from engine 1.8.0, with no code change here
  (each a correction of previously wrong output — see the engine's release
  note): every embedded TrueType subset changes bytes (hinting tables kept,
  `head.checkSumAdjustment` computed); printer's marks stop 0.5 pt short of
  the trim line; Indic, Khmer, Myanmar, Thai/Lao and Latin-with-combining-marks
  text takes its designed mark positions; soft hyphens no longer render
  mid-word; `/ToUnicode` maps conjuncts to their source code points. Documents
  on base-14 fonts that use none of those are byte-identical.
- **Dates are written in UTC** (`/CreationDate … +00'00'`, XMP `+00:00`). Same
  instant, different offset string; a test that asserted a local-zone offset
  needs `+00'00'`.

### Security

- Output-intent profiles are validated by the engine: a hand-made ICC stub was
  accepted as a press profile; the writer and `validatePdfX()` now require the
  `acsp` signature and a size field within the buffer. The new lint rule
  `L_OUTPUT_INTENT_PROFILE` reports it before the render. Re-check any
  `outputIntent` you built from a synthetic profile.
- `setDeflateImpl` rejects a raw-DEFLATE compressor at build time (pdfnative
  #78) — a document built with `fflate.deflateSync` was unreadable; use a
  zlib-producing function or the new `setDeflateRawImpl` (re-exported). This
  closes a silent-corruption path this package documented in 1.2.0.
- Development tree: `js-yaml` pinned to 4.3.2 (GHSA-2883-xcg3-v3hh,
  GHSA-5p4m-2wfm-xmqj), `nanoid` ≥ 3.3.18 (GHSA-2v37-7h3g-55p8),
  `brace-expansion` ≥ 1.1.18 / ≥ 5.0.9 (GHSA-mh99-v99m-4gvg,
  GHSA-rgw5-rvv9-x895) through `overrides`, and vitest / `@vitest/coverage-v8`
  4.1.11 (GHSA-82fw-gwwq-j7x9) — nothing ships to consumers;
  `npm audit --audit-level=high` is clean and blocking in CI.
- Supply chain: every workflow job starts with `step-security/harden-runner`
  (audit; skipped on macOS, where the action is unsupported), checks out with
  `persist-credentials: false`, installs with `npm ci --ignore-scripts`
  (`.npmrc` `ignore-scripts=true`), and pins every action to one commit SHA
  across the tree; new `dependency-review.yml` (fail on high, licence
  allow-list) and weekly `audit.yml`; `.github/rulesets/` commit the branch
  and tag rulesets; releases attach a CycloneDX SBOM and a build-provenance
  attestation.

### Changed

- `doctor()` requires engine ≥ 1.8.0; a 1.7.x engine is reported as
  `1.7.x — this release needs >= 1.8.0`.
- `capabilityManifest().contract.engine` is `'^1.8.0'`; the manifest gains
  `specFields` (the 18 top-level `DocSpec` fields, in contract order).
- `{date}` in `header` / `footer` follows a pinned `creationDate` (or
  `setDefaultCreationDate`) instead of the wall clock — inherited; a document
  that pins nothing is unchanged.
- `ParagraphProps.align` and `['p', …, { align }]` accept `'justify'` through
  the new `ParagraphAlign` type; `Align` (shared by image, barcode, SVG and
  chart) is **unchanged**.
- `Color` widens to admit a four-element CMYK tuple beside the 1.2.0 forms —
  additive at every input position.
- `toErrorEnvelope` classifies the engine's input errors (PDF/X coherence,
  print geometry, output intent, chart) as `E_INPUT` instead of `E_RUNTIME`,
  by the exported `ENGINE_INPUT_ERROR_PREFIXES` table; `ErrorCode` itself is
  unchanged.
- `L_OUTPUT_INTENT_IGNORED` no longer fires under `pdfx`, where the intent is
  mandatory rather than ignored.
- Test harness: vitest runs under `TZ=UTC` with `pool: 'forks'`, fixed
  timeouts and the dot reporter; node-only suites carry
  `// @vitest-environment node`; coverage thresholds unchanged (never lowered).
- `npm run validate:pdfa` no longer builds implicitly — the gate orders `build`
  → `corpus:pdfa` → `validate:pdfa`; `VERAPDF_REQUIRED=1` is replaced by the
  gate's `--require-all`. The `.mjs` corpus scripts became TypeScript run by
  `tsx` (`verify-issue.mjs` and `postbuild.mjs` stay).
- `samples/agent/visual-verify.tsx` writes to the current directory like every
  other sample (it wrote under `samples/output/`).
- `package.json` gains `typesVersions` for the `client` subpath, so consumers
  on `moduleResolution: node` resolve its types too (checked by the gate's
  `pack-check` step).

### Added

#### Typography engine (engine 1.8.0)

- `<Document typography={…}>` / `DocSpec.typography` — sugar over
  `layout.typography` in the exact mould of `print`; explicit `layout` wins;
  unset ⇒ `layout === undefined` (byte-identical). All twelve keys:
  `splitParagraphs`, `orphans`, `widows`, `keepHeadingsWithNext` (`true` |
  `{ minLines }`), `unitBinding`, `bindShortWords`, `punctuationSpacing`
  (`'fr'` | `'fr-CA'` | rules), `opticalMargins`, `metrics`, `fontFeatures`,
  `kerning`, `hyphenationLanguage`.
- `<Paragraph align="justify" keepWithNext splittable>` and
  `<Heading keepWithNext>`; DocSpec `['p', text, { align: 'justify',
  keepWithNext, splittable }]`, `['h1', text, { keepWithNext }]`; schema
  parity (`$defs.typography`, bounds and enums).
- Limits stated where they bite (JSDoc, schema descriptions, `docs/TYPOGRAPHY.md`):
  `kerning`, `fontFeatures` and the `'fr'` narrow no-break space need a
  registered font (base-14 has no GPOS/GSUB and no U+202F — `'fr'` degrades
  to `'fr-CA'`); `metrics: 'exact'` acts on base-14 text only; `tnum` / `lnum`
  change nothing on the bundled Noto Sans (`TYPOGRAPHY_FEATURE_INEFFECTIVE`);
  no hyphenation dictionary is bundled — soft hyphens are honoured, and
  `setHyphenationProvider` / `getHyphenationProvider` are re-exported.
- Type re-exports: `TypographyOptions`, `UnitBindingOptions`,
  `PunctuationSpacingRule`, `PunctuationSpacingPreset`, `Base14Metrics`,
  `HyphenationProvider`, `ParagraphAlign`.
- Compile-time lock `TypographyPropsCoverTypographyOptions` (the
  `ChartPropsCoversChartBlock` pattern), so the next engine key is a build
  error here.

#### CMYK colour and colour bars

- Every colour position (`color` on headings, paragraphs, sections and links,
  chart `colors` and series `color`, `cellBorders.color`, table `zebra`,
  watermark, header/footer `color`, `layout.colors`) accepts `[c, m, y, k]` in
  percent or `'c m y k'` (0–1) beside hex and RGB; `PdfCmykTuple` /
  `PdfCmykString` re-exported type-only; `validateSpec` and the schema
  (`$defs.color`) accept both shapes.
- `print.marks` accepts `colourBars: true | { tints, size }`
  (`ColourBarOptions`); a 5 mm bleed is recommended and linted.
- `<Document outputIntent>` / `DocSpec.outputIntent` — sugar over
  `layout.outputIntent`, now accepting CMYK and Gray profiles; RGB content
  under a non-RGB intent is remapped by the engine through `/DefaultRGB`.

#### PDF/X-4

- `<Document pdfx="pdfx4">` / `DocSpec.pdfx` — sugar over `layout.pdfx`
  (`%PDF-1.6`, the PDF/X-4 XMP identification, a `/GTS_PDFX` output intent, a
  TrimBox per page, `/Trapped`). Requires an `outputIntent` with a `prtr`
  profile (none bundled), `metadata.trapped` ≠ `'Unknown'`, embedded fonts;
  exclusive with `tagged` and `encryption`. `PdfXConformanceTarget`
  re-exported; `PDF_X_CONFORMANCE_TARGETS` used by the linter.
- New diagnostics reach `layout.onDiagnostic` / `layout.strict`:
  `PDFX_NO_FONT_ENTRIES`, `PDFX_DEVICE_CMYK`, `PDFX_ANNOTATIONS`,
  `PDFA_DEVICE_CMYK_CONTENT`, `PDFA_ICC_PROFILE_VERSION`,
  `TYPOGRAPHY_FEATURE_INEFFECTIVE` (9 diagnostic codes; `PdfDiagnosticCode` is
  additions-only).
- `validatePdfX` is **not** re-exported (golden rule 7) — `docs/RECIPES.md`
  shows the one-line engine call and states what it checks and does not; the
  repository's own PDF/X-4 corpus is validated in-process by
  `npm run validate:pdfx` (never skips).

#### Reproducible output

- `<Document creationDate>` / `DocSpec.creationDate` (a `Date` in JSX, an ISO
  8601 string in JSON; an unparseable string is `E_INPUT`, never a silent
  clock fallback) folds into `layout.creationDate`; `setDefaultCreationDate` /
  `getDefaultCreationDate` re-exported for a process-wide pin. Pinned + UTC
  dates ⇒ the same bytes on every host; the trailer `/ID` derives from the
  pin. Not covered by design: `layout.encryption` and anything applied to the
  bytes afterwards.
- **The library reads no environment variable** (`tests/tools/hermetic-env.test.ts`
  holds it); `SOURCE_DATE_EPOCH` is honoured by the repository's sample
  generator only, and the docs say so wherever they mention it.
- `renderToResponse({ etag: true })` is a stable validator across hosts when
  `creationDate` is pinned (`docs/SERVER.md`).

#### 27 scripts

- The five engine scripts of 1.8.0 (`lo`, `nod`, `khb`, `tdd`, `cjm`) and the
  four Latin aliases (`ha`, `yo`, `ig`, `sw`) work through `resolveFonts`
  unchanged; every "22 scripts" claim in the docs becomes 27;
  `samples/fonts/scripts-27.tsx` renders all nine.

#### Linting (25 → 37 rules; 20 pre-empt engine throws)

- `L_OUTPUT_INTENT_PROFILE` (error) — a malformed ICC profile (header, `acsp`,
  size field, colour space), read from the bytes without the engine.
- `L_PDFX_TARGET`, `L_PDFX_TAGGED_CONFLICT`, `L_PDFX_ENCRYPTED`,
  `L_PDFX_OUTPUT_INTENT`, `L_PDFX_TRAPPED_UNKNOWN`, `L_PDFX_BOXES` (errors) —
  the six PDF/X coherence throws, in the engine's order and with the engine's
  wording (a parity test holds each message to the throw it pre-empts).
- `L_PDFX_NO_FONTS` (error) and `L_PDFX_ANNOTATIONS` (warning) — the PDF/X
  twins of `L_TAGGED_NO_FONTS` and the annotation diagnostic.
- `L_TYPOGRAPHY_INEFFECTIVE` (warning) — a typography option that can have no
  effect as written; `L_PRINT_COLOUR_BARS` (warning) — colour bars in a bleed
  strip too thin to carry them; `L_CMYK_INTENT_MISMATCH` (warning) — CMYK
  colour under a non-CMYK PDF/A or PDF/X intent.
- A 1.2.0 document trips none of the twelve: each needs a 1.3.0 input.

#### Agent surface

- `capabilityManifest()`: `contract.engine`, six new entry points
  (`setDeflateRawImpl`, `wrapZlib`, `setDefaultCreationDate`,
  `getDefaultCreationDate`, `setHyphenationProvider`,
  `getHyphenationProvider`), twelve new lint rules, `specFields`;
  `schema('doc-spec')` describes `typography`, `pdfx`, `outputIntent`,
  `creationDate` and the CMYK colour forms.
- `src/registry.ts` gains `DOC_SPEC_FIELDS` with a compile-time lock to
  `keyof DocSpec`; `validateSpec` derives `KNOWN_FIELDS` from it.
- `docs/AGENT_CONTRACT.md` §8 "Reproducible output for agents"; tier 5 gains
  `validatePdfX`; the grammar in one table.

#### Samples

- `samples/text/typography-engine.tsx`, `samples/text/typography-french.tsx`
  (`demo-language: fr`), `samples/layout/print-pdfx4.tsx` (checked with
  `validatePdfX`), `samples/layout/cmyk.tsx`, `samples/quality/reproducible.tsx`,
  `samples/fonts/scripts-27.tsx`; `samples/quality/diagnostics.tsx` shows the
  nine codes and a `TYPOGRAPHY_FEATURE_INEFFECTIVE` example;
  `samples/agent/compact-spec.ts` uses the new DocSpec fields. Every sample is
  now part of the byte baseline.

#### Tooling, CI and repository hardening (ported from pdfnative 1.8.0 / pdfnative-cli 1.5.0 / pdfnative-mcp 1.7.0)

- **`npm run gate`** (`scripts/gate.ts`): profiles `--fast` / `--ci` /
  `--publish`, `--only`, `--from`, `--json`, `--require-all`. Steps:
  `typecheck:all` (src, tests, samples, scripts, the frozen v1.2.0 samples),
  `lint`, `test` (fast) / `build`, `dist-check`, `dist-probe`, `bundle-smoke`,
  `pack-check` (`npm pack --dry-run`, publint, `@arethetypeswrong/cli` —
  the one gate step neither sibling needs, because this is the package that
  ships a dual ESM + CJS `exports` map with per-condition types),
  `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`,
  `corpus:pdfa`, `validate:pdfx`, `validate:pdfa` (publish; skips without
  veraPDF unless `--require-all`). One line per step; logs under
  `test-output/.gate/`.
- **Byte baseline**: `npm run test:generate` runs every sample in its own
  process under `TZ=UTC` with the creation instant pinned
  (`2026-01-01T00:00:00Z`) into `test-output/samples/`; `npm run verify:samples`
  holds 38 samples to `tests/regression/baselines/samples.sha256.json`, a chain
  with a `since` per entry. First baseline: every entry anchored at 1.3.0 (no
  earlier reference exists); `fonts-prop` and `fonts-prop-sync` are identical
  by design and listed as such.
- **Two-time-zone proof**: `tests/regression/reproducible-build.test.ts`
  renders through `dist/index.js` under `Pacific/Kiritimati` and
  `America/Los_Angeles` and asserts byte identity, with the prop and with
  `setDefaultCreationDate` alone.
- **Conformance corpus 11 → 16 files**: PDF/A-2b typography and CMYK entries,
  and three PDF/X-4 files (JSX with CMYK and colour bars, DocSpec with a Gray
  intent, a negative canary) validated in-process by `scripts/validate-pdfx.ts`
  in the `ci` and `publish` profiles; veraPDF stays `publish` + `verapdf.yml`.
- **Zero-breaking-change proofs**: `tests/api-surface.test.ts` (every 1.2.0
  export and type name kept; the 1.3.0 surface snapshotted),
  `tests/schema-superset.test.ts` (every property, enum member and block branch
  of the frozen 1.2.0 schema kept; nothing became required),
  `tests/manifest-superset.test.ts` (every component, entry point, error code
  and lint rule kept with the same severity; the accepted delta is
  `contract.engine`), `npm run typecheck:compat` (the frozen v1.2.0 samples
  under `tests/regression/compat/` compiled against the current `src/`), eight
  1.2.0 fixture specs validated under both schemas.
- **Engine-surface matrix**: `tests/regression/engine-surface.json` maps every
  bullet of the engine's 1.8.0 changelog (85 items, ids shared with
  pdfnative-mcp and pdfnative-cli) to the tests and samples that exercise it
  through the renderer, or to a waiver with a reason; the test fails when the
  peer pin moves without it.
- **CI on three operating systems**: nine workflows — `ci` (Node 22/24,
  Linux) and `os` (windows-latest, macos-latest on the pinned Node line) run
  the same gate; `ci (22)`, `ci (24)`, `os (windows-latest)`,
  `os (macos-latest)`, `sample-regression` are the five required checks
  (`.github/rulesets/main.json`); `publish` (protected `npm-publish`
  environment, tag = version check, npm client pinned at 11.19.1, the publish
  gate with veraPDF, the consumer resolution smoke test, Trusted Publishing,
  CycloneDX SBOM and build-provenance attestation), `sample-regression` (no
  path filter), `verapdf`, `docs` (`verify:docs` + weekly `--online --strict`
  drift), `codeql`, `scorecard`, `dependency-review`, `audit`.
  `tests/tools/workflows.test.ts` locks the YAML.
- **Docs as code**: `docs/assets/ecosystem.json` is the source of every count
  and version; `npm run verify:docs` (27 rules — the sibling set plus
  React-specific `registry-parity`, `lint-rule-parity`, `error-code-parity`,
  `sample-index-parity`, `engine-version-token`, `peer-pin-parity`) replaces
  the hand-run grep "documentation drift gate" of AGENTS.md.
- **Claude Code layer**: committed `.claude/settings.json`
  (`attribution.commit: ""`; Read denied on the generated bulk files; HITL
  commands denied for Bash **and** PowerShell), the fail-closed
  `.claude/hooks/guard.mjs` (verbatim from the siblings,
  `tests/tools/guard.test.ts`), `.claude/rules/*.md` generated from
  `.github/instructions/*.instructions.md` (`npm run agents:rules`; three new
  instruction files: testing, security, release), `.claude/skills/release-audit/`,
  `.github/ai-governance.json` with the `claude_code` block and a split
  `sources` / `on_demand`; `CLAUDE.md` = `@AGENTS.md` + addendum; `AGENTS.md`
  ≤ 120 lines.
- **Repository hygiene**: `.npmrc` (`ignore-scripts=true`, `fund=false`,
  `audit-level=high`), `.nvmrc` / `.node-version` = 22, `.gitattributes`
  (`* text=auto eol=lf`, binaries, `linguist-generated`) with the two CRLF
  blobs renormalised, `eol-lf` as an error, opt-in git hooks
  (`npm run hooks:install`), `packageManager`, `tsconfig.scripts.json` +
  `typecheck:scripts`, `scripts/release-prepare.ts`, `release-notes/TEMPLATE.md`
  + `PR_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/maintenance.md`,
  `.github/drafts/TEMPLATE.md`, `scripts/README.md`.

### Fixed

- `.github/drafts/README.md` claimed release PR drafts are kept there; they
  live under `release-notes/draft/`.
- `CONTRIBUTING.md` described `validate:pdfa` as building implicitly and
  `VERAPDF_REQUIRED=1` as the fail-closed switch; both are now the gate.
- A stray `page-setup.pdf` at the repository root (untracked) is removed;
  `samples/agent/visual-verify.tsx` no longer writes outside the current
  directory.

### Documentation

- New guides `docs/TYPOGRAPHY.md`, `docs/PRINT.md`, `docs/REPRODUCIBLE.md`;
  README (typography, print colour and PDF/X-4, reproducible output,
  engineering, "Upgrading to 1.3"), `llms.txt`, `docs/AGENT_CONTRACT.md`,
  `docs/KNOWLEDGE_BASE.md` (§6a Reproducibility), `docs/LINTING.md` (37 rules,
  9 diagnostics), `docs/RECIPES.md` (`validatePdfX`, the creation-date pin, the
  compressor seam), `docs/CHARTS.md`, `docs/SERVER.md`, `docs/AI_GOVERNANCE.md`
  §8, `CONTRIBUTING.md` (the gate, the baseline, PDF/A + PDF/X, release,
  branch protection), `SECURITY.md` (supported lines, reproducible builds,
  supply chain), `ROADMAP.md`, `samples/README.md`, the agent files; the
  "22 scripts" claim corrected to 27 everywhere; English everywhere
  (`prose-language`; the one French sentence is the `'fr'` preset demo).
- npm and CITATION keywords for the 1.3.0 surface (typography, CMYK, PDF/X,
  reproducible builds, the new scripts, supply chain).

### Upgrade notes

1. **Rebaseline once if you compare bytes.** TrueType subsets, printer's marks
   and shaped scripts change bytes (each was previously wrong); base-14-only
   documents on a UTC host are unchanged.
2. **Dates are UTC** (`+00'00'` / `+00:00`); same instant.
3. `{date}` follows a pinned `creationDate`; unpinned documents are unchanged.
4. `setDeflateImpl` rejects raw DEFLATE — pass zlib output, or use
   `setDeflateRawImpl` (#78).
5. Hand-made ICC stubs in `outputIntent` are rejected (`acsp` + size field).
6. `PdfDiagnosticCode` gained six codes — an exhaustive `switch` with a `never`
   check needs them.
7. New lint rules add nothing to existing documents: every one needs a 1.3.0
   input to fire, so `report.ok` for a 1.2.0 document is unchanged.
8. `Color` and `ParagraphAlign` widened; `Align` unchanged. A consumer that
   reads a `Color` into a three-tuple variable needs a length guard.
9. For fork maintainers: `VERAPDF_REQUIRED=1` → `--require-all`; `.mjs` corpus
   scripts → `npx tsx scripts/<name>.ts`; `npm install` runs no lifecycle
   scripts; the drift-gate grep in AGENTS.md is replaced by `npm run verify:docs`.

### Inherited from pdfnative 1.8.0

- **#74** — AcroForm `/DR` font embedded under a PDF/A claim: `form-pdfa2b.pdf`
  in the corpus is expected compliant; `form-nofonts-pdfa2b.pdf` stays the
  canary.
- **#75** — `inspectDocument` / `inspectSpec` page count with a
  `<TableOfContents>` now matches the build (one pagination planner).
- **#78** — `setDeflateImpl` validation; the 1.2.0 advice to "inject a real
  DEFLATE implementation" is now safe.

### Deferred by design

- `validatePdfX` is not re-exported (golden rule 7; RECIPES).
- Byte-level post-processing stays with the engine (unchanged).
- A `pdfnative-react` MCP server is dropped from the roadmap (pdfnative-mcp
  covers the model); a React Native renderer, an external visual tier,
  PDF/X-1a / X-3 / PDF/A-4, a hyphenation-provider sample and harden-runner
  block mode are listed under Later.

## [1.2.0] — Charts v2, print production, and the conformance channel

Tracks the `pdfnative` engine's 1.7.0 release and delivers the "Charts v2"
capability that `docs/CHARTS.md` promised since 1.1.0 — stacked bars, area and
scatter charts, log and time scales, a secondary axis and per-point data
labels — plus print-production page geometry, the PDF/A conformance
diagnostics channel, and the quality backlog deferred from the 1.1.0 review.

No public API was removed or changed in a backward-incompatible way. One
*install-time* floor was raised — see **Compatibility** first.

### Compatibility

- **Peer floor raised: `pdfnative` `^1.6.0` → `^1.7.0`.** The new chart kinds,
  `layout.print` and the diagnostics channel do not exist before 1.7.0, so an
  older engine would throw mid-render on the new authoring surface. `doctor()`
  now distinguishes a 1.6.x engine (a dedicated error message) from a missing
  or older one, via a second capability probe (`validatePrintOptions`,
  first shipped in 1.7.0).
- Rendering behaviour inherited from engine 1.7.0, without any code change
  here: RTL digit runs keep logical order and paired delimiters mirror
  (UAX #9), Arabic/Persian letterforms join correctly, colour-emoji flag and
  ZWJ sequences resolve, form documents gain a complete `/ToUnicode` map
  (their bytes change; text becomes searchable), and crowded chart x-labels
  are strided automatically (`labelStride: 1` restores the old
  draw-everything behaviour).

### Added

#### Charts v2 (`<Chart>` / `['chart', body]`)

- Four new `chartType` values: `'stackedBar'`, `'stackedBarH'`, `'area'` and
  `'scatter'` (nine total).
- `axis.scale: 'linear' | 'log'`, and a secondary right axis via `axis2` +
  `ChartSeries.yAxis: 'left' | 'right'`.
- `xAxis` — `'category'`, `'linear'` or `'time'` (ISO-8601 / epoch ms,
  UTC-deterministic ticks), with `ChartSeries.xValues` carrying per-point
  positions.
- Per-point `dataLabels` (`true` or `{ decimals, prefix, suffix }`), and
  x-label collision control: `labelStride`, `labelRotation`.
- The `ChartPropsCoversChartBlock` compile-time lock did its job: the peer
  bump was a build error until every new `ChartBlock` field reached
  `ChartProps`, `DocSpec` and the schema.

#### Print production

- `<Document print={…}>` / `DocSpec.print` — bleed/trim/art/crop page boxes
  (or the one-line `bleed` shorthand), vector printer's marks, and
  large-format `userUnit`. Sugar over `layout.print`; an explicit `layout`
  wins, like every other sugar prop.
- `metadata.trapped` (`'True' | 'False' | 'Unknown'`) flows through the
  existing `metadata` prop.
- Print-dialog viewer preferences via `layout.viewerPreferences`: `duplex`,
  `pickTrayByPDFSize`, `printPageRange` (1-based pairs), `numCopies`.
- `layout.outputIntent` — a caller-supplied RGB ICC profile for tagged
  output (engine passthrough; see the new lint rule below for the one
  silent trap).

#### PDF/A conformance diagnostics

- `layout.strict` escalates the engine's conformance diagnostics
  (`PDFA_NO_FONT_ENTRIES`, `PDFA_UNEMBEDDED_FORM_FONT`,
  `PDFA_DEVICE_CMYK_IMAGE`) to thrown errors; `layout.onDiagnostic` receives
  them programmatically. Both are engine options reachable through every
  existing `layout` door — `onDiagnostic` is function-valued and therefore
  JSON-unrepresentable; `strict: true` is the JSON-safe switch.
- New types exported: `PrintOptions`, `PrinterMarksOptions`, `PageBox`,
  `CustomOutputIntent`, `PdfDiagnostic`, `PdfDiagnosticCode`,
  `PdfDiagnosticHandler`.

#### Linting (18 → 25 rules; 13 now pre-empt engine throws)

- `L_CHART_LOG_SCALE`, `L_CHART_X_AXIS`, `L_CHART_LABELS` — every Charts v2
  constraint the engine enforces mid-render, reported before it.
- `L_PRINT_BOXES` — print geometry, validated by delegating to the engine's
  own `validatePrintOptions`, so the finding carries the engine's message
  verbatim and can never drift from it.
- `L_VIEWER_PRINT_RANGE` — malformed `printPageRange` pairs / `numCopies`.
- `L_OUTPUT_INTENT_IGNORED` (warning) — `outputIntent` without `tagged` is a
  silent engine no-op.
- `L_TAGGED_FORM_FONTS` (warning) — a PDF/A target with form fields will
  surface the engine's `PDFA_UNEMBEDDED_FORM_FONT` diagnostic.
- `L_CHART_CATEGORIES` now skips positional-axis charts, mirroring engine
  1.7.0 exactly.

#### Server rendering

- `renderToResponse` / `renderSpecToResponse` options: `cacheControl` sets
  the `Cache-Control` header; `etag` sends a validator (a string verbatim, or
  `true` to derive a strong validator from the rendered bytes — which implies
  buffering). Defaults unchanged: no caching headers unless you opt in.

#### PDF/A conformance gate (veraPDF)

- `npm run validate:pdfa` renders an 11-file PDF/A corpus through the **built**
  package — both authoring doors (JSX and `DocSpec`), all four conformance
  targets (1b/2b/2u/3b), and this release's chart/print features — and
  validates every file with the pinned
  [veraPDF](https://verapdf.org) reference validator (greenfield 1.30.2,
  installer SHA-256-verified in CI). Two **negative canaries** the validator
  must reject guard against a validator that accepts everything; `XPASS` is
  fatal. Blocking in CI (`.github/workflows/verapdf.yml`) and in the
  pre-publish gate; without veraPDF the local runner skips with exit 0 — a
  skip, not a pass (`VERAPDF_REQUIRED=1` fails closed).
- Same runner design as `pdfnative-cli`/`pdfnative-mcp`: manifest-driven
  discovery, strict single-`<validationReport>` parsing, `.bat` launcher
  spawned through a shell with every argument quoted (CVE-2024-27980), raw
  XML reports uploaded as CI artifacts.

#### Visual verification for vision agents (dry-run tier 5)

- The agent contract gains a post-render tier: `extractText` (text truth),
  `validatePdfUA`/veraPDF (conformance truth), and — for vision-capable
  agents — **rasterize and look**: render, rasterize with a standard external
  tool (`pdftoppm`/`mutool`; nothing is bundled, no new dependency), read the
  PNG, judge against intent. Documented in `docs/AGENT_CONTRACT.md`,
  `docs/RECIPES.md` (which also fixes `docs/LINTING.md`'s dangling veraPDF
  cross-reference) and `llms.txt`; runnable with graceful degradation in
  `samples/agent/visual-verify.tsx`.

#### Environment helpers

- `setDeflateImpl` is re-exported alongside `initNodeCompression`, closing an
  asymmetry: `layout.compress` in a browser or worker silently produced
  *larger* output (stored-block fallback) with no documented way to inject a
  real DEFLATE implementation.
- `PdfColors` is re-exported type-only, so a `layout.colors` palette can be
  typed without importing the peer directly.

#### Errors

- `PdfReactError` and `PdfStructureError` accept the standard ES2022
  `ErrorOptions`, so a wrapped failure keeps its original error reachable via
  `error.cause`. The JSON envelope is unchanged (the cause may hold
  non-serializable state, so it deliberately stays out).

### Changed

- `doctor()` requires engine ≥ 1.7.0 and reports a 1.6.x engine with an
  actionable upgrade message instead of a generic failure.
- `capabilityManifest().contract.engine` is `'^1.7.0'`.

### Fixed

- **`resolveFonts` produced malformed PDFs.** It emitted `fontRef` without
  the leading slash (`latin` instead of `/latin`), and the engine writes
  `fontRef` verbatim into content streams as a PDF *name* — so every document
  rendered through the documented font path (`resolveFonts`, or the
  `options.fonts` map consumed by `renderToFile`/`renderToFileStream`/
  `renderToResponse`/`usePdf`/`usePdfStream`) contained `BT latin 10 Tf`
  where ISO 32000 requires `BT /latin 10 Tf`, malformed for conforming
  readers. `resolveFonts` now normalizes the ref (`/`-prefixing bare
  language keys). Found by the new PDF/UA round-trip test — the engine's
  `validatePdfUA` was rejecting this package's own font-embedded output.
  Hand-built `fontEntries` with a correct `/`-prefixed `fontRef` were never
  affected. Re-render anything you produced through the font map or
  `resolveFonts`.
- **Unstreamable documents now fail before the response starts.** The engine's
  streaming path rejects `<TableOfContents>` and `{pages}` header/footer
  templates (the final page count is unknown when page 1 is emitted), but ran
  that check *inside* the generator — so `renderToResponse`, which streams by
  default, surfaced the failure mid-response, after the status and headers
  were sent. `renderToStream` now runs the engine's
  `validateDocumentStreamable` eagerly, so every streaming entry point throws
  a catchable error at call time instead. Documented in `docs/SERVER.md`.
- `samples/layout/page-setup.tsx` claimed PDF/A-2b without embedding fonts —
  a genuinely non-conformant output, invisible to `L_TAGGED_NO_FONTS` because
  the claim rides on `RenderOptions.layout` rather than the `tagged` prop. It
  now embeds Noto Sans and documents the lint blind spot; the veraPDF corpus
  is what proves such files conformant for real.
- `ROADMAP.md` claimed five lint rules pre-empt engine failures where every
  other document said eight — the count the 1.1.0 drift sweep missed.
- **CI (already on `main`, first released here):** the publish workflow
  restores npm Trusted Publishing by installing an OIDC-capable npm before
  publishing — Node 22 bundles npm 10.9.x, which cannot do the OIDC exchange
  and made the v1.1.0 publish fail with an anonymous `E404`.

### Documentation

- npm discovery metadata refreshed for the 1.2.0 surface: the package
  description now names the chart engine, print production, the veraPDF gate
  and the agent surface, and `keywords` grew 42 → 68 — the print/charts/PDF-A
  clusters the ecosystem siblings already use, plus agent-discovery terms
  (`llm`, `agent-tools`, `docspec`, `capability-manifest`, `verapdf`,
  `react-pdf-alternative`). Every keyword maps to a documented capability.
- Every guide, `llms.txt`, the JSON schemas and the capability manifest now
  describe the 1.2.0 surface; `docs/CHARTS.md` closes its "Charts v2 is on
  the engine roadmap" promise with the shipped API.
- New samples: `samples/charts/charts-v2.tsx`,
  `samples/layout/print-production.tsx`, `samples/quality/diagnostics.tsx`.
- New tests: deterministic structural fuzzing of `validateSpec`, and the
  PDF/UA round-trip (render tagged output, validate it with the engine's
  `validatePdfUA`) deferred from the 1.1.0 review.

## [1.1.0] — Charts, server rendering, and an autonomous agent surface

Tracks the `pdfnative` engine's 1.6.0 release, opens three adoption paths
(server-side rendering, document-level layout sugar, linting), and completes the
agent-automation contract so an AI agent can drive the package without a human
in the loop.

No public API was removed or changed in a backward-incompatible way. Two
*install-time* floors were raised — see **Changed** first.

### Security

Both of these are engine fixes that arrive with the `^1.6.0` peer floor. They
are listed here because they affect documents **this package authored**.

- **Encrypted documents no longer leak their outline, link URIs or metadata.**
  Before engine 1.6.0, only *streams* were encrypted — strings were not. Since
  `<Document outline="auto">` derives bookmark titles from every `<Heading>`, a
  password-protected document produced by pdfnative-react disclosed its section
  headings, its `<Link url>` targets and its `metadata` to anyone opening the
  file without the password. Re-render anything you shipped with
  `layout.encryption`.
- **AES-256 output is now spec-compliant.** The engine's R6 hash substituted
  SHA-256 for every round instead of the SHA-256/384/512 rotation ISO 32000-2
  Algorithm 2.B requires, so `algorithm: 'aes256'` files written on engine
  ≤ 1.5.0 were not readable by strictly compliant readers. Output changes
  bit-for-bit; the engine's decryptor keeps a legacy fallback so old files still
  open.

### Changed

- **`pdfnative` peer floor is now `^1.6.0`** (was `^1.5.0`). `<Chart>` compiles
  to a block type that does not exist before 1.6.0; a 1.5 engine would receive
  an unknown block and silently drop or mis-render it. A loud install-time
  requirement is better than a quiet wrong PDF.
- **Node floor is now `>=22`** (was `>=20`). This is *inherited*, not invented:
  `pdfnative@1.6.0` itself requires Node ≥ 22, so any compliant install is
  already there. CI now runs on Node 22 and 24.
- `llms.txt` is now included in the published tarball (`package.json#files`), so
  an agent working from an installed package — with no repository checkout — can
  read the capability summary.

### Added

#### Charts (engine 1.6.0)

- **`<Chart>`** — native vector charts rendered as pure PDF path operators: no
  rasterisation, no chart library, no new runtime dependency. Five types
  (`bar`, `barH`, `line`, `pie`, `donut`), multi-series, legends, "nice" axis
  ticks, gridlines, point markers, palette overrides, negative values, and a
  tagged-PDF `/Figure` + `/Alt` entry.
- **`['chart', body]`** — the matching `DocSpec` tuple, a schema branch, and the
  `ChartBlock` / `ChartSeries` / `ChartType` type re-exports.

#### Server rendering

- **`renderToResponse(node, options?)`** and **`renderSpecToResponse(spec, options?)`**
  return a web-standard `Response`. Streams page by page from the engine's
  generator, so peak memory stays flat and the client receives bytes
  immediately; `buffered: true` switches to a single buffer and adds
  `Content-Length`. Handles `Content-Disposition` including RFC 6266
  `filename*` for non-ASCII names. Runs unchanged on Node, the Edge runtime,
  Deno, Bun and Cloudflare Workers.

#### Packaging — a client subpath, and two fixes that make the runtime claims true

- **New `pdfnative-react/client` export.** `usePdf`, `usePdfStream`,
  `PDFViewer`, `PDFDownloadLink` and `BlobProvider`, shipped with the
  `'use client'` directive already applied. In a React Server Components app,
  import them from there — no wrapper file of your own. The root barrel still
  exports them for apps with no RSC boundary, and is deliberately *not* marked
  as client code, because `renderToResponse` must stay server-safe.

  Note the boundary this does **not** move: importing this package from a
  Server Component or a `'use server'` file still fails, because the reconciler
  needs `createContext` and React's `react-server` condition does not provide
  it. Use a Route Handler. See [docs/SERVER.md](docs/SERVER.md).

- **The published bundle now keeps the `node:` prefix on its dynamic
  `node:fs/promises` import.** It was being rewritten to the bare specifier,
  which Deno and Cloudflare `nodejs_compat` refuse to resolve — so a wrangler or
  Vite-browser build of the very runtimes listed above failed to compile.
  `scripts/postbuild.mjs` now verifies the shipped artifacts and fails the build
  if it regresses; CI additionally bundles both artifacts the way a non-Node
  bundler would.

- **Importing pure data no longer drags in the React reconciler.**
  `import { version }` cost 10 137 bytes and forced `react-reconciler` to
  resolve; it is now 3 216 with no reconciler. Same for `validateSpec`,
  `schema()` and `capabilityManifest()`. The build fails if this regresses.

#### Document-level layout sugar

- New `<Document>` props — **`watermark`**, **`header`**, **`footer`**,
  **`attachments`**, **`tagged`** — surfacing `PdfLayoutOptions` fields that
  previously worked only as an opaque, undocumented `layout` pass-through.
  `watermark` accepts a plain string as shorthand for the common case. An
  explicit `layout` prop always wins. Mirrored on `DocSpec` and in the schema.
  A document that uses none of them still serializes with `layout: undefined`,
  so existing output is byte-identical.

#### Linting

- **`lintDocument(node, options?)`** / **`lintSpec(spec, options?)`** — eighteen
  deterministic accessibility and layout rules with stable `L_*` codes (10
  error, 7 warning, 1 info). Runs on the compiled document model, so JSX and
  `DocSpec` share one implementation. Pure: no console output, no throwing.
- **Eight** rules pre-empt an exception the engine raises mid-render: the five
  `L_CHART_*` errors (`EMPTY`, `SERIES`, `CATEGORIES`, `VALUES`, `POINTS`),
  `L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED` and `L_MAX_BLOCKS_EXCEEDED` —
  the last firing against the engine's default ceiling of 100 000 blocks even
  when you set none yourself. Two more catch output that renders successfully
  but is wrong: `L_EMPTY_DOCUMENT` (a blank page) and `L_TAGGED_NO_FONTS` (a
  PDF/A file veraPDF rejects).

#### Agent surface

- **`ErrorCode`** — a stable `E_*` taxonomy (`E_STRUCTURE`, `E_INPUT`,
  `E_UNSUPPORTED`, `E_ENV`, `E_POLICY`, `E_RUNTIME`) with a `PdfReactError`
  base class carrying `code`, a `toJSON()` producing the ecosystem's standard
  `{ ok: false, error: { code, message } }` envelope, and `toErrorEnvelope()`
  for arbitrary thrown values. `PdfStructureError` now extends `PdfReactError`
  and carries `E_STRUCTURE`; it remains importable from its original path and
  is the same class object, so `instanceof` is unaffected.
- **`capabilityManifest()`** — one call describing every component, `DocSpec`
  block, entry point, error code, lint rule and schema subject as plain JSON.
  Derived entirely from the internal registries, and a test asserts every name
  it advertises resolves to a real export.
- **`doctor()`** — environment pre-flight returning
  `{ ok, checks: [{ name, status, value, detail }] }`. Never throws — it reports
  rather than raises. The engine check is a *capability probe* rather than a
  version-string parse, so it survives bundling into a browser build and catches
  an engine that resolves but is older than 1.6.0. A peer that is absent
  *entirely* fails earlier, at module resolution, and never reaches `doctor()`.
- **`validateSpec(spec: unknown)`** — structural validation of an untrusted
  `DocSpec` with no JSON-Schema engine, returning path-anchored `V_*` findings
  (`blocks[3][1]`). Never throws, and bounds page nesting at 64 levels so a deep
  payload cannot exhaust the call stack. This is dry-run tier 1; `compileSpec`,
  `lintSpec` and `inspectSpec` are tiers 2–4.
- **`schema(subject?)`** / **`schemaId(subject?)`** — seven subjects
  (`doc-spec`, `render-options`, `lint-report`, `spec-validation`, `doctor`,
  `manifest`, `list`), each with a versioned `$id` so a caching consumer can
  detect contract drift. `docSpecSchema()` and `docSpecSchemaId()` are retained
  and delegate; a test pins the equivalence.
- **`aiGovernancePolicy()`**, **`agentRulesText()`**, **`validateIssueDraft(md)`**
  — the human-in-the-loop contract shipped as runtime capability, so an agent
  working from an installed package can read the rules it must follow. Still
  zero network, zero telemetry, zero autonomous GitHub writes.
- npm keywords extended for discovery (`ai-governance`, `hitl`, `llms-txt`,
  `rag`, `mcp`, `nextjs`, `rsc`, `accessibility`, `pdf-ua`, `charts`, …).

#### Internal — the anti-drift mechanism

- New `src/registry.ts` holds the block grammar, the component list and the
  lint rules as single-source tables. The JSON Schema, `validateSpec` and the
  capability manifest all *derive* from them rather than restating them, and
  compile-time `Assert<Equals<…>>` types make omission a build error: adding a
  member to `BlockSpec` or `HostTag` without registering it fails
  `npm run typecheck`.

### Documentation

- New guides: `docs/CHARTS.md`, `docs/SERVER.md`, `docs/LINTING.md`,
  `docs/AGENT_CONTRACT.md`, and **`docs/RECIPES.md`** — the counterpart to the
  authoring-only boundary, showing how to call the engine directly for
  `extractText`, `fillForm`/`flattenForm`, `openPdf({ password })`,
  merge/split and re-encryption on the bytes this library produces.
- `docs/KNOWLEDGE_BASE.md` gains an "Agent Automation Contract" chapter.
- 7 new samples — charts, layout sugar, a Next.js route handler, linting, and
  three agent samples (the full loop, the capability manifest, the error
  envelope). All type-checked in CI and executed end to end.

## [1.0.0] — Stable release

First stable release. The public API is now covered by semantic versioning.
This release integrates the authoring features added by the `pdfnative` engine
through 1.5.0 and ships the previously-planned 0.4.0 authoring conveniences.

### Breaking Changes

- **`pdfnative` is now a peer dependency** (`^1.5.0`) instead of a bundled
  dependency. Install it alongside the wrapper:
  `npm install pdfnative-react pdfnative react`. This lets your app control the
  engine version and matches how `pdfnative` is treated as external in the
  build. The engine floor is raised to **1.5.0**.

### Added

- **Bookmarks / outline & page labels** on `<Document>` (and `DocSpec`):
  `outline` accepts a nested `OutlineItem[]` tree or `'auto'` (derived from
  headings); `pageLabels` controls viewer page numbering. Both PDF/A-safe.
- **`<Section>`** — a composite helper pairing a heading with its grouped
  content (`title`, `level`, `color`, `break`).
- **Nested lists** — `<Item>` may nest a child `<List>`, directly nested
  `<Item>` children, or use the `items` data prop (`{ text, items }`). The
  `DocSpec` `ul`/`ol` grammar accepts the same nested items.
- **Table styling** — `cellBorders` (sides, color, width, dash style) and
  `cellVAlign`, plus per-column `ColumnDef.vAlign` and `kind: 'amount'`.
- **Layout inspection & debugging** — `inspectDocument(node)` /
  `inspectSpec(spec)` return page/block geometry without rendering, and
  `layout.debug` overlays margin/content/cell boxes.
- **Viewer preferences** — `layout.viewerPreferences` (page mode/layout,
  toolbar/menubar visibility, `displayDocTitle`, …).
- **`renderToFileStream`** / `renderSpecToFileStream` — constant-memory file
  output that preserves document-level features (outline, page labels).
- **Font convenience** — `resolveFonts(map)` registers loaders and returns
  `FontEntry[]`; the async entry points accept the loader map as `options.fonts`.
  Enables the bundled Noto Sans Math font (`'math'`) and other scripts ergonomically.
- **Image helpers** — `fromUrl(url)` and `fromBase64(payload)` produce the bytes
  `<Image>` expects.
- **`validateFontData(data)`** — opt-in, read-only structural check of a custom
  font module before embedding (`{ valid, errors, warnings }`); `FontValidationResult`
  type re-exported.
- **AI-governance / human-in-the-loop contract** (aligned with the `pdfnative`
  monorepo): `.github/ai-governance.json`, `.github/AGENT_RULES.md`,
  `.github/drafts/` staging area, [docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md),
  and a `npm run verify:issue` CLI (`scripts/verify-issue.mjs`) that validates a
  draft issue locally. AI agents act strictly as *draftsmen* — no autonomous
  GitHub writes. Covered by `tests/governance.test.ts`.
- **SVG `<text>`/`<tspan>`** now renders as native, selectable PDF text (flows
  through the existing `<Svg data>` — no API change).
- New type re-exports: `OutlineItem`, `PageLabelRange`, `PageLabelStyle`,
  `ViewerPreferences`, `LayoutDebugOptions`, `LayoutInspection`, `InspectedPage`,
  `InspectedBlock`, `CellBorders`, `ListItem`, `StreamToFileResult`, `FontsMap`,
  `FontLoader`, `FontData`, `FontValidationResult`.
- **11 new samples** covering every new feature, and matching test coverage.

### Changed

- Scope is stated explicitly: pdfnative-react covers document *authoring*.
  Byte-level post-processing (merge/split, annotations, signing, crypto
  providers, font compilation) is done with the `pdfnative` engine directly.

## [0.2.0] — First implemented release

### Added

- **Declarative component model** mapping 1:1 onto the `pdfnative` block flow:
  `Document`, `Page`, `Heading`, `Paragraph` (`Text` alias), `List`/`Item`,
  `Table`/`Row`/`Cell`, `Image`, `Link`, `Spacer`, `PageBreak`,
  `TableOfContents` (`Toc` alias), `Barcode`, `Svg`, and `FormField`.
- **Custom React reconciler** that compiles a JSX tree into a `pdfnative`
  `DocumentParams` object — no DOM, no headless browser, no native deps.
- **Render entry points**: `renderToBytes`, `renderToBlob`, `renderToStream`
  (true constant-memory streaming), `renderToFile` (Node), and `compileDocument`.
- **Client hooks**: `usePdf` (bytes / blob / object URL / `update()`),
  `usePdfStream` (streaming factory).
- **Client components**: `PDFViewer` (live `<iframe>` preview), `PDFDownloadLink`,
  and `BlobProvider` for easy migration from `@react-pdf/renderer`.
- **Compact `DocSpec` authoring** for token-frugal AI agents: terse,
  JSON-serializable block tuples that compile to the *same* PDF as the
  equivalent JSX (built on the same components). New exports `compileSpec`,
  `specToElement`, `renderSpecToBytes`/`Blob`/`Stream`/`File`, the `DocSpec`/
  `BlockSpec` types, and a versioned Draft 2020-12 JSON Schema via
  `docSpecSchema()` / `docSpecSchemaId()` (the `$id` embeds the package version).
- **Exhaustive `samples/` tree** covering every 0.2.0 capability (typography,
  tables, images, links, barcodes, SVG, form fields, multi-page structure,
  custom fonts, layout/PDF-A, the client hooks/components, and the agent spec),
  type-checked via a new `typecheck:samples` gate folded into `typecheck:all`.
- Re-exports of `pdfnative` font/environment helpers: `registerFonts`,
  `registerFont`, `loadFontData`, `downloadBlob`, `initNodeCompression`.
- `PdfStructureError` for actionable diagnostics when a tree cannot be mapped
  onto the document model.
- Full TypeScript types, dual ESM + CJS builds, and source maps.
- **Supply-chain hardening**: provenance-signed npm publishes (OIDC), a
  CycloneDX SBOM generated, archived, and attached to each GitHub Release, and
  SHA-pinned CI actions.

### Requirements

- React `^19.0.0` (peer dependency).
- Node.js `>=20`.

## [0.1.0] — Name reservation

### Added

- Placeholder release reserving the `pdfnative-react` package name on npm.

[Unreleased]: https://github.com/Nizoka/pdfnative-react/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Nizoka/pdfnative-react/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Nizoka/pdfnative-react/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/Nizoka/pdfnative-react/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Nizoka/pdfnative-react/releases/tag/v0.1.0
