<!--
Thank you for contributing to pdfnative-react. Describe the change, then walk
the checklist. The items mirror CONTRIBUTING.md §Pull Request Checklist word
for word; keep the two in step when you change either (verify:docs rule
pr-template-parity and tests/tools/workflows.test.ts both check it).
-->

## What and why

<!-- One paragraph: what changes, why, and which issue it closes (`Closes #…`). -->

## Checklist

- [ ] `npm run gate` passes — the CI profile in one command (`npm run gate:fast` for a quick loop while iterating; PowerShell swallows a bare `--`, so call `npx tsx scripts/gate.ts --fast` there)
- [ ] All tests pass (`npm run test`)
- [ ] Type check passes (`npm run typecheck:all` — src, tests, samples, scripts and the v1.2.0 compatibility snapshot)
- [ ] Lint passes (`npm run lint`)
- [ ] New code has tests (coverage thresholds in `vitest.config.ts` must not regress)
- [ ] No `any` types introduced
- [ ] No new runtime dependency (`react-reconciler` stays the only one; `pdfnative` and `react` stay peers)
- [ ] A new authoring capability reaches every wiring point: `src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/{types,compile,schema}.ts`, `src/registry.ts`, `tests/` (serialization, DocSpec parity, the golden snapshot read before `-u`), `samples/` and `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`
- [ ] If samples, PDF/A or PDF/X behaviour changed: `npm run build && npm run test:generate && npm run verify:samples && npm run corpus:pdfa && npm run validate:pdfx && npm run validate:pdfa` passes locally (veraPDF installed — see [PDF/A and PDF/X validation](../CONTRIBUTING.md#pdfa-and-pdfx-validation); new claiming corpus entries bump `declared.pdfaSamples` / `declared.pdfxSamples`; an intended output change is rebaselined with `npx tsx scripts/verify-samples.ts --update` and declared in the release note)
- [ ] If docs, README, llms.txt, AGENTS.md, CLAUDE.md or `.claude/` changed: `npm run verify:docs` passes
- [ ] No breaking change (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` are green), or documented and versioned accordingly
- [ ] `CHANGELOG.md` updated (Unreleased section) if user-facing changes
- [ ] For releases: follow [Release](../CONTRIBUTING.md#release) — `release-notes/vX.Y.Z.md` and `release-notes/draft/PR-vX.Y.Z.md` written, and `npx tsx scripts/gate.ts --publish --require-all` passes locally, which runs every individual gate: `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa`
- [ ] No `Co-Authored-By` trailer and no "generated with" footer anywhere on the branch

<!--
Runtime changes also need a ROADMAP.md entry and a line in the next
release-notes/vX.Y.Z.md; a new prop, DocSpec field, lint rule or error code is
a change to the agent contract (docs/AGENT_CONTRACT.md, the JSON Schema, the
capability manifest) and is called out there. Pull requests, tags and releases
are submitted by the maintainer, never by an agent (.github/AGENT_RULES.md §5).
-->
