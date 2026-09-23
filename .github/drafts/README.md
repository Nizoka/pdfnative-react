# Drafts (Human-In-The-Loop staging area)

This directory is the **draft staging area** mandated by the AI-governance
contract ([.github/ai-governance.json](../ai-governance.json),
[.github/AGENT_RULES.md](../AGENT_RULES.md)).

AI agents write proposed GitHub issues here as local Markdown files. Nothing
in this repository — and nothing in the published `pdfnative-react` package —
can submit these drafts automatically: **a human submits everything**, under
their own identity.

## What lives here

| File | What it is | How it is produced | How it is checked |
|---|---|---|---|
| `issue-*.md` | An issue draft — an upstream engine gap (`issue-pdfnative-<topic>.md`) or a tracking issue | A filled copy of [TEMPLATE.md](TEMPLATE.md) | `npm run verify:issue` (or `validateIssueDraft()` from the package) |
| `TEMPLATE.md` | The issue-draft template | — | `npm run verify:docs` |

Release pull-request bodies do **not** live here: `scripts/release-prepare.ts`
scaffolds them under [release-notes/draft/](../../release-notes/draft/) from
[release-notes/PR_TEMPLATE.md](../../release-notes/PR_TEMPLATE.md), beside the
release note they accompany, and `npm run verify:docs` checks the links and
anchors of the current release's draft.

## Workflow — issue drafts

1. An agent produces `issue-<target>-<topic>.md` here plus a compliance report
   (no new runtime dependency confirmed, reproduction command and result,
   duplicate search, affected packages, identity reminder).
2. Validate it: `npm run verify:issue -- .github/drafts/issue-<target>-<topic>.md`
   (PowerShell swallows the bare `--`: `node scripts/verify-issue.mjs .github/drafts/issue-<target>-<topic>.md`).
   A draft that proposes a new runtime dependency, or that has no fenced reproduction block, is refused.
3. **You** review it, then manually open the issue on GitHub under your own
   identity. You share responsibility for the content.

Ad-hoc files in this directory are git-ignored so work-in-progress proposals never
leak into the repository history; this README, `TEMPLATE.md` and `issue-*.md`
are the exceptions — the submitted issue drafts are committed as the auditable
record of what was proposed.
