# Issue & PR Drafts (Human-In-The-Loop staging area)

This directory is the **draft staging area** mandated by the AI-governance
contract ([.github/ai-governance.json](../ai-governance.json),
[.github/AGENT_RULES.md](../AGENT_RULES.md)).

AI agents write proposed GitHub issues (and PR descriptions) here as local
Markdown files. Nothing in this repository — and nothing in the published
`pdfnative-react` package — can submit these drafts automatically.

**Workflow:**

1. An agent produces `something.md` here plus a compliance report.
2. Validate it: `npm run verify:issue -- .github/drafts/something.md`
3. **You** review it, then manually open the issue/PR on GitHub under your own
   identity. You share responsibility for the content.

Ad-hoc issue drafts are intentionally git-ignored (this README and the
`pr-*.md` / `issue-*.md` release artifacts are kept) so work-in-progress
proposals never leak into the repository history.
