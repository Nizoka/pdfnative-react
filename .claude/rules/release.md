---
paths:
  - "release-notes/**"
  - "CHANGELOG.md"
  - "ROADMAP.md"
  - ".github/drafts/**"
  - "docs/assets/ecosystem.json"
---
<!-- GENERATED from .github/instructions/release.instructions.md by scripts/build-claude-rules.ts — do not edit -->

# Release Standards

## Structure
- One file per release: `release-notes/vX.Y.Z.md` (scaffold: `release-notes/TEMPLATE.md`). Released notes are read-only history.
- The release PR body is drafted at `release-notes/draft/PR-vX.Y.Z.md` from `release-notes/PR_TEMPLATE.md` (committed; the maintainer opens the PR).
- Keep sections ordered and omit empty sections.
- Use conventional prefixes in bullets: feat(scope), fix(scope), chore(scope), docs(scope), ci(scope).
- English everywhere. No `Co-Authored-By` trailer and no mention of an AI assistant in commits, PR bodies or release notes (`.claude/settings.json` `attribution.commit` is empty).

## Required parity
- CHANGELOG entry must mirror release bullets; every `## [X.Y.Z]` heading has a compare link (`verify:docs` rule `changelog-ladder`).
- GitHub Release body comes from `release-notes/vX.Y.Z.md`.
- Include a compatibility statement, and an **Upgrade** section that declares every output change and every rebaselined sample BEFORE publication.
- Every figure quoted (tests, coverage, components, rules, samples, corpus verdicts) comes from a command run on the release branch — never typed from memory. `docs/assets/ecosystem.json` is the single source of counts; `npm run verify:docs` holds the documents to it.
- A new prop, DocSpec field, lint rule or error code is a change to the agent contract (`docs/AGENT_CONTRACT.md`, the JSON Schema, `capabilityManifest()`): call it out in the note.

## Publication flow
1. `npx tsx scripts/release-prepare.ts --version X.Y.Z` — mechanical bump (package.json + lock, `src/version.ts`, `CITATION.cff`, `SECURITY.md`, manifest stamps) and scaffolds. It never moves the `pdfnative` peer pin, `REQUIRED_ENGINE` or `contract.engine`: decide those together, and extend `tests/regression/engine-surface.json` in the same change.
2. Write `release-notes/vX.Y.Z.md`, mirror into `CHANGELOG.md`, update `ROADMAP.md`.
3. `npx tsx scripts/gate.ts --publish --require-all` with veraPDF installed (every step, no SKIP).
4. If output changed on purpose: `npx tsx scripts/verify-samples.ts --update`, explain it in the provenance note and the Upgrade section.
5. Run the `release-audit` skill; fix what it confirms.
6. Write `release-notes/draft/PR-vX.Y.Z.md`. **Stop.** The maintainer pushes, opens the PR, tags and publishes.

## Human-in-the-loop (never done by an agent — the guard hook refuses them)
- `git push`, `gh pr create`, tags, the GitHub Release, `npm publish`.
- Importing `.github/rulesets/*.json`, creating the protected `npm-publish` environment and binding the npm Trusted Publisher to it.
- The LF renormalisation commit (`git add --renormalize .`).
- Updating the `pdfnative-react` entry of `docs/assets/ecosystem.json` in pdfnative, pdfnative-cli and pdfnative-mcp.

## Rollback
- **npm:** Trusted Publishing runs from the tag — do **not** publish manually. If a bad version ships, do **not** unpublish; cut a superseding patch (vX.Y.Z+1) and, if within npm's 72 h window and truly broken, the maintainer deprecates the bad version.
- **Tags are immutable once released** (`.github/rulesets/tags.json`). A mistake = new patch tag, never a force-moved tag.
