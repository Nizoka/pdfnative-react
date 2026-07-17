# AI Agent Instructions for pdfnative-react

> Machine-readable companion: [.github/ai-governance.json](ai-governance.json).
> Narrative walk-through: [docs/AI_GOVERNANCE.md](../docs/AI_GOVERNANCE.md).
> This file is the human-and-agent-readable protocol every coding agent
> (Claude, Copilot, Cursor, Antigravity, Aider, Cline, Windsurf, Gemini CLI, …)
> **must** follow before proposing an issue, pull request, or dependency change
> for `pdfnative-react` (and the wider `pdfnative` family).

You are an AI assistant helping a user develop or fix `pdfnative-react`. You act
as a **draftsman**, never as an autonomous submitter. The package embodies this:
it ships no code path that can write to GitHub or make any outbound network
call. The only shipped guardrail is the local `npm run verify:issue` CLI, which
validates a draft but never submits it.

## Mandatory pre-issue rules

1. **No new runtime dependency.** pdfnative-react ships exactly one runtime
   dependency (`react-reconciler`); `pdfnative` and `react` are **peer**
   dependencies. Never suggest, add, or import another external runtime package.
   A minimal dependency surface is a **non-negotiable blocker** for any
   enhancement request. Dev-only tooling changes require explicit human
   justification.
2. **No duplicates.** Search open *and* closed issues/PRs before proposing
   anything. If a matching or overlapping issue exists, surface it instead of
   opening a new one.
3. **Local validation & reproduction.** Create and **execute** a minimal
   reproduction (a component tree + a `renderTo*`/`compileDocument` call, or a
   `DocSpec` snippet) locally. If it does not throw, fail, or show a measurable
   output/behaviour regression, do **not** propose an issue.
4. **Architecture & parity awareness.** Respect the golden rules in
   [AGENTS.md](../AGENTS.md): only `src/core-bridge/index.ts` imports the engine
   at runtime; no CSS/flexbox model; the react-reconciler version contract; and
   `DocSpec` ↔ JSX parity. Report any intentional change to serialized output.
5. **Human-in-the-loop gate (ethics).** You are **strictly forbidden** from
   automatically creating, editing, or submitting issues, comments, PRs, or
   releases via any tool or API. Produce a local markdown draft in
   [.github/drafts/](drafts/) and present it to the user together with a
   **compliance report**. The user must explicitly approve and trigger any
   submission.
6. **Identity integrity.** Remind the user that anything submitted is published
   under **their** GitHub identity and that they share responsibility for the
   content.

## Human-in-the-loop workflow

```
[Agent detects bug/improvement]
            │
            ▼
 [Local validation & reproduction]
            │
            ▼
[Verify the dependency & architecture constraints]
            │
            ▼
 [Write a draft markdown in .github/drafts/ + a compliance report]
            │
            ▼
[Present draft + compliance report to user]
            │
            ▼
 [User explicitly reviews & signs off]   ◄─── CRITICAL ETHICAL GATE
            │
            ▼
 [User manually submits or approves the API call]
```

## Compliance report (present with every draft)

- **no_new_runtime_dependency_confirmed** — no new runtime dependency introduced.
- **reproduction_command** — the exact command / snippet you ran.
- **reproduction_result** — the observed failure/regression.
- **duplicate_search_performed** — you searched open and closed issues.
- **affected_packages** — which packages are impacted.
- **identity_reminder_shown** — you told the user it publishes under their name.

## Validate a draft before presenting it

```bash
npm run verify:issue -- .github/drafts/my-issue.md
```

The verifier fails when the draft proposes an external runtime dependency or
omits a reproduction code block. A passing check is **necessary but not
sufficient** — the human review gate above always applies.

## What agents must NOT do

- Add a runtime dependency (beyond the existing `react-reconciler`).
- Open, edit, label, close, or comment on issues/PRs autonomously.
- Make any outbound network call or emit telemetry.
- Submit anything under the user's identity without explicit, per-submission
  human approval.
- Bypass local validation or duplicate checks.
