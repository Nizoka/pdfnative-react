---
paths:
  - "tests/**"
  - "scripts/**"
  - "samples/**"
---
<!-- GENERATED from .github/instructions/testing.instructions.md by scripts/build-claude-rules.ts — do not edit -->

# Testing Standards

## The gate
- `npm run gate` (CI profile) is the single definition of green; `npm run gate:fast` while iterating; `npx tsx scripts/gate.ts --publish --require-all` before a release (needs veraPDF). One line per step, logs under `test-output/.gate/`. Summarise its output — do not paste logs.
- PowerShell swallows a bare `--` after `npm run`: call `npx tsx scripts/<name>.ts <flags>` directly.
- Build before the suites that need `dist/`: `tests/regression/reproducible-build.test.ts` (two time zones over `dist/index.js`) and `tests/regression/samples.test.ts` (reads `test-output/samples/`). They skip locally, fail under the gate (`GATE_REQUIRE_ARTIFACTS=1`). `.npmrc` disables install-time scripts.

## Framework
- vitest 4, `TZ=UTC`, `pool: 'forks'`, no shuffle, `dot` reporter; jsdom by default (the hooks and the viewer), `// @vitest-environment node` on every suite that needs none. Tests are flat under `tests/`; `_`-prefixed files are shared fixtures; `tests/regression/` holds the baselines, the compatibility snapshot and the engine-surface matrix; `tests/tools/` holds the repository-tooling tests.
- Commands: `npm test`, `npm run test:coverage`, `npm run typecheck:all` (src + tests + samples + scripts + the v1.2.0 compatibility snapshot), `npm run lint` (`eslint src --max-warnings 0` — warnings fail).
- Coverage thresholds live once, in `vitest.config.ts`. Never lower them; raise them when a release lifts coverage.

## The registry and the golden snapshot
- `tests/registry.test.ts` pins the ordered contents of every table of `src/registry.ts`; `tests/compile-snapshot.test.tsx` holds the compiled model of a kitchen-sink document. Read the diff before `vitest -u`: a snapshot changes only when the model deliberately changes, and the change is declared in the release note.
- A new prop or DocSpec key needs a serialization test, a `compileSpec` ↔ JSX parity test (`tests/spec.test.tsx`), a schema test and, when it can fail inside the engine, a lint rule test (`tests/lint.test.tsx`, one `it` per rule plus its clean case; the message equals the engine's own throw where one exists).

## Zero breaking change
- `tests/api-surface.test.ts`, `tests/schema-superset.test.ts` and `tests/manifest-superset.test.ts` compare the live surface with the frozen captures under `tests/regression/baselines/*.v1.2.0.json`; `npm run typecheck:compat` compiles the frozen v1.2.0 samples against the current `src/`. Never regenerate a v1.2.0 baseline. A removal or a narrowing is a major release.

## Samples and the byte baseline
- `npm run test:generate` runs every sample of `scripts/lib/sample-plan.ts` in its own process with the creation instant pinned, into `test-output/samples/`; `npm run verify:samples` compares it with `tests/regression/baselines/samples.sha256.json`. The baseline is a chain: an unchanged entry keeps its `since`.
- A new sample is an entry of `SAMPLE_PLAN` (or `MODULE_SAMPLES` when it is a component module), a row of `samples/README.md`, and a `--update` of the baseline declared in the release note. An intended output change is rebaselined the same way, explained in the manifest's `provenance` note. Never `--update` to silence a surprise.
- Samples write to the current directory, format numbers and dates with an explicit locale, and never read the environment (the generator pins the instant, not the sample).

## Conformance corpus
- `npm run corpus:pdfa` writes `test-output/pdfa/` from `scripts/lib/pdfa-corpus.ts` through the built package; `npm run validate:pdfx` (in-process `validatePdfX()`, never skips) and `npm run validate:pdfa` (veraPDF 1.30.2: set `VERAPDF_HOME`, and `JAVACMD` when Java is not on PATH). Exit codes 0 / 1 (conformance) / 2 (infrastructure).
- Every new claiming entry bumps `declared.pdfaSamples` / `declared.pdfxSamples` in `docs/assets/ecosystem.json`. Negative canaries (`expectCompliant: false`) must stay rejected: an XPASS is fatal. A known upstream limit is a tracked canary, not a dropped file.

## The engine-surface matrix
- `tests/regression/engine-surface.json` maps every bullet of the pinned pdfnative release to the tests and samples that exercise it through the renderer, or to a waiver with a reason. Moving the peer pin fails `tests/regression/engine-surface.test.ts` until the matrix follows (CONTRIBUTING.md, "Bumping the engine pin").
