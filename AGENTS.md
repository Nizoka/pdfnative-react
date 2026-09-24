# AGENTS.md

Condensed, editor-agnostic guidance for AI coding agents working **on** pdfnative-react (Cursor, Aider, Claude Code, Copilot, Continue, Zed, Cline, Windsurf, Goose, Gemini CLI, …).
Canonical detail: [.github/copilot-instructions.md](.github/copilot-instructions.md) + [.github/instructions/](.github/instructions/) + [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md).
Claude Code loads [CLAUDE.md](CLAUDE.md), which imports this file. Keep the three consistent.
Agents that **use** the package read [docs/AGENT_CONTRACT.md](docs/AGENT_CONTRACT.md) (the loop, the dry-run tiers, the DocSpec grammar, the error codes) instead.

## Mission and constraints

pdfnative-react is the official React renderer of the pdfnative engine: JSX → react-reconciler → `DocumentParams` → PDF bytes, plus a token-frugal `DocSpec` door for agents.
19 components, 14 block kinds, 18 DocSpec fields, 37 lint rules, 6 error codes; a declarative **block flow**, not a CSS engine — there is no `<View>`.

- **One runtime dependency.** `react-reconciler`. `pdfnative` and `react` are peers; proposing another runtime package is a hard block (`npm run verify:issue` enforces it).
- **One bridge.** Only `src/core-bridge/index.ts` imports `pdfnative` at runtime (`src/types.ts` type-only). The scripts and the tests that check finished bytes are the documented exception.
- **Authoring only.** Byte-level post-processing (merge, sign, encrypt, extract, validate) stays out of the barrel — `docs/RECIPES.md` shows the direct engine call.
- **Two doors, one model.** Every capability reaches JSX props AND the DocSpec grammar + JSON Schema, through `src/registry.ts`,
  the single source the schema, `validateSpec` and `capabilityManifest()` derive from (omission fails `typecheck`).
- **Additive and byte-identical.** An unchanged document renders the same bytes across minors except where the release note declares otherwise; `resolveLayout()` returns `undefined`, never `{}`, when no sugar is set.
- **Reproducible output.** Dates are written in UTC; `creationDate` (prop or DocSpec key) or `setDefaultCreationDate()` pins them;
  the library reads no environment variable; the sample set is byte-stable and held to `tests/regression/baselines/samples.sha256.json`.
- **Client and server.** `'use client'` on `hooks.ts` / `viewer.tsx` only, shipped through the `pdfnative-react/client` subpath; the root bundle is server-safe; never on `src/spec/`.
- **Strict TypeScript, no `any`**, `type`-only imports, relative imports carry `.js`, 4-space indent (2 for JSON/YAML).
- **Human-in-the-loop.** Agents draft and verify; the maintainer pushes, opens PRs/issues, tags and publishes (see Governance).
- **English everywhere.** Code, comments, tests, samples, docs and release notes are English; demonstrated content in another language
  is marked `demo-language: <tag> (reason)` on or above the line (`verify:docs` rule `prose-language`).

## The gate

`npm run gate` is THE quality gate (`scripts/gate.ts`; the step list is its `STEPS` table). Logs land in `test-output/.gate/<step>.log`; the summary is at most 20 lines.

| Profile | Command | Runs |
|---|---|---|
| Fast — before every commit | `npm run gate:fast` | typecheck:all, lint, test, verify:docs |
| CI — the default | `npm run gate` | fast minus `test`, plus build, dist-check, dist-probe, bundle-smoke, pack-check, test:generate, test:coverage, verify:samples, corpus:pdfa, validate:pdfx — build and samples precede the tests |
| Publish — release branches | `npx tsx scripts/gate.ts --publish --require-all` | everything, incl. validate:pdfa (veraPDF; `--require-all` fails on a skip) |

PowerShell swallows a bare `--`, so pass flags by calling the script: `npx tsx scripts/gate.ts --fast`, `--only <step>`, `--json`.
One suite: `npx vitest run tests/<name>.test.tsx` (dot reporter). Type-check everything with `npm run typecheck:all` (src, tests, samples, scripts, the v1.2.0 compatibility snapshot).

## Where is what

| Path | Purpose | Read first |
|---|---|---|
| `src/components.tsx` | Public components; each emits a lowercase host tag; `Section` is the one composite | `components.instructions.md` |
| `src/reconciler/` | `host-config.ts` (react-reconciler, mutation mode), `nodes.ts`, `serialize.ts` (host tree → `DocumentParams`, the sugar fold), `render.ts` | `reconciler.instructions.md` |
| `src/spec/` | `DocSpec` grammar (`types.ts`), compiler, JSON Schema, `validateSpec` | `spec.instructions.md` |
| `src/registry.ts` | Block grammar, DocSpec fields, components, client components, lint rules — with compile-time exhaustiveness locks | `spec.instructions.md` |
| `src/lint.ts`, `src/errors.ts`, `src/doctor.ts`, `src/manifest.ts`, `src/governance.ts` | The agent surface: rules, `E_*` codes, pre-flight, capability manifest, HITL policy as runtime capability | `security.instructions.md` |
| `src/render.ts`, `src/response.ts`, `src/hooks.ts`, `src/viewer.tsx`, `src/fonts.ts`, `src/assets.ts` | Entry points (bytes, blob, stream, file, `Response`), client hooks/components, font and image helpers | `security.instructions.md` |
| `src/core-bridge/index.ts`, `src/types.ts` | The engine bridge and the public types | `security.instructions.md` |
| `scripts/` | gate, sample generator, baseline, conformance corpus + validators (`helpers/`, `lib/`), verify-docs, release-prepare | `testing.instructions.md` |
| `tests/` | vitest, one suite per module; `regression/` (baselines, compat snapshot, engine-surface matrix); `tools/` (repository tooling) | `testing.instructions.md` |
| `samples/` | Runnable, type-checked examples, rendered into the byte baseline by `npm run test:generate` | `testing.instructions.md` |
| `docs/` | `AGENT_CONTRACT.md` (consumer contract), `KNOWLEDGE_BASE.md` (deep reference), guides, `assets/ecosystem.json` (every count and version) | — |

Instruction files live under `.github/instructions/`.

## Architecture

`JSX → components.tsx → react-reconciler (host-config.ts) → host tree (nodes.ts) → serialize.ts → DocumentParams → core-bridge → pdfnative → PDF bytes`; a `DocSpec` compiles to the same host tree through `spec/compile.ts`.

Adding a block kind or a document capability touches ALL of these (`verify:docs` rules `registry-parity`, `lint-rule-parity`, `sample-index-parity` fail on a missed step):

1. `src/reconciler/nodes.ts` (host tag), `src/components.tsx` (component + props), `src/reconciler/serialize.ts` (`toBlock` case or the layout fold).
2. `src/spec/types.ts` (tuple or field), `src/registry.ts` (`BLOCK_REGISTRY` / `DOC_SPEC_FIELDS` / `COMPONENT_REGISTRY`), `src/spec/compile.ts`, `src/spec/schema.ts`.
3. `src/spec/index.ts` and `src/index.ts` (exports), `src/manifest.ts` when an entry point is added.
4. `tests/` — a serialization test AND a `compileSpec` ↔ JSX parity test; the golden snapshot read before `-u`; a lint rule and its test when the engine can throw.
5. `samples/`, `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`, `docs/assets/ecosystem.json`, `CHANGELOG.md`.

## Consumer contract in brief

A render succeeds with bytes or fails with a `PdfReactError` carrying one of the 6 error codes of `docs/AGENT_CONTRACT.md` §6 (`toErrorEnvelope` wraps anything thrown);
`validateSpec`, `lintSpec` and `doctor` never throw. The JSON Schema `$id` carries the package version; `capabilityManifest()` lists every export, rule and code.

## Never touch

- `release-notes/v*.md` of already-shipped versions (read-only history), and `tests/regression/baselines/*.v1.2.0.json` + `tests/regression/compat/v1.2.0/` (frozen captures of the published 1.2.0 surface — never regenerated).
- `dist/`, `coverage/`, `test-output/`, `samples/output/`, `node_modules/`, `package-lock.json` (npm owns it), and the table below: regenerate, never hand-edit.
- Any figure in `docs/assets/ecosystem.json` without running `npm run verify:docs` afterwards; the `pdfnative` peer pin without a release note and a matrix update; the coverage thresholds downwards.

## Generated files

| File | Regenerate with |
|---|---|
| `.claude/rules/*.md` | `npm run agents:rules` (from `.github/instructions/*.instructions.md`; drift fails `verify:docs`) |
| `tests/__snapshots__/*.snap` | `npx vitest run -u` — only with a model change declared in the release note, after reading the diff |
| `tests/regression/baselines/samples.sha256.json` | `npm run build && npm run test:generate && npx tsx scripts/verify-samples.ts --update` — only with a rebaseline declared in the release note |
| `test-output/samples/`, `test-output/pdfa/` | `npm run test:generate`, `npm run corpus:pdfa` (git-ignored) |
| `dist/`, `coverage/` | `npm run build`, `npm run test:coverage` |

## Counts and versions

19 components, 3 client components, 14 block kinds, 18 DocSpec fields, 37 lint rules, 6 error codes, 7 schema subjects, 27 Unicode scripts, 811 tests, 38 samples in the baseline, 16 corpus files.
`docs/assets/ecosystem.json` is the source of every count and version quoted in the docs; run `npm run verify:docs` after touching any of them.
Coverage thresholds live once in `vitest.config.ts` and are enforced by the gate. Engine: pdfnative 1.8.0 (peer `^1.8.0`); React 19; Node ≥ 22.

## Releasing

Follow CONTRIBUTING.md §Release and `scripts/release-prepare.ts`; Conventional Commits (`feat(scope):`, `fix(scope):`, `docs:`, `chore:`), never with a `Co-Authored-By` trailer.
Every runtime change gets a ROADMAP.md entry, a CHANGELOG line and a line in the next `release-notes/vX.Y.Z.md`; the version moves in lock-step (`tests/version.test.ts`).
`/release-audit` (Claude Code skill) runs the pre-release audit; the maintainer merges, tags and publishes.

## Governance

Human-in-the-loop, enforced: agents never push, never open PRs/issues/releases, never publish, never tag, and never add `Co-Authored-By` trailers.
Protocol: [.github/AGENT_RULES.md](.github/AGENT_RULES.md); machine-readable policy: [.github/ai-governance.json](.github/ai-governance.json).
Issue drafts go to `.github/drafts/` and are validated with `npm run verify:issue` (or `validateIssueDraft()`) before a human submits them.

## Ecosystem

- [pdfnative](https://github.com/Nizoka/pdfnative) — the zero-dependency engine this renderer wraps; every PDF feature is upstream (`ROADMAP.md` lists what is upstream-blocked).
- [pdfnative-cli](https://github.com/Nizoka/pdfnative-cli) — the terminal wrapper of the same engine, for pipelines and shell agents.
- [pdfnative-mcp](https://github.com/Nizoka/pdfnative-mcp) — the Model Context Protocol server of the same engine, for MCP hosts.

See also: [ROADMAP.md](ROADMAP.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [llms.txt](llms.txt).
