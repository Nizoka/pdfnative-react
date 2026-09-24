# Release Pull Request Template

The body of a release pull request. `npx tsx scripts/release-prepare.ts --version X.Y.Z` scaffolds
`release-notes/draft/PR-vX.Y.Z.md` from the block below (same mechanism as [TEMPLATE.md](TEMPLATE.md): it resolves
`vX.Y.Z`, `X.Y.Z`, the previous tag `vX.Y.Z-1` and `YYYY-MM-DD`, and unescapes the inner code fences). Whoever
prepares the release fills every section; the maintainer pastes the result into the GitHub pull request verbatim.
The per-version bodies are committed: they are the auditable record of what each release claimed and what was run.

Every figure quoted in the body comes from a command run on the release branch — the gate summary, `npm run test:coverage`,
`npm run verify:samples`, the validators — never from memory. `<…>` marks what to fill in.

```markdown
# release: vX.Y.Z — <headline>

> **Branch:** `release/vX.Y.Z` → `main`
> **Type:** <Major | Minor | Patch> release (<additive, fully backward-compatible with vX.Y.Z-1 | breaking: …>)
> **pdfnative peer:** `^A.B.C` → `^D.E.F` (or "unchanged")
> **Prepared:** YYYY-MM-DD — release note: `release-notes/vX.Y.Z.md`

## Summary

<Two or three paragraphs: what the release does for an author writing JSX, what it does for an agent emitting a
DocSpec, what the repository adopted. Name the engine version and every ROADMAP item delivered.>

Counts (`docs/assets/ecosystem.json`): <N> components, <N> block kinds, <N> DocSpec fields, <N> lint rules, <N> error codes
<unchanged | X → Y>; samples in the baseline <X → Y>; conformance corpus <X → Y> files; tests <X → Y> across <N> files.

## What changed

### Authoring surface (`src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/`, `src/registry.ts`)
- <One bullet per prop, DocSpec field, schema definition, enum value or block flag added — with the components that carry it.>

### Linting, diagnostics and errors (`src/lint.ts`, `src/errors.ts`, `src/doctor.ts`, `src/manifest.ts`)
- <Rules, severities, engine-message parity, error classification, the doctor floor, the manifest contract.>

### Tooling (`scripts/`)
- <Gate steps, generators, validators, verifiers added or changed.>

### CI / repository (`.github/`, root)
- <Workflows, rulesets, templates, dotfiles, package.json.>

### Agent layer
- <AGENTS.md / CLAUDE.md / `.claude/`, `docs/AGENT_CONTRACT.md`, instruction files.>

### Tests, samples and baselines
- <New suites, new `samples/`, new corpus entries, new baseline entries, the compatibility snapshot.>

### Documentation
- <README, docs/, llms.txt, SECURITY, CONTRIBUTING, ROADMAP, CHANGELOG, CITATION, the release note.>

## Verification

What actually ran on the release branch (<OS>, Node <version>, veraPDF <version>):

| Command | Result |
|---|---|
| `npx tsx scripts/gate.ts --publish --require-all` | <N passed, 0 skipped in N s — the summary line as printed> |
| `npm run test:coverage` — tests | <N / N passing across N files> |
| `npm run test:coverage` — coverage | <S % statements / B % branches / F % functions / L % lines (thresholds S / B / F / L)> |
| `npm run build && npm run test:generate && npm run verify:samples` | <N samples match the baseline (N by bytes)> |
| `npm run corpus:pdfa && npm run validate:pdfa` | <N PASS, N XFAIL, 0 FAIL, 0 XPASS — veraPDF version> |
| `npm run validate:pdfx` | <N PASS, N XFAIL> |
| `npm run verify:docs` | <N rules, 0 errors> |
| `npm audit --audit-level=high` | <clean> |
| `pack-check` (publint, @arethetypeswrong/cli) | <every entry point resolves for node10, node16 CJS/ESM and bundler; publint clean> |

Independent audit: `/release-audit release-notes/vX.Y.Z.md vX.Y.Z-1` — <PENDING | the ledger: tally per severity, every
confirmed finding with its fix commit, every waiver with its reason>.

## Zero-breaking-change audit

- Runtime exports: `tests/api-surface.test.ts` against `tests/regression/baselines/api-surface.v1.2.0.json` — <0 removed, N added>.
- Types: `npm run typecheck:compat` compiles the frozen vX.Y.Z-1 samples against the current `src/` — <N files, 0 errors>.
- JSON Schema: `tests/schema-superset.test.ts` — <every property, enum member and block branch kept; nothing became required>.
- Manifest and lint: `tests/manifest-superset.test.ts` — <every component, entry point, error code and lint rule kept with the same severity>.
- Golden snapshots: `git diff --stat vX.Y.Z-1 -- tests/__snapshots__/` — <additions only>.
- Error codes: <unchanged | new codes and where they are thrown>.

## Output changes and rebaseline

- Bytes of an unchanged vX.Y.Z-1 document: <identical | the list of what changed and why, inherited from the engine or not>.
- `tests/regression/baselines/samples.sha256.json`: <N entries re-anchored at X.Y.Z with `npx tsx scripts/verify-samples.ts --update`, N new, N unchanged — reason in the manifest's `provenance` note | not rebaselined>.
- Every item above is declared in the Upgrade section of `release-notes/vX.Y.Z.md`.

## Out of scope (tracked in ROADMAP.md)

- <Upstream-blocked items and deferred work, with the ROADMAP entry.>

## Maintainer steps after merge

Agents stop at this draft; everything below is done by the maintainer (`.github/AGENT_RULES.md`).

1. <The LF renormalisation commit, if pending.>
2. Push the branch, open the pull request with this body, wait for `ci (22)`, `ci (24)`, `os (windows-latest)`, `os (macos-latest)` and `sample-regression`, merge.
3. Tag `vX.Y.Z` on the merge commit and publish the GitHub Release (title `vX.Y.Z - <short description>`, body = `release-notes/vX.Y.Z.md`).
4. Approve the `npm-publish` environment: `publish.yml` re-runs the publish gate and publishes through npm Trusted Publishing, then attaches the SBOM and the attestation to the release. Confirm with `npm view pdfnative-react version`.
5. Import or update the rulesets (`.github/rulesets/main.json`, `.github/rulesets/tags.json`) if they changed — CONTRIBUTING §Branch protection.
6. Update the `pdfnative-react` entry of `docs/assets/ecosystem.json` in the sibling repositories (pdfnative, pdfnative-cli, pdfnative-mcp).
7. <Submit the upstream issue drafts under `.github/drafts/issue-*.md`, if any.>

## Checklist

- [ ] `npm run gate` passes — the CI profile in one command (`npm run gate:fast` for a quick loop while iterating; PowerShell swallows a bare `--`, so call `npx tsx scripts/gate.ts --fast` there)
- [ ] All tests pass (`npm run test`)
- [ ] Type check passes (`npm run typecheck:all` — src, tests, samples, scripts and the v1.2.0 compatibility snapshot)
- [ ] Lint passes (`npm run lint`)
- [ ] New code has tests (coverage thresholds in `vitest.config.ts` must not regress)
- [ ] No `any` types introduced
- [ ] No new runtime dependency (`react-reconciler` stays the only one; `pdfnative` and `react` stay peers)
- [ ] A new authoring capability reaches every wiring point: `src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/{types,compile,schema}.ts`, `src/registry.ts`, `tests/` (serialization, DocSpec parity, the golden snapshot read before `-u`), `samples/` and `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`
- [ ] If samples, PDF/A or PDF/X behaviour changed: `npm run build && npm run test:generate && npm run verify:samples && npm run corpus:pdfa && npm run validate:pdfx && npm run validate:pdfa` passes locally (veraPDF installed; new claiming corpus entries bump `declared.pdfaSamples` / `declared.pdfxSamples`; an intended output change is rebaselined with `npx tsx scripts/verify-samples.ts --update` and declared in the release note)
- [ ] If docs, README, llms.txt, AGENTS.md, CLAUDE.md or `.claude/` changed: `npm run verify:docs` passes
- [ ] No breaking change (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` are green), or documented and versioned accordingly
- [ ] `CHANGELOG.md` updated (Unreleased section) if user-facing changes
- [ ] For releases: `release-notes/vX.Y.Z.md` and this draft written, and `npx tsx scripts/gate.ts --publish --require-all` passes locally, which runs every individual gate: `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa`
- [ ] Every figure above was produced by a command on this branch, not typed from memory
- [ ] `release-notes/vX.Y.Z.md` and the CHANGELOG entry for X.Y.Z say the same things as this body
- [ ] No `Co-Authored-By` trailer and no "generated with" footer anywhere on the branch
```

## Conventions

- Keep the section order; omit nothing — write "none" or "unchanged" where a section has no entry, so a reader sees it was considered.
- The Verification table quotes results as printed; a command that was not run is marked "not run", never guessed.
- The checklist carries the items of [.github/pull_request_template.md](../.github/pull_request_template.md) (the two links of that template are dropped here, because a pull request body has no stable base path), plus three release items.
- English everywhere; no `Co-Authored-By` trailer and no mention of an AI assistant.
