# scripts/ — the quality gate, the sample set, the conformance corpus and the verifiers

Maintenance scripts run with `tsx` (no build step). The generators render through `src/`
(the samples are `npx tsx samples/<name>.tsx`, unchanged, each in its own process) and the
verifiers are pure functions over text; the BUILT package is exercised by the gate's inline
steps (`dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`) and by the two-time-zone
proof (`tests/regression/reproducible-build.test.ts`). The npm aliases in `package.json` are
the public names; call a script directly to pass flags (PowerShell swallows a bare `--` after
`npm run`). `scripts/tsconfig.json` extends `../tsconfig.scripts.json` so an editor types
these files as `typecheck:scripts` does.

The scripts under `lib/` that produce a PDF (`pdfa-corpus.ts`, `pdfx.ts`, `synthetic-icc.ts`)
and the tests that check finished bytes import the engine directly: that is the documented
tooling exception to golden rule 1, which governs `src/` only.

## Quick start

```bash
npx tsx scripts/gate.ts --fast     # typecheck:all, lint, test, verify:docs — the loop while you work
npm run gate                       # the CI profile (default)
npm run build && npm run test:generate && npx tsx scripts/verify-samples.ts   # the sample baseline
```

## The scripts

| Script | npm alias | Gate step | Purpose | Flags | Exit codes |
|---|---|---|---|---|---|
| `gate.ts` | `gate`, `gate:fast` | — (it is the gate) | Runs the STEPS table in order, one line per step, logs under `test-output/.gate/<id>.log`; profiles `--fast` / `--ci` (default) / `--publish`. Inline steps: `dist-check` (the eight artefacts of the `exports` map), `dist-probe` (`'use client'` on `dist/client.*` only, no `console.log`, the `node:` prefix kept, nothing else under `dist/`), `bundle-smoke` (both entries bundled for a browser with esbuild, engine and React external), `pack-check` (`npm pack --dry-run` file list, publint, @arethetypeswrong/cli) | `--only <id>`, `--from <id>`, `--require-all` (a SKIP fails), `--json` | 0 green (or skipped with a reason), 1 a step failed / would have skipped under `--require-all`, 2 usage |
| `generate-samples.ts` | `test:generate` | `test:generate` | Runs every sample of `lib/sample-plan.ts` in its own child process (`node --import tsx --import helpers/pin-creation-date.mjs <sample>`, cwd under `test-output/samples/<dir>/`), under `TZ=UTC`, operator variables scrubbed, the creation instant pinned by `setDefaultCreationDate()` before the sample loads; checks that every expected PDF appeared | `--quiet`, `--verbose`, `--json` | 0 every sample written, 1 a sample failed (its log tail is reproduced), 2 bad usage |
| `verify-samples.ts` | `verify:samples` | `verify:samples` | Fingerprints the generated set (bytes) and holds it to `tests/regression/baselines/samples.sha256.json`, a chained baseline (`since` per entry) | `--strict` (a new, unbaselined sample fails), `--update` (rewrite — only with a rebaseline declared in the release note), `--json` | 0 match, 1 a changed / removed (or, with `--strict`, new) sample, 2 usage or missing samples |
| `generate-pdfa-corpus.ts` | `corpus:pdfa` | `corpus:pdfa` | Writes the PDF/A + PDF/X conformance corpus (`lib/pdfa-corpus.ts`: both authoring doors, every conformance target, negative canaries) and its manifest (with a `sha256` per file) into `test-output/pdfa/` through the built package | `--quiet`, `--verbose`, `--json` | 0 written, 1 a render failed, 2 `dist/` missing or bad usage |
| `validate-pdfa.ts` | `validate:pdfa` | `validate:pdfa` (publish) | Runs every PDF/A-claiming corpus file through veraPDF (`VERAPDF_HOME` or PATH; `JAVACMD` for the JDK) and compares with `expectCompliant`; negative canaries must be rejected (XPASS fails) | `--quiet`, `--verbose`, `--json`; env `VERAPDF_HOME`, `VERAPDF_REPORT_DIR`, `JAVACMD` | 0 every expectation met (or veraPDF absent: skipped with install hints — the gate reports SKIP, `--require-all` fails), 1 a FAIL or XPASS, 2 infrastructure (corpus missing, veraPDF installed but unusable) |
| `validate-pdfx.ts` | `validate:pdfx` | `validate:pdfx` | Runs the engine's structural `validatePdfX()` over the PDF/X files of the corpus and compares with `expectCompliant`; in-process, never skips; zero PDF/X entries is a failure | `--quiet`, `--verbose`, `--json` | 0 every expectation met, 1 a FAIL or XPASS, 2 usage or missing corpus |
| `verify-docs.ts` | `verify:docs` | `verify:docs` | 27 rules holding every count, version, component, block tag, DocSpec field, lint rule, error code, sample link, engine pin, link, anchor, stamp and agent file to `docs/assets/ecosystem.json` and the source tree (`lib/react-surface.ts`); `verify-docs:allow <rule>` opts a line out | `--online` (compare with the npm registry), `--strict` (with `--online`: docs behind npm is an error), `--json` | 0 no error, 1 an error (warnings such as a scoped rule over budget do not fail) |
| `release-prepare.ts` | `release:prepare` | — | Applies a version bump in one pass: package manifests, `src/version.ts`, `ecosystem.json` + "Verified on" stamps, CITATION.cff, the SECURITY.md table, the README engine badge, the knowledge-base header, llms.txt, a release-note and a PR-draft scaffold; prints every touched file. Never touches the engine pin, never commits, tags or publishes | `--version X.Y.Z`, `--date`, `--previous vA.B.C`, `--dry-run` | 0 applied, 1 a target file is missing or its pattern was not found, 2 usage |
| `build-claude-rules.ts` | `agents:rules` | (`verify:docs` rule `claude-rules-sync`) | Projects `.github/instructions/*.instructions.md` into `.claude/rules/*.md` (scoped by `applyTo` → `paths:`), deleting orphans | `--check` (exit 1 on drift, no writes), `--json` | 0 in sync or generated, 1 drift / a source without `applyTo` |
| `verify-issue.mjs` | `verify:issue` | — | Policy check of an issue draft under `.github/drafts/` against `.github/ai-governance.json` (zero new dependency, reproduction, duplicate search); the offline twin of `validateIssueDraft()` | `<draft.md>` | 0 compliant, 1 a violation, 2 usage |
| `install-git-hooks.mjs` | `hooks:install`, `hooks:uninstall` | — | Sets `core.hooksPath` to `.githooks/` (pre-commit: lint + CRLF guard; pre-push: the fast gate) for this clone only | `--uninstall` | 0 done, 1 git unavailable |
| `postbuild.mjs` | (part of `build`) | `build` | Restores the `'use client'` directive on `dist/client.*` and the `node:` prefix tsup's rollup pass strips, and fails the build when the expected shape is not found | — | 0 repaired and verified, 1 an artefact is missing or unrepairable |

## Libraries (`lib/`) and helpers

| Module | Used by | What it holds |
|---|---|---|
| `lib/sample-plan.ts` | generate-samples, verify-samples, verify-docs, `tests/regression/samples.test.ts` | Every runnable sample with the PDFs it writes, the client/server modules that are compiled but not run, the one network sample that is excluded |
| `lib/sample-fingerprint.ts` | verify-samples, `tests/regression/samples.test.ts` | Bytes fingerprints, the (empty) `ENCRYPTED_SAMPLES` / `SIGNED_SAMPLES` / `TIMESTAMPED_SAMPLES` tables, the baseline chain (`chainSince`), identical groups |
| `lib/pdfa-corpus.ts` | generate-pdfa-corpus, validators, verify-docs | The conformance corpus table (JSX and DocSpec doors, claims, negative canaries) |
| `lib/pdfx.ts`, `lib/verapdf.ts` | validate-pdfx, validate-pdfa, gate (skip condition) | PDF/X verdict plumbing; veraPDF location, invocation and report parsing |
| `lib/synthetic-icc.ts` | generate-pdfa-corpus, samples, tests | The synthetic RGB / Gray / CMYK ICC profiles (byte-identical to the sibling repositories' fixtures) |
| `lib/react-surface.ts` | verify-docs, tests | The authoring surface read from text: the registry tables, the error codes, the schema subjects, the sample index, the changelog ladder |
| `lib/json-schema-lite.ts` | tests (`schema-superset`, `color`, `typography`) | A draft-07 subset validator that fails on a keyword it does not implement |
| `lib/markdown-anchors.ts` | verify-docs (`anchor-parity`) | GitHub heading slugs, the anchor inventory of a document, its fragment links |
| `lib/agent-config.ts`, `lib/prose-language.ts` | verify-docs, build-claude-rules, tests | `.claude/settings.json` / rules / skills / PR-template checks; the English-only prose detector |
| `helpers/hermetic.ts`, `helpers/tz.ts` | every generator, the gate | `TZ=UTC` and the removal of every inherited operator variable — imported first |
| `helpers/pin-creation-date.mjs` | generate-samples (child processes) | Calls `setDefaultCreationDate()` from `SOURCE_DATE_EPOCH` before the sample module loads |
| `helpers/io.ts` | every generator | Output directories, the pinned instant, the shared `--quiet/--verbose/--json` parsing |

## Conventions

- Every script prints a one-line summary when stdout is not a terminal (CI, the gate, an
  agent) and a table under `--verbose`; `--json` is the machine-readable form.
- Exit 2 is always usage or infrastructure, never a content failure, so the gate can tell
  "the tool is missing" from "the check failed".
- Nothing here has a runtime dependency: `tsx`, `esbuild`, `publint`, `@arethetypeswrong/cli`
  and `vitest` are dev tooling.
- No script pushes, tags, publishes or opens anything on GitHub — those are the
  maintainer's steps (`.github/AGENT_RULES.md`).
- Tests for the pure parts live in `tests/tools/` (`gate`, `verify-docs`, `react-surface`,
  `release-prepare`, `json-schema-lite`, `hermetic-env`, `pdfx`, `verapdf`,
  `markdown-anchors`, `build-claude-rules`, `agent-config`, `guard`, `workflows`).
