# Roadmap — pdfnative-react

This roadmap is indicative, not a commitment. Priorities follow the needs of the
[pdfnative](https://www.npmjs.com/package/pdfnative) ecosystem.

## Shipped

### 0.2.0 — First implementation

- Declarative component model, custom React reconciler, four render entry
  points, client hooks/components, and the compact `DocSpec` agent layer with a
  versioned JSON Schema.

### 1.0.0 — Stable API

Marks the public API as stable and integrates the `pdfnative` engine's
authoring features through 1.5.0, plus the conveniences originally planned for
0.4.0:

- `<Section>` helper (a heading paired with grouped content).
- Convenience `resolveFonts` / `options.fonts` (register + load in one step).
- Image source helpers `fromUrl` / `fromBase64`.
- Bookmarks/outline & page labels on `<Document>`; viewer preferences and a
  layout debug overlay via `layout`; `inspectDocument` / `inspectSpec`.
- Nested lists; table `cellBorders` / `cellVAlign`; SVG `<text>` as native text.
- `renderToFileStream` (constant-memory file output).
- `pdfnative` moved to a peer dependency (`^1.5.0`).

<!-- verify-docs:allow version-token -->
### 1.1.0 — Charts, server rendering, autonomous agents

<!-- verify-docs:allow version-token -->
Tracks the engine's 1.6.0 release and closes the two adoption gaps that mattered
most: there was no first-class way to serve a PDF from a modern React server,
and no way for an AI agent to discover or check its own work.

- `<Chart>` — native vector charts (bar, barH, line, pie, donut), the one
  authoring capability pdfnative 1.6.0 adds, with full `DocSpec` parity. <!-- verify-docs:allow version-token -->
- `renderToResponse` / `renderSpecToResponse` — web-standard `Response`,
  streaming by default. Next.js App Router, Remix, Hono, Deno, Bun, Workers.
- Document-level layout sugar: `watermark`, `header`, `footer`, `attachments`,
  `tagged` — previously an undocumented `layout` pass-through.
- `lintDocument` / `lintSpec` — accessibility and layout rules with stable
  codes, eight of which pre-empt engine-level render failures.
- The agent surface: `ErrorCode` taxonomy, `capabilityManifest()`, `doctor()`,
  `validateSpec()`, multi-subject `schema()`, and the governance contract
  exported as runtime capability.
- Peer floor `^1.6.0`; Node floor `>=22` (inherited from the engine).

<!-- verify-docs:allow version-token -->
### 1.2.0 — Charts v2, print production, conformance channel

<!-- verify-docs:allow version-token -->
Tracks the engine's 1.7.0 release and closes the one capability this package
had explicitly promised (`docs/CHARTS.md`: "when they land there, they reach
this package as new `ChartProps` fields"):

- Charts v2 — `stackedBar`, `stackedBarH`, `area`, `scatter`; log and time
  scales; a secondary right axis; per-point data labels; x-label stride and
  rotation. Full `DocSpec` and schema parity.
- Print production — `<Document print>` (bleed/trim/art/crop boxes, printer's
  marks, `userUnit`), `metadata.trapped`, print-dialog viewer preferences,
  `layout.outputIntent`.
- The PDF/A conformance diagnostics channel (`layout.strict` /
  `layout.onDiagnostic`).
- Lint 18 → 25 rules (13 pre-empt engine throws), `L_PRINT_BOXES` delegating
  to the engine's own validator.
- Quality backlog from the 1.1.0 review: `renderToResponse`
  `cacheControl`/`etag`, `ErrorOptions`/`cause` on the error taxonomy,
  `eslint-plugin-react-hooks`, `validateSpec` fuzzing, the PDF/UA round-trip
  test.
- Peer floor `^1.7.0`. <!-- verify-docs:allow engine-version-token -->

### 1.3.0 — Typography, CMYK & PDF/X-4, reproducible output, the hardened repository

Tracks the engine's 1.8.0 release and brings the repository to the engineering
standard of pdfnative 1.8.0, pdfnative-cli 1.5.0 and pdfnative-mcp 1.7.0: <!-- verify-docs:allow version-token -->

- Typography — `<Document typography>` / `DocSpec.typography` (twelve keys,
  all opt-in), `align="justify"`, block-level `keepWithNext` / `splittable`;
  the compile-time lock `TypographyPropsCoverTypographyOptions`.
- CMYK colours on every colour position; `print.marks.colourBars`; CMYK and
  Gray output intents; `outputIntent` as a document prop.
- PDF/X-4 — `<Document pdfx="pdfx4">` with six coherence lint rules whose
  messages are the engine's; `validatePdfX` deliberately used through the
  engine (RECIPES) and in-process by the repository's PDF/X gate.
- Reproducible bytes — `creationDate` on `<Document>` / `DocSpec`,
  `setDefaultCreationDate` re-exported, UTC dates, `{date}` follows the pin;
  proven on Linux, Windows and macOS, and by a two-time-zone test.
- 27 Unicode scripts (was 22) through `resolveFonts`; six engine helpers and <!-- verify-docs:allow stale-token; verify-docs:allow count-tokens -->
  eleven types re-exported.
- Lint 25 → 37 rules (20 pre-empt engine throws); engine input errors
  classified as `E_INPUT`.
- One gate, a byte-exact sample baseline, PDF/X-4 and veraPDF gates, nine
  hardened workflows with five required checks on three operating systems,
  verified docs (`docs/assets/ecosystem.json` + `verify:docs`), the Claude Code
  layer, `release-prepare`, the engine-surface matrix, the zero-breaking-change
  proofs (API, schema and manifest supersets; the frozen v1.2.0 samples
  compiled against the current source), publint and `@arethetypeswrong/cli`
  in the gate.
- Inherited fixes: pdfnative #74 AcroForm fields under PDF/A, #75 page count
  with a table of contents, #78 `setDeflateImpl` validation.
- Peer floor `^1.8.0`. <!-- verify-docs:allow engine-version-token -->

### 1.4.0 — Right-to-left text, spot colours, the joint PDF/A + PDF/X claim, JPEG 2000, 32 scripts

Tracks the engine's 1.9.0 release and aligns the repository with the
engineering standard of pdfnative 1.9.0:

- Right-to-left documents — `<Document direction>` / `DocSpec.direction`
  (`'auto' | 'ltr' | 'rtl'`, the 19th DocSpec field) and the per-paragraph
  `direction` override; untagged right-to-left and reordered runs carry their
  logical text as `/ActualText` (`layout.actualText: false` opts out).
- Spot colours — `print.spotColours` declarations, `{ spot, tint }` and
  `{ inks }` colour values on every colour position (the `Color` type and
  `$defs.color` widened), one ink per bar through `ChartSeries.colors`;
  two lint rules carrying the engine's throws (`L_SPOT_UNDECLARED`,
  `L_SPOT_INK_MIX`), `E_INPUT` classification.
- The joint claim — `tagged="pdfa2b" | "pdfa2u"` combines with
  `pdfx="pdfx4"`; `L_PDFX_TAGGED_CONFLICT` narrows to PDF/A-1 and PDF/A-3
  with the engine's two messages; a dual corpus entry under veraPDF and
  `validatePdfX`.
- Charts — optional `ChartSeries.label` (`Series N`), per-value
  `ChartSeries.colors` on the bar kinds (`L_CHART_SERIES_COLORS`).
- JPEG 2000 — `<Image>` and `watermark.image` accept JP2 / J2K bytes
  (`/JPXDecode`, PDF 1.5); `L_PDFA_JPX_IMAGE` mirrors `PDFA1_JPX_IMAGE` /
  `PDFA_JPX_IMAGE`; shared fixtures in `scripts/lib/jpx-fixture.ts`.
- 32 Unicode scripts (was 27): Gujarati, Gurmukhi, Kannada, Malayalam and
  Odia through `resolveFonts`; `fonts/scripts-32` replaces `fonts/scripts-27`.
- 13 diagnostic codes (was 9); `TEXT_GLYPH_NOT_COVERED` surfaces silent
  substitutions and throws under `layout.strict` — deliberately no lint tier.
- Lint 37 → 41 rules (23 pre-empt engine throws); `doctor()` floor 1.9.0
  (probe `resolveBidiLevels`); `toErrorEnvelope` total on values without a
  primitive conversion.
- Inherited byte changes, re-anchored once: lean, compact, six-letter-tagged
  font subsets (every font-embedding sample shrinks three- to nine-fold),
  one text object per line, `/ActualText` spans, full UAX #9, deeper table
  rows for deep descenders, paginated tables of contents, the page
  transparency group of a translucent watermark; the 27 base-14-only samples
  keep their 1.3.0 hashes.
- The repository: the 1.3.0 test suite replayed against the current sources
  (`compat:previous`, a required check), frozen v1.3.0 captures beside the
  v1.2.0 ones, a `workflow lint` check (zizmor + actionlint), seven required
  checks on three operating systems, a guard → build → publish → attest
  release pipeline with blocked egress and a content-pinned npm client,
  CodeQL on the workflows themselves, a Node 26 advisory job, Dependabot
  cooldowns, fast-check property tests, the Scorecard and CodeQL findings
  triaged, every dev-tree advisory cleared.
- The engine-surface matrix rebuilt for 1.9.0 (72 bullets: 22 tested, 50
  waived with a reason) — the per-release matrix is now a shipped process.
- Peer floor `^1.9.0`.

## Later

- **React Native renderer** (separate entry point).
- **Incremental compilation** for very large documents (reuse the reconciled
  tree across renders when only data changed).
- **A visual regression tier** through an *external* rasteriser (`pdftoppm` /
  `mutool`) with PNG baselines, opt-in and skip-when-absent — the package
  bundles no rasteriser (golden rule 1), so the tier can only be advisory.
- **PDF/X-1a, PDF/X-3, PDF/X-4p and PDF/A-4** when the engine adds them;
  today `PDF_X_CONFORMANCE_TARGETS` holds `'pdfx4'` alone
  (`tests/regression/engine-surface.json`, upstream limit `pdfx-single-target`).
- **A hyphenation provider sample** — no dictionary will ever ship; a sample
  installing a Liang-pattern library through `setHyphenationProvider` would
  show the seam (upstream limit `no-bundled-hyphenation`;
  `samples/text/typography-engine.tsx` already installs an inline provider).
- **`harden-runner` block mode on every job** — 1.4.0 blocks egress on the
  release pipeline (`guard`, `publish`, `attest`) and the Node 26 job; the
  gate jobs stay in audit mode until their endpoints are baselined, and the
  Windows and macOS legs are audit-only by the vendor matrix.
- **Node 26 in the required matrix** (1.5.0) — Active LTS since 2026-10-28, run as the
  advisory `node-current` job for one release cycle first.
- **PDF/UA-1 basics** when the engine ships them (planned for pdfnative
  1.9.1: `metadata.language` → `/Lang`, per-block `lang`, borders as
  `/Artifact`) — a `<Document language>` sugar and its DocSpec twin.
- **The eslint 10 migration** — `minimatch@3.x` under eslint 9 has no fixed
  release; `@eslint/js` 10, eslint 10 and `minimatch` ≥ 11 move together.
- **A `runtimes` job** (Deno, Bun, headless Chromium smoke tests of the built
  package, as the engine runs) — a new runtime claim, not a hardening, so it
  waits for the claim.
- **An `api.json` export index** (`docs/assets/api.json`, as the engine
  publishes) — the root barrel is the per-module index today.
- **`llms-full.txt`** — the tarball ships `llms.txt`; a concatenation of the
  guides belongs on a documentation site, not in every install.
- **`tagged: true` in the three PDF/A lint rules** (1.4.1) — `true` is the
  engine's default PDF/A-2b claim; `L_TAGGED_NO_FONTS`, `L_TAGGED_FORM_FONTS`
  and `L_PDFA_JPX_IMAGE` evaluate the string levels only. Widening them is a
  lint behaviour change (a 1.3.0 test asserts the opposite), so it ships
  declared, with its compat allow-list entry, not on release day.
- **Required checks beyond the seven** — promote `codeql` and
  `dependency-review` to required contexts once their runtimes are known;
  turn on GitHub's Immutable Releases setting (no file records it; the tag
  ruleset blocks update and deletion but not creation).
- **`actions/attest-sbom`** — the SBOMs are subjects of the provenance
  attestation today; a separate SBOM-predicate attestation is the next step
  towards SLSA Build L3 (which also needs a hardened, isolated builder).
- **REUSE / SPDX headers** — `SPDX-License-Identifier` on every source file
  and a `REUSE.toml`; a tree-wide, byte-neutral change for a quiet minor.
- **Two engine observations to raise upstream** — the block-flow renderer never
  reads `layout.colors` (only `buildPDF`'s table path does), and `parsePNG`
  refuses colour types 4 and 6 (no `/SMask` split) while the engine's images
  guide describes one; the React surfaces state both limits since 1.4.0.

### Considered and dropped

- **`<Outline>` / `<Bookmark>` authoring sugar.** <!-- verify-docs:allow registry-parity --> `outline="auto"` already
  covers the common case, and an explicit `OutlineItem[]` covers the rest.
  Adding components would grow the public surface — permanently — for a
  marginal ergonomic gain.
- **Dev-mode automatic lint warnings.** `lintDocument` is deliberately pure: it
  never writes to the console. Emitting warnings implicitly would make render
  behaviour depend on `NODE_ENV` and put unrequested output in users' logs.
  Call it explicitly, in a test or a CI gate — see `samples/quality/lint.tsx`.
- **A `pdfnative-react` MCP server.** pdfnative-mcp 1.7.0 exposes 28 tools over
  the same engine, including the full document model; a second server would
  duplicate it for a JSX-shaped input agents do not produce (they emit JSON —
  which is what `DocSpec` already is). The right shape, if ever wanted, is a
  `docspec` tool inside pdfnative-mcp that validates against
  `schema('doc-spec')` and renders through this package — a request to that
  repository, not a server here.
- **Re-exporting `validatePdfX`.** Golden rule 7; one import line from the
  engine, shown in `docs/RECIPES.md`, and the repository's own PDF/X gate uses
  it that way.
- **A `<Typography>` wrapper component.** <!-- verify-docs:allow registry-parity --> Typography is a document-level
  layout option (page furniture), not a block; it is a `<Document>` prop like
  `print`.
- **A CMYK colour helper.** The engine's `parseColor` / `resolveColor` already
  do it and are one import away; a wrapper would restate their validation.
- **Reading `SOURCE_DATE_EPOCH` in the library.** A library must not read the
  process environment on behalf of its host; the pin is an explicit prop or
  `setDefaultCreationDate`. The repository scripts honour the variable; the
  package never will.

## Non-goals

- **React 18 support.** The reconciler is bound to a single, deliberately pinned
  `react-reconciler` version contract for React 19; supporting 18 and 19
  simultaneously is out of scope.
- **A CSS/flexbox box model (`<View>`).** pdfnative is a declarative block flow
  by design; we will not emulate HTML/CSS layout.
- **Byte-level post-processing.** Merging/splitting, annotations, digital
  signatures, crypto providers, and font compilation are the engine's job — use
  [`pdfnative`](https://www.npmjs.com/package/pdfnative) directly on the bytes
  this library produces.
