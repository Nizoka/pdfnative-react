# AI Governance & Human-In-The-Loop (HITL)

> How an AI agent may propose bugs and improvements for `pdfnative-react`
> **without ever writing to GitHub**. The agent is a **draftsman**; a human is
> the only gate that submits.

This guide is the narrative companion to the machine-readable contract in
[`.github/ai-governance.json`](../.github/ai-governance.json) and the
agent-and-human protocol in [`.github/AGENT_RULES.md`](../.github/AGENT_RULES.md).
It is part of the shared governance contract for the `pdfnative` family
(`pdfnative`, `pdfnative-cli`, `pdfnative-mcp`, `pdfnative-react`).

---

## 1. The one rule

**pdfnative-react contains no code path that can write to GitHub or make any
outbound network call.** The published package renders PDFs locally and nothing
more. An agent working in this repository produces a **local draft** plus a
**compliance report** and stops. A human must review the draft and submit it
themselves, under their own GitHub identity.

The only shipped guardrail is `npm run verify:issue`, a local CLI that validates
a draft — it never submits anything.

---

## 2. Why this exists

The project has properties an autonomously-filing agent would routinely break:

- **Minimal dependency surface.** pdfnative-react ships exactly one runtime
  dependency (`react-reconciler`); `pdfnative` and `react` are peers. A
  well-meaning agent that "fixes" a bug by proposing `npm install some-lib`
  violates that.
- **Signal over noise.** Auto-filed, unreproduced, or duplicate issues erode the
  tracker for human maintainers.

Keeping a human in the loop preserves both, while still letting agents do the
valuable up-front work: reproduce, categorise, and draft a high-quality issue.

---

## 3. The contract (six non-negotiable rules)

1. **No new runtime dependency** — never propose adding an external runtime npm
   package beyond the existing `react-reconciler`. (Enforced: a draft that
   suggests `npm install <pkg>`, a `yarn/pnpm/bun add`, or edits `"dependencies"`
   is rejected.)
2. **No duplicates** — search **open AND closed** issues/PRs before drafting.
3. **Local reproduction** — run a minimal repro (a component tree + a
   `renderTo*`/`compileDocument` call, or a `DocSpec` snippet) first and capture
   the exact command + result. (Enforced: the draft must contain a fenced
   ```` ``` ```` reproduction block.)
4. **Architecture & parity awareness** — respect the golden rules in
   [AGENTS.md](../AGENTS.md): the `core-bridge` engine-import rule, no
   CSS/flexbox model, the react-reconciler version contract, and `DocSpec` ↔ JSX
   parity. Report any intentional change to serialized output.
5. **Human-in-the-loop gate** — produce a **local** draft only; a human reviews
   and submits.
6. **Identity integrity** — remind the user that the issue publishes under
   **their** GitHub identity and that they share responsibility for its content.

---

## 4. The workflow

```
1. Detect a bug or improvement while working locally.
2. Reproduce it — a minimal component tree + renderTo*/compileDocument call, or a DocSpec snippet; capture the exact command + result.
3. Confirm no new runtime dependency is required (a hard blocker otherwise).
4. Search existing open AND closed issues/PRs for duplicates.
5. Write a draft markdown in .github/drafts/ with title, summary, reproduction, expected vs actual, and affected packages.
6. Validate it: npm run verify:issue -- .github/drafts/<draft>.md
7. Present the draft AND the compliance report to the user.
8. STOP. The user reviews, then manually opens the issue on GitHub under their own identity.
```

---

## 5. The compliance report

Present these fields verbatim alongside every draft:

- **no_new_runtime_dependency_confirmed** — no new runtime dependency introduced.
- **reproduction_command** — the exact command / snippet you ran.
- **reproduction_result** — the observed failure/regression.
- **duplicate_search_performed** — you searched open and closed issues.
- **affected_packages** — which packages are impacted.
- **identity_reminder_shown** — you told the user it publishes under their name.

---

## 6. Verifying a draft on disk

```bash
npm run verify:issue -- .github/drafts/<draft>.md
```

`scripts/verify-issue.mjs` rejects a draft that proposes an external runtime
dependency or omits a reproduction code block, and warns when a recommended
field is missing. Exit code `0` = pass, `1` = policy violation, `2` = usage/IO
error. `tests/governance.test.ts` exercises this CLI and asserts the repo's
governance artifacts encode the HITL policy.

A passing check is **necessary but not sufficient** — the human review gate
always applies.

---

## 7. What this repository will never do

- Open, edit, comment on, or close a GitHub issue or PR from code.
- Trigger a release automatically.
- Make any outbound network request or emit telemetry.

The agent drafts. The human decides. That is the whole contract.
