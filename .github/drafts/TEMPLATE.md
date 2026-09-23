# <Issue title: what is wrong or missing, in one line, without a version number>

<!--
Issue draft template (human-in-the-loop). Copy this file to .github/drafts/issue-<target>-<topic>.md,
replace every <placeholder>, delete this comment, then run:

    npm run verify:issue -- .github/drafts/issue-<target>-<topic>.md
    (PowerShell: node scripts/verify-issue.mjs .github/drafts/issue-<target>-<topic>.md)

`validateIssueDraft(markdown)` from the package applies the same rules at runtime.
The verifier refuses a draft that proposes a new runtime dependency or that has no fenced reproduction
block, and warns when the reproduction, the environment or the expected behaviour is missing
(.github/ai-governance.json: `required_issue_fields`, `pre_issue_checklist`).
Nothing in this repository submits a draft: a human reviews it and opens the issue under their own identity.
-->

> **Type:** <bug | feature | docs | question> · **Target:** <pdfnative | pdfnative-cli | pdfnative-mcp | pdfnative-react>

## Summary

<Two to five sentences: what happens, where (the component or DocSpec key, the engine function it reaches), and why it
matters to a consumer. For a feature request: the smallest API that would close the gap, and why the renderer cannot
provide it itself without reimplementing the engine. State that no new dependency is involved.>

## Minimal reproduction

Command / document:

```
<The exact command, JSX or DocSpec, reduced to the smallest input that shows the behaviour. It must run
offline, from a clean checkout, without any secret.>
```

Result:

```
<The output as printed: the error code and message, the lint finding, or the wrong bytes. Trim it, never paraphrase it.>
```

## Expected behavior

<What should happen instead, with the clause of the specification it follows from when there is one
(ISO 32000, ISO 19005, ISO 15930, an RFC).>

## Actual behavior

<What happens today, and the workaround the renderer applies in the meantime, if any: the lint rule, the test or the
corpus canary that pins the limit, and the ROADMAP.md entry that tracks it.>

## Environment

- Node: <`node -v`>
- OS: <platform and version>
- pdfnative-react: <version>
- pdfnative: <version>
- react / react-dom: <version>
- `doctor()`: <the report, one line per check>
- Affected packages: <pdfnative, pdfnative-react, …>

## Compliance

<!-- Tick a box only when it is true. The five lines mirror `pre_issue_checklist` in .github/ai-governance.json. -->

- [ ] No new runtime dependency proposed
- [ ] Searched open and closed issues/PRs for duplicates
- [ ] Minimal reproduction executed locally
- [ ] Expected vs actual documented
- [ ] Environment captured

Compliance report (the fields of `compliance_report.required_fields`, as presented to the reviewer):

| Field | Value |
|---|---|
| `no_new_runtime_dependency_confirmed` | <true> |
| `reproduction_command` | <the command above> |
| `reproduction_result` | <the result above, one line> |
| `duplicate_search_performed` | <true — the search terms used> |
| `affected_packages` | <pdfnative, …> |
| `identity_reminder_shown` | <true> |

---

> This draft, if submitted, is published under YOUR GitHub identity. You share responsibility for its content. Review it fully before you open the issue manually.

> DRAFT ONLY. pdfnative-react never opens, edits, or submits GitHub issues, comments, PRs, or releases, and makes no outbound network call. A human MUST explicitly review this draft and submit it themselves.
