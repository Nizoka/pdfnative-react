---
name: release-audit
description: Pre-release audit of pdfnative-react — two parallel auditors (claims vs code; docs, counters and agent surfaces), an adversarial verifier, an agent-autonomy pass and a GO/NO-GO ledger under .audit/<version>/. Run by the maintainer before every release; never invoked by the model on its own.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(npm run *), Bash(npx tsx scripts/*), Bash(npx tsx samples/*), Bash(npx vitest *), Bash(node -e *), Bash(git diff*), Bash(git log*), Bash(git show*), Agent
argument-hint: [release-notes/vX.Y.Z.md] [previous-tag]
---

# Release audit

Audit the release described by `$0` (default: the newest `release-notes/v*.md`) against everything that changed since `$1` (default: the previous `v*` tag from `git tag -l`). The audit produces findings, never fixes: every fix goes through the normal edit → gate loop afterwards, and the ledger records what was fixed.

Read `ledger.md` first for the ledger and verdict formats. Each phase below hands a template to the agents it spawns; the agents return findings, you file them.

## Ledger location

`.audit/<version>/` — git-ignored (check `.gitignore` covers it before writing; it is NOT under `test-output/`, which Claude Code is denied to Read), so nothing here is ever committed. One Markdown file per report: auditor-a, auditor-b, verifier-1, auditor-d, verifier-2, then the ledger and the verdict (formats in `ledger.md`).

## Phase A and B — two auditors, in parallel

Spawn both with the Agent tool in the same message (distinct angles; neither sees the other's report):

- **Auditor A — claims vs code.** Template: `auditor-a.md`. Every claim in the release note and the top CHANGELOG entry is checked against `src/`, `tests/`, `samples/` and `scripts/`; at least one assertion per claim is *reproduced with a command* (a test, a script, a sample run, a `node -e` over `dist/index.js`), not inferred from reading.
- **Auditor B — docs and agent surfaces.** Template: `auditor-b.md`. The README, `docs/AGENT_CONTRACT.md`, `llms.txt`, the JSON Schema and `capabilityManifest()` as an agent receives them, `docs/LINTING.md`, `samples/README.md`, `docs/assets/ecosystem.json` counters, the sample baseline, the conformance corpus, the compatibility baselines — every surface an agent or a human reads — compared with the behaviour that actually shipped.

Both write their report in the finding format of `ledger.md` (id, severity, claim, evidence command, observed, expected).

## Phase C — adversarial verifier

Spawn one verifier (template: `verifier.md`) with both reports. It re-derives every finding from scratch — re-runs the evidence command, reads the cited lines — and stamps each one `CONFIRMED | DOWNGRADED | REJECTED | DUPLICATE` with a one-line justification. Auditors have about 10 % false findings; the verifier exists to keep them out of the ledger. A finding the verifier cannot reproduce is `REJECTED`, not "probably fine".

## Phase D — agent-autonomy pass, then verify

Spawn Auditor D (template: `auditor-b.md`, section "Autonomy pass") with one question: *can an agent that has only what the package shows it — `doctor()`, `capabilityManifest()`, `schema(subject)`, `validateSpec` / `lintSpec` findings, the `E_*` envelopes — plus `llms.txt` and `docs/AGENT_CONTRACT.md`, author every 1.x feature as a DocSpec without reading `src/`?* It picks every feature the release note names plus a sample of older ones, writes the DocSpec it would emit from those surfaces alone, and renders it through `dist/index.js`. Then a second verifier pass (template: `verifier.md`) over its findings.

## Phase E — GO / NO-GO

Merge the confirmed findings into the ledger, then write the verdict file (both formats are in `ledger.md`):

- **GO** — no CONFIRMED finding of severity `blocker`; every `major` has a fix commit or an explicit maintainer waiver in the ledger.
- **NO-GO** — otherwise. List the blockers first, each with its evidence command, so the fix loop starts from the ledger, not from memory.

Report the verdict, the counts per severity and per stamp, and the ledger path. Do not push, tag, open a PR or publish: `scripts/release-prepare.ts` and the maintainer take over from `GO`.

## Driving the built package

`dist/index.js` is an ESM module: one render is one `node --input-type=module -e` command that imports it with a `file://` URL (Windows refuses a bare drive path as a specifier), builds a `DocSpec`, calls `renderSpecToBytes()` and writes or hashes the result — `tests/regression/reproducible-build.test.ts` is the same harness in test form. A sample is `npx tsx samples/<dir>/<name>.tsx` from a scratch directory (it writes its PDF to the current directory). The JSON Schema is `schema('doc-spec')`; the manifest is `capabilityManifest()`; `samples/agent/manifest.ts --json` prints it.

## Known blind spots

Add a check for each of these to the auditor briefs; they are where an audit of this renderer misses something.

- **Two doors, one model.** Every authoring capability exists twice: a JSX prop and a DocSpec key. `tests/spec.test.tsx` proves parity for what it names; a prop added to `components.tsx` without its `spec/types.ts` + `spec/compile.ts` + `spec/schema.ts` twin ships silently to JSX only. For each new prop, compile the same document through both doors and diff the models.
- **The registry locks are decorative until proven.** `src/registry.ts` ends with `Assert<Equals<…>>` types and `tests/registry.test.ts` pins the tables; both must fail when an entry is deleted. A lock that only one of them enforces is a finding.
- **`'use client'` and the two bundles.** `dist/client.*` must open with the directive, `dist/index.*` must never carry it; tsup's rollup pass strips both and `scripts/postbuild.mjs` restores them. The gate's `dist-probe` step checks the artefact, but a new client module exported from the root barrel is invisible to it — grep `src/index.ts` for anything from `hooks.ts` or `viewer.tsx`.
- **Layout sugar folding.** `resolveLayout()` must keep returning `undefined`, never `{}`, when no sugar is set, or every existing document changes bytes; an explicit `layout` wins over every sugar prop. A new sugar prop that deep-merges instead of folding whole is a behaviour change.
- **The `exports` map and its types.** Four entry points, ESM and CJS, each with its own `.d.ts` / `.d.cts`. The gate's `pack-check` runs publint and @arethetypeswrong/cli; a new subpath needs `typesVersions` too, or `moduleResolution: node` consumers lose its types.
- **Baseline ≠ exhaustive proof.** The byte baseline holds 38 samples; a feature none of them exercises can change bytes for a consumer without moving a hash. For every "byte-identical" claim, name the sample or test that would have moved.
- **Golden rule 7 has two sides.** Nothing byte-level is re-exported (an audit finding if it is), but every such capability the release note mentions must have its one-line recipe in `docs/RECIPES.md`.
- **One bridge.** `src/core-bridge/index.ts` is the only runtime import of `pdfnative` under `src/`; the scripts and the byte-checking tests are the documented exception. Grep `from 'pdfnative'` under `src/` — anything outside the bridge and `types.ts` (type-only) is a blocker.
- **Error classification.** `toErrorEnvelope` maps engine messages to `E_INPUT` by prefix (`ENGINE_INPUT_ERROR_PREFIXES`); a new engine throw with a new prefix arrives as `E_RUNTIME`. Trigger each new engine throw and check the code.
