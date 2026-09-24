@AGENTS.md

# Claude Code addendum

Everything in AGENTS.md applies. This file adds only what is specific to Claude Code sessions in this repository.

## Token discipline

- Run tests through `npx tsx scripts/gate.ts --fast` or `npx vitest run <file>` (the dot reporter is configured); never paste a full test run into context.
- Never Read `dist/`, `coverage/`, `test-output/`, `samples/output/`, `package-lock.json`, `node_modules/`.
  The deny list in `.claude/settings.json` applies to Read and, at best effort, to Grep/Glob — ask the package (`capabilityManifest()`, `schema('doc-spec')`, `samples/agent/manifest.ts --json`) instead of reading `dist/`.
- A component's props are in `src/components.tsx`; its fold is in `src/reconciler/serialize.ts`; its DocSpec twin is one Grep away under `src/spec/`.
  `src/registry.ts` is the table every surface derives from — read it before adding anything.
- Read README.md, ROADMAP.md, docs/KNOWLEDGE_BASE.md and docs/AGENT_CONTRACT.md by section: `grep -n "^## "` first, then a line range. CHANGELOG.md: only the top entry.
- `.github/instructions/*.md` are the per-area rules: open the ONE matching the area you touch (table in AGENTS.md §Where is what).
- Sample regeneration: `npm run build && npm run test:generate` then `npx tsx scripts/verify-samples.ts`. Any `--update` (rebaseline) must be justified in the release note.
- Never push, never open PRs/issues/releases, never tag (HITL policy, hook-enforced). No `Co-Authored-By` trailers (`attribution.commit` is `""`).

## Gate

- `npx tsx scripts/gate.ts --fast` before proposing a commit; `npm run gate` is the CI profile; `--publish --require-all` on release branches only.
- `--only <step>` for one step, `--json` for machine output; logs in `test-output/.gate/<step>.log` — open only the failing step's log, through the shell.
- When the gate exceeds the shell timeout, run it in the background and read the result with `--json`.

## Where to look first

1. `src/registry.ts` — the block grammar, the DocSpec fields, the components, the lint rules; `tests/regression/baselines/` — every frozen 1.2.0 capture.
2. AGENTS.md §Where is what — the path → purpose → instruction-file table.
3. `docs/assets/ecosystem.json` — every count and version; `npm run verify:docs` enforces it.

## Reconciler gotcha

React 19 ↔ `react-reconciler@^0.31` ↔ `@types/react-reconciler@^0.32`: the host context must be a non-null sentinel (a `null` makes React throw "Expected host context to exist" and OOM),
`createContainer` takes 11 positional arguments, and the synchronous flush is `updateContainerSync` + `flushSyncWork`. Never render synchronously inside a React effect (`usePdf` defers through `queueMicrotask`).
`resolveLayout()` must keep returning `undefined`, never `{}`, when no sugar prop is set — or every existing document changes bytes.

## Windows session notes

- The session shell is PowerShell, with Git Bash as the Bash tool. PowerShell swallows `--` after `npm run` — call `npx tsx scripts/<name>.ts` directly.
- Multi-line `node -e` payloads and heredocs break on backticks, `$` and backslashes: write a script to the scratchpad and run it. An ESM import of an absolute Windows path needs a `file:///` URL.
- veraPDF: portable install in `%USERPROFILE%\verapdf` with a JDK; the runner reads `VERAPDF_HOME` and `JAVACMD` (the JDK's `java.exe` — `JAVA_HOME` alone is not enough when spawned from Node).
- vitest sometimes reports "no tests" right after a file write: run it again.

## Hooks and permissions in force

- `.claude/hooks/guard.mjs` (PreToolUse on Bash **and** PowerShell) denies `npm publish`/`unpublish`/`deprecate`/`dist-tag`/`version <bump>`, `gh pr|issue create|edit|close|comment` (+ `pr merge`),
  `gh release`, writing `gh api`, any `git push`, `git tag <name>` and `git add --renormalize` — in the whole command, every `&&`/`;`/`|` segment, `$( )`/backticks and
  `sh -c`/`pwsh -Command`/`node -e`/`npx -c` payloads (a quoted string holding one is refused too — write such strings with Edit, never via echo/heredoc).
  Those are submitted by the maintainer (.github/AGENT_RULES.md) — prepare, then stop. `tests/tools/guard.test.ts` is the rule table's contract.
- `permissions.deny` blocks Read on the generated bulk files above and the same write commands, for both shells;
  `permissions.allow` pre-approves `npm run`, `npx vitest`, `npx tsx scripts/*`, `npx tsx samples/*`, `npx tsc`, `npx eslint`, `node -e` and read-only git.

## Plan mode, rules and skills

- Use plan mode for multi-file changes; plans name the files, the commands and the expected gate outcome. Run `/code-review` on the branch diff before drafting a PR body.
- `.claude/rules/*.md` are generated from `.github/instructions/*.instructions.md` by `npm run agents:rules` (scoped by `paths:` = the source `applyTo`).
  Never edit a rule: edit the instruction file, then regenerate (`verify:docs` rule `claude-rules-sync` fails on drift).
- `/release-audit [release-notes/vX.Y.Z.md] [previous-tag]` (`.claude/skills/release-audit/`) is the maintainer-invoked pre-release audit:
  two auditors, an adversarial verifier, an agent-autonomy pass and a GO/NO-GO ledger under `.audit/`.

## Release

Follow CONTRIBUTING.md §Release and `scripts/release-prepare.ts`: prepare everything (version lock-step, changelog, release note, manifest,
PR draft under `release-notes/draft/`, `npx tsx scripts/gate.ts --publish --require-all`) and stop before pushing.
