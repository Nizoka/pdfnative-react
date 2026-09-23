# release: v1.3.0 — Typography, CMYK & PDF/X-4, reproducible output, and the hardened repository

> **Branch:** `release/v1.3.0` → `main`
> **Type:** Minor release (additive, fully backward-compatible with v1.2.0; one install-time floor raised)
> **pdfnative peer:** `^1.7.0` → `^1.8.0` <!-- verify-docs:allow engine-version-token -->
> **Prepared:** 2026-09-22 — release note: `release-notes/v1.3.0.md`

## Summary

For an author writing JSX, 1.3.0 exposes every authoring capability of pdfnative 1.8.0: the
typography engine as a `<Document typography>` prop (twelve opt-in keys — paragraphs that split
under widow and orphan rules, headings kept with what follows, justification with optical margins,
unit and short-word binding, French punctuation spacing, kerning, OpenType features, exact base-14
metrics) with `align="justify"`, `keepWithNext` and `splittable` on the blocks; CMYK colours on every
colour position and colour bars on the printer's marks; the PDF/X-4 conformance claim
(`pdfx="pdfx4"`) with CMYK and Gray output intents; a pinnable `creationDate` that makes the same
document render to the same bytes on every host; and 27 bundled Unicode scripts through
`resolveFonts`. Twelve new lint rules (37 in all, twenty pre-empting an engine throw with the
engine's own message) turn every new constraint into a finding before it is a throw.

For an agent emitting a `DocSpec`, the same four document-level fields (`typography`, `pdfx`,
`outputIntent`, `creationDate`) and block options arrive through the JSON Schema and
`capabilityManifest()` (`specFields`, six new entry points), with `E_INPUT` classification of the
engine's input errors and a new agent-contract section on reproducible output. Nothing was removed
or narrowed: four superset proofs run on every push.

For the repository, this release adopts the engineering standard of pdfnative 1.8.0, pdfnative-cli
1.5.0 and pdfnative-mcp 1.7.0 without reinventing it: one gate (`scripts/gate.ts`), a hermetic
sample generator and a byte baseline held on Linux, Windows and macOS, an in-process PDF/X-4 gate
beside the blocking veraPDF gate, docs-as-code (`docs/assets/ecosystem.json` + `verify:docs`, 27
rules), nine hardened workflows with five required checks, Trusted Publishing with a CycloneDX SBOM
and a build-provenance attestation, `release-prepare`, the engine-surface matrix, and the Claude
Code layer. The one extension neither sibling needs — publint and `@arethetypeswrong/cli` in the
gate — exists because this is the package that ships a dual ESM + CJS `exports` map with
per-condition types.

Counts (`docs/assets/ecosystem.json`): 19 components, 14 block kinds, 18 DocSpec fields (14 → 18),
37 lint rules (25 → 37), 6 error codes (unchanged); samples in the baseline 0 → 38 (the baseline is
created by this release); conformance corpus 11 → 16 files; tests 292 → 810 across 43 files.

## What changed

### Authoring surface (`src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/`, `src/registry.ts`)
- `DocumentProps` / `DocSpec`: `typography` (`TypographyOptions`, folded whole into `layout.typography`), `pdfx` (`'pdfx4'`), `outputIntent` (`CustomOutputIntent`, now CMYK/Gray too), `creationDate` (`Date | string` in JSX, ISO string in JSON; an unparseable string is `E_INPUT`). `resolveLayout()` keeps returning `undefined` when nothing is set.
- `HeadingProps.keepWithNext`; `ParagraphProps.align: ParagraphAlign` (`Align | 'justify'`), `keepWithNext`, `splittable`; DocSpec `['h1', text, { keepWithNext }]`, `['p', text, { align, keepWithNext, splittable }]`. `Align` stays three-valued.
- `Color` admits the four-element CMYK tuple; `PdfCmykTuple` / `PdfCmykString` and nine more types re-exported.
- `src/registry.ts`: `DOC_SPEC_FIELDS` (compile-time locked to `keyof DocSpec`; `validateSpec` and the manifest derive from it), twelve `LINT_RULES` appended, Document summary updated.
- `src/spec/schema.ts`: `$defs.color` (hex, RGB tuple, CMYK tuple, operand string) at every colour site, `$defs.typography` (twelve keys with bounds and enums), `$defs.outputIntent`, `pdfx` const, `creationDate` `format: date-time`, `colourBars` in marks, `specFields` in the manifest schema.
- Compile-time lock `TypographyPropsCoverTypographyOptions`.

### Linting, diagnostics and errors (`src/lint.ts`, `src/errors.ts`, `src/doctor.ts`, `src/manifest.ts`)
- Rules: `L_OUTPUT_INTENT_PROFILE` (ICC header read from the bytes), `L_PDFX_TARGET`, `L_PDFX_TAGGED_CONFLICT`, `L_PDFX_ENCRYPTED`, `L_PDFX_OUTPUT_INTENT`, `L_PDFX_TRAPPED_UNKNOWN`, `L_PDFX_BOXES` (the engine's six throws, same order, same wording — a parity test holds each), `L_PDFX_NO_FONTS`, `L_PDFX_ANNOTATIONS`, `L_TYPOGRAPHY_INEFFECTIVE`, `L_PRINT_COLOUR_BARS`, `L_CMYK_INTENT_MISMATCH`; `L_OUTPUT_INTENT_IGNORED` silent under `pdfx`.
- `ENGINE_INPUT_ERROR_PREFIXES` (exported): `toErrorEnvelope` classifies the engine's input errors as `E_INPUT`; `ErrorCode` unchanged.
- `doctor()`: `REQUIRED_ENGINE = '1.8.0'`, probes newest-first (`setDefaultCreationDate` → `validatePrintOptions` → `estimateChartHeight`); a 1.7.x engine is named.
- `capabilityManifest()`: `contract.engine '^1.8.0'`, six entry points (`setDeflateRawImpl`, `wrapZlib`, `setDefaultCreationDate`, `getDefaultCreationDate`, `setHyphenationProvider`, `getHyphenationProvider` — the engine's own functions, identity-tested), `specFields`.
- `src/core-bridge/index.ts`: the six helpers and `PDF_X_CONFORMANCE_TARGETS`; nothing byte-level (golden rule 7: `validatePdfX` stays an engine import).

### Tooling (`scripts/`)
- `gate.ts` — profiles `--fast` / `--ci` / `--publish`, `--only`, `--from`, `--json`, `--require-all`; inline steps `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check` (`npm pack --dry-run` file list, publint, `@arethetypeswrong/cli`).
- `generate-samples.ts` (one child process per sample: `node --import tsx --import helpers/pin-creation-date.mjs`, cwd under `test-output/samples/`, `TZ=UTC`, instant pinned), `verify-samples.ts` (chained baseline, `--update` / `--strict` / `--json`), `lib/sample-plan.ts`, `lib/sample-fingerprint.ts`.
- `generate-pdfa-corpus.ts`, `validate-pdfa.ts`, `validate-pdfx.ts` (TypeScript; the `.mjs` pair removed), `lib/pdfa-corpus.ts` (16 entries, both doors, three negative canaries), `lib/pdfx.ts`, `lib/verapdf.ts`, `lib/synthetic-icc.ts`.
- `verify-docs.ts` over `lib/react-surface.ts` (27 rules), `release-prepare.ts`, `build-claude-rules.ts`, `install-git-hooks.mjs`, `helpers/hermetic.ts` + `helpers/tz.ts` + `helpers/io.ts`, `scripts/README.md`.

### CI / repository (`.github/`, root)
- Workflows: `ci.yml` (`ci` on Node 22/24 + the `os` job on windows-latest and macos-latest, the same gate with `--require-all`, `npm audit` outside it), `publish.yml` (tag = version, npm 11.19.1 pinned, veraPDF, the publish gate, `npm pack --dry-run`, the consumer resolution smoke test, `npm publish --provenance`, the `attest` job with SBOM + provenance), `sample-regression.yml`, `verapdf.yml`, `docs.yml`, `codeql.yml`, `scorecard.yml`, `dependency-review.yml`, `audit.yml` — every action SHA-pinned, harden-runner first, `persist-credentials: false`, `npm ci --ignore-scripts`.
- `.github/actions/setup-verapdf` + `.github/checksums/`, `.github/rulesets/main.json` (five required checks) and `tags.json`, `dependabot.yml`, `pull_request_template.md` (checklist verbatim from CONTRIBUTING), `ISSUE_TEMPLATE/maintenance.md`, `bug_report.md` (+ `doctor()`).
- Root: `.gitattributes` (LF; the two CRLF workflow blobs renormalised), `.npmrc`, `.node-version`, `.editorconfig`, `.githooks/`, `tsconfig.scripts.json`, `vitest.config.ts` (`TZ=UTC`, `pool: 'forks'`, timeouts, reporters), `package.json` (scripts, `packageManager: npm@10.9.2` like the siblings, `typesVersions` for the `client` subpath, the sibling `overrides` set — `esbuild`, `js-yaml` 4.3.2 — with the lockfile refreshed for the nanoid and brace-expansion advisories, vitest 4.1.11, devDeps `tsx` / `esbuild` / `publint` / `@arethetypeswrong/cli`, keywords), `.gitignore`.

### Agent layer
- `.claude/settings.json` (`attribution.commit: ""`, denies for both shells, Read denied on generated files), `.claude/hooks/guard.mjs` (+ `.d.mts`), `.claude/rules/*.md` (generated), `.claude/skills/release-audit/` (five files, React blind spots), `.github/ai-governance.json` (`sources` / `on_demand` split, `claude_code` block), `.github/instructions/` (+ testing, security, release; descriptions on the existing three), `.github/drafts/{README,TEMPLATE}.md`, `CLAUDE.md` (`@AGENTS.md` + addendum), `AGENTS.md` (≤ 120 lines), `.github/copilot-instructions.md`.

### Tests, samples and baselines
- New suites: `tests/{typography,color,pdfx,reproducible,fonts-27}.test.tsx`, `tests/doctor.test.ts`, `tests/{api-surface,schema-superset,manifest-superset}.test.ts`, `tests/regression/{samples,reproducible-build,engine-surface}.test.ts`, `tests/tools/{gate,workflows,hermetic-env,verify-docs,react-surface,release-prepare,guard,agent-config,build-claude-rules,markdown-anchors,pdfx,verapdf,json-schema-lite}.test.ts`; `tests/lint.test.tsx` gains one `it` per new rule plus its clean case and the engine-message parity.
- Frozen captures: `tests/regression/baselines/{api-surface,doc-spec.schema,manifest}.v1.2.0.json`, eight fixture specs, `tests/regression/compat/v1.2.0/samples/` (`typecheck:compat`), `tests/regression/engine-surface.json` (85 items).
- Baseline: `tests/regression/baselines/samples.sha256.json` — 38 entries, all `since: "1.3.0"`, provenance note recorded; `fonts-prop` / `fonts-prop-sync` identical by design.
- Samples: `text/typography-engine.tsx`, `text/typography-french.tsx` (`demo-language: fr`), `layout/print-pdfx4.tsx`, `layout/cmyk.tsx`, `quality/reproducible.tsx`, `fonts/scripts-27.tsx`; `quality/diagnostics.tsx`, `agent/compact-spec.ts`, `agent/visual-verify.tsx` updated.

### Documentation
- New guides `docs/TYPOGRAPHY.md`, `docs/PRINT.md`, `docs/REPRODUCIBLE.md`; README, `llms.txt`, `docs/AGENT_CONTRACT.md` (§8 reproducible output, the grammar table, tier 5 `validatePdfX`), `docs/KNOWLEDGE_BASE.md` (§6a Reproducibility, module map, probes), `docs/LINTING.md`, `docs/RECIPES.md` (three recipes), `docs/CHARTS.md`, `docs/SERVER.md`, `docs/AI_GOVERNANCE.md` §8, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `ROADMAP.md`, `samples/README.md`, `CHANGELOG.md` (`[1.3.0]` + ladder, the `[0.2.0]` rung fixed), `CITATION.cff`, `release-notes/{TEMPLATE,PR_TEMPLATE}.md`, this draft.

## Verification

What actually ran on the release branch (Windows 11, Node 22.17.0, veraPDF greenfield 1.30.2 with JDK 13). Reproduce with:

```bash
VERAPDF_HOME=~/verapdf JAVACMD="/c/Program Files/Java/jdk-13.0.1/bin/java.exe" npx tsx scripts/gate.ts --publish --require-all
```

Expected behavior: 14 steps PASS, 0 skipped, in about eight minutes.

| Command | Result |
|---|---|
| `npx tsx scripts/gate.ts --publish --require-all` | 14 steps, every one PASS, 0 skipped (`typecheck:all` 46.9 s, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check` 7.1 s, `test:generate` 58.3 s — 38 samples, `test:coverage` 102.6 s — 810 tests, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa` 94.5 s) |
| `npm run test:coverage` — tests | 810 / 810 passing across 43 files |
| `npm run test:coverage` — coverage | 96.24 % statements / 92.38 % branches / 98.05 % functions / 97.2 % lines (thresholds 90 / 84 / 92 / 90) |
| `npm run build && npm run test:generate && npm run verify:samples` | 38 tracked samples match the baseline (38 byte-exact, 0 semantic); a second generation run was byte-identical |
| `npm run corpus:pdfa && npm run validate:pdfa` | 11 PASS, 2 XFAIL, 0 FAIL, 0 XPASS, 0 INFRA, 3 SKIP (the PDF/X files) of 13 validated — veraPDF greenfield 1.30.2 |
| `npm run validate:pdfx` | 2 PASS, 1 XFAIL, 0 FAIL, 0 XPASS (of 3 validated) |
| `npm run verify:docs` | 27 rules passed |
| `npm audit --audit-level=high` | found 0 vulnerabilities |
| `pack-check` (publint, @arethetypeswrong/cli) | publint "All good!"; attw: `.`, `./client` and `./package.json` resolve for node10, node16 (CJS and ESM) and bundler |

Independent audit: `/release-audit release-notes/v1.3.0.md v1.2.0` — PENDING (the maintainer runs the skill; the ledger lands under `.audit/1.3.0/`).

## Zero-breaking-change audit

| Check | Method | Result |
|---|---|---|
| Runtime exports | `tests/api-surface.test.ts` against `tests/regression/baselines/api-surface.v1.2.0.json` (captured from the untouched 1.2.0 tree before any edit) | 0 removed; additions: the six helpers, `ENGINE_INPUT_ERROR_PREFIXES`, eleven types, `ParagraphAlign`; the 1.3.0 surface snapshotted |
| Types | `npm run typecheck:compat` — the frozen v1.2.0 samples (`git archive v1.2.0 samples`, imports pointed at the current `src/`) compiled against the 1.3.0 source | 38 files, 0 errors |
| JSON Schema | `tests/schema-superset.test.ts` against `doc-spec.schema.v1.2.0.json`; eight 1.2.0 fixture specs under both schemas and `validateSpec` | every property, enum member and block branch kept; nothing became required; `$id` differs by the version only |
| Manifest and lint | `tests/manifest-superset.test.ts` against `manifest.v1.2.0.json` | every component, tag, alias, entry point, error code and lint rule kept with the same severity, in order, as a prefix; accepted delta `contract.engine` |
| Golden snapshots | `git diff --stat v1.2.0 -- tests/__snapshots__/` | 2 files, 338 insertions, 0 deletions |
| Error codes | `tests/agent.test.tsx`, `tests/manifest-superset.test.ts` | `E_*` and `V_*` unchanged |
| Legacy bytes | the eight fixture specs rendered by the published 1.2.0 (engine 1.7.0) and by the 1.3.0 build, dates / `/ID` / producer normalised (`scratchpad/compare-1.2.0.mts`) | 6 identical; `kitchen-sink.json` and `print-tagged.json` differ — both draw `print.marks` (the inherited 0.5 pt clearance fix, declared in Upgrade note 1) |
| Legacy lint | `tests/manifest-superset.test.ts` runs `lintSpec` over the 1.2.0 fixtures | 0 new findings; `report.ok` unchanged |
| Install-time | `tests/version.test.ts`, `tests/doctor.test.ts` | the peer floor `^1.8.0` is the one install-time change; a 1.7.x engine is reported by name |

## Output changes and rebaseline

- Bytes of an unchanged 1.2.0 document: identical on base-14 fonts without printer's marks; the inherited engine changes (TrueType subsets, marks clearance, shaping, soft hyphens, UTC dates) are declared under Upgrade notes 1–3 of `release-notes/v1.3.0.md`.
- `tests/regression/baselines/samples.sha256.json`: created by this release — 38 entries anchored at 1.3.0 with `npx tsx scripts/verify-samples.ts --update`; the provenance note records the double generation and the identical pair. No earlier baseline exists to rebaseline from.
- Every item above is declared in the Upgrade section of `release-notes/v1.3.0.md`.

## Out of scope (tracked in ROADMAP.md)

- `validatePdfX` re-export (golden rule 7), a `pdfnative-react` MCP server (dropped), a React Native renderer, an external visual tier, PDF/X-1a / X-3 / X-4p / PDF/A-4 (engine "not yet"; upstream limit `pdfx-single-target`), a hyphenation-provider sample (upstream limit `no-bundled-hyphenation`), harden-runner block mode.

## Maintainer steps after merge

Agents stop at this draft; everything below is done by the maintainer (`.github/AGENT_RULES.md`).

1. The two CRLF workflow blobs are already staged as LF in this branch (`git add` under the new `.gitattributes`); no separate renormalisation commit is needed — `git ls-files --eol` reports no `i/crlf`.
2. Push the branch, open the pull request with this body, wait for `ci (22)`, `ci (24)`, `os (windows-latest)`, `os (macos-latest)` and `sample-regression` (the first run on Windows and macOS), merge.
3. Tag `v1.3.0` on the merge commit and publish the GitHub Release (title `v1.3.0 - Typography, CMYK & PDF/X-4, reproducible output, pdfnative 1.8`, body = `release-notes/v1.3.0.md`).
4. Create the `npm-publish` environment and bind the npm Trusted Publisher to it, then approve: `publish.yml` re-runs the publish gate and publishes through npm Trusted Publishing, and attaches the SBOM and the attestation to the release. Confirm with `npm view pdfnative-react version`.
5. Import the rulesets (`.github/rulesets/main.json`, `.github/rulesets/tags.json`) — CONTRIBUTING §Branch protection.
6. Update the `pdfnative-react` entry of `docs/assets/ecosystem.json` in pdfnative, pdfnative-cli and pdfnative-mcp (1.3.0, peer `^1.8.0`), the React cells of pdfnative's `docs/data/surfaces.json` and `docs/guides/react.md`.
7. Run `/release-audit release-notes/v1.3.0.md v1.2.0` before tagging if not already done; fix what it confirms.

## Checklist

- [x] `npm run gate` passes — the CI profile in one command (`npm run gate:fast` for a quick loop while iterating; PowerShell swallows a bare `--`, so call `npx tsx scripts/gate.ts --fast` there)
- [x] All tests pass (`npm run test`)
- [x] Type check passes (`npm run typecheck:all` — src, tests, samples, scripts and the v1.2.0 compatibility snapshot)
- [x] Lint passes (`npm run lint`)
- [x] New code has tests (coverage thresholds in `vitest.config.ts` must not regress)
- [x] No `any` types introduced
- [x] No new runtime dependency (`react-reconciler` stays the only one; `pdfnative` and `react` stay peers)
- [x] A new authoring capability reaches every wiring point: `src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/{types,compile,schema}.ts`, `src/registry.ts`, `tests/` (serialization, DocSpec parity, the golden snapshot read before `-u`), `samples/` and `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`
- [x] If samples, PDF/A or PDF/X behaviour changed: `npm run build && npm run test:generate && npm run verify:samples && npm run corpus:pdfa && npm run validate:pdfx && npm run validate:pdfa` passes locally (veraPDF installed; new claiming corpus entries bump `declared.pdfaSamples` / `declared.pdfxSamples`; an intended output change is rebaselined with `npx tsx scripts/verify-samples.ts --update` and declared in the release note)
- [x] If docs, README, llms.txt, AGENTS.md, CLAUDE.md or `.claude/` changed: `npm run verify:docs` passes
- [x] No breaking change (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` are green), or documented and versioned accordingly
- [x] `CHANGELOG.md` updated (Unreleased section) if user-facing changes
- [x] For releases: `release-notes/vX.Y.Z.md` and this draft written, and `npx tsx scripts/gate.ts --publish --require-all` passes locally, which runs every individual gate: `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa`
- [x] Every figure above was produced by a command on this branch, not typed from memory
- [x] `release-notes/vX.Y.Z.md` and the CHANGELOG entry for X.Y.Z say the same things as this body
- [x] No `Co-Authored-By` trailer and no "generated with" footer anywhere on the branch

## Compliance report

| Field | Value |
|---|---|
| `no_new_runtime_dependency_confirmed` | true — `dependencies` is still `react-reconciler` alone; `tsx`, `esbuild`, `publint`, `@arethetypeswrong/cli` are devDependencies |
| `reproduction_command` | `npx tsx scripts/gate.ts --publish --require-all` |
| `reproduction_result` | 14 passed, 0 skipped |
| `duplicate_search_performed` | true — no open or closed pull request for 1.3.0; the sibling releases (pdfnative 1.8.0, pdfnative-cli 1.5.0, pdfnative-mcp 1.7.0) are the reference |
| `affected_packages` | pdfnative-react (this release); pdfnative, pdfnative-cli, pdfnative-mcp (ecosystem manifests only) |
| `identity_reminder_shown` | true — this pull request is opened by the maintainer under their own GitHub identity, who shares responsibility for its content |
