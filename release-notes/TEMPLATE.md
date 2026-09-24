# Release Notes Template

This directory contains release notes for each published version of pdfnative-react.

## File naming

- One file per version: release-notes/vMAJOR.MINOR.PATCH.md
- Examples: v1.0.0.md, v1.2.0.md, v1.3.0.md
- Released notes are read-only history: a correction goes in the next release note, never in a shipped one.
- The release PR body lives beside them, under release-notes/draft/PR-vX.Y.Z.md.

## Template

`npx tsx scripts/release-prepare.ts --version X.Y.Z` scaffolds release-notes/vX.Y.Z.md from the block below
(it resolves `vX.Y.Z`, `X.Y.Z`, the previous tag `vX.Y.Z-1` and `YYYY-MM-DD`, and unescapes the inner code fences);
copying the block by hand works too. Omit sections that do not apply (do not leave empty headings).
The release PR body has its own template: [PR_TEMPLATE.md](PR_TEMPLATE.md).

```markdown
# pdfnative-react vX.Y.Z

<!-- GitHub Release title: vX.Y.Z - short description -->

_Released YYYY-MM-DD_

<!-- One or two paragraphs: what the release is about (engine alignment / feature / hardening / security), the engine version it aligns with, and what did NOT change (component count, defaults, bytes). -->

<!-- Compatibility statement, e.g.: "No breaking changes: every vX.Y.Z-1 document, DocSpec and prop is still accepted and renders byte-identically except where listed under Upgrade. All new behaviour is opt-in." -->

## Highlights

<!-- 3 to 6 bullets calling out the most user-visible changes; name the real props, DocSpec keys, enum values and lint rules. -->

- **...** — ...

## Security

<!-- Only when present; keep it first. CWE reference, affected versions, mitigation. -->

- **fix(security):** ...

## Breaking Changes

<!-- Only for MAJOR bumps. Each entry: what changed, why, migration path. -->

- **BREAKING:** ...

## Added

<!-- New components, props, DocSpec fields, schema definitions, lint rules, error codes, entry points, samples, tooling. Group with ### sub-headings when long (engine surface / reproducible output / repository). State what an agent cannot guess: preconditions, engine limits, what a result does NOT establish. -->

- **feat(scope):** ...

## Changed

<!-- Non-breaking behaviour changes, the engine peer pin (`pdfnative` `^A.B.C` → `^D.E.F`), the doctor floor, the manifest contract, tooling. -->

- **deps:** ...

## Fixed

<!-- Bug fixes. Say whose bytes change and why. Reference GitHub issues (#NN) where applicable. -->

- **fix(scope):** ... ([#NN])

## Deprecated

- **deprecate(scope):** ... Will be removed in vX+1.0.0.

## Removed

<!-- Only for MAJOR bumps. Cross-reference the deprecation notice. -->

- **remove(scope):** ...

## Inherited from pdfnative D.E.F

<!-- Engine issues closed upstream and therefore closed here (#NN), with the test, sample or corpus entry that proves it through the renderer. -->

- **#NN** — ...

## Deferred by design

<!-- What is NOT in this release and why: ROADMAP items, limits blocked upstream, items unchanged since the previous release, golden-rule-7 exclusions. -->

- ...

## Install

\`\`\`bash
npm install pdfnative-react@X.Y.Z pdfnative@^D.E.F react@^19
\`\`\`

## Upgrade

<!-- Declare EVERY output change and EVERY rebaselined sample here, before publication. For a PATCH release with none, the sentence below suffices and the sub-section is omitted. -->

No breaking changes. Drop-in replacement for vX.Y.Z-1.

### Migrating from vX.Y.Z-1

1. **Rebaseline once if you compare bytes.** <!-- which documents change bytes, and why the previous output was wrong or incomplete; which stay byte-identical -->
2. **...** <!-- new lint rules a document may now trip, new error classifications, changed defaults of the repository tooling -->

## Links

- CHANGELOG: ../CHANGELOG.md
- Full diff: https://github.com/Nizoka/pdfnative-react/compare/vX.Y.Z-1...vX.Y.Z
- pdfnative D.E.F release notes: https://github.com/Nizoka/pdfnative/blob/main/release-notes/vD.E.F.md
- Agent contract: ../docs/AGENT_CONTRACT.md
```

## Conventions

- GitHub Release title format: vX.Y.Z - short description. The GitHub Release body is this file.
- Decide SemVer level first (major/minor/patch). A removed or narrowed export, prop, DocSpec field, schema branch or lint severity is a major; the superset tests (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts`, `npm run typecheck:compat`) are the mechanical proof of a minor.
- Keep the sections in the order above and omit the empty ones.
- Mirror bullets in CHANGELOG.md, and add the compare link for the new `## [X.Y.Z]` heading (`verify:docs` rule `changelog-ladder`).
- Use conventional prefixes: feat(scope), fix(scope), chore(scope), docs(scope), ci(scope).
- Every figure quoted (tests, coverage, components, rules, samples, corpus verdicts) comes from a command run on the release branch — never typed from memory. `docs/assets/ecosystem.json` is the single source of counts; `npm run verify:docs` holds the note to it.
- Never name a prop, DocSpec key, enum value, component, lint rule or error code that does not exist: check `src/registry.ts` and `src/components.tsx` first.
- Include a compatibility statement for patch and minor releases. The Upgrade section declares every output change and every rebaselined sample before publication.
- Be honest about limits: say what a feature does not do and what is blocked upstream.
- English everywhere. No emojis. No `Co-Authored-By` trailer and no mention of an AI assistant in commits, PR bodies or release notes.

## Publication workflow

Full procedure: [CONTRIBUTING.md](../CONTRIBUTING.md#release).

1. `npx tsx scripts/release-prepare.ts --version X.Y.Z` — the mechanical bump and the two scaffolds.
2. Write release-notes/vX.Y.Z.md, mirror bullets into CHANGELOG.md, update ROADMAP.md.
3. `npx tsx scripts/gate.ts --publish --require-all` with veraPDF installed (every step, no SKIP).
4. Fill release-notes/draft/PR-vX.Y.Z.md. Stop: everything after this line is done by the maintainer.
5. Merge to main, tag vX.Y.Z and publish the GitHub Release.
6. The publish workflow releases to npm via OIDC Trusted Publishing and attaches the SBOM and the provenance attestation to the release.
