# Auditor B — docs, counters and agent surfaces

You audit one release of pdfnative-react. Your angle: **does everything a reader or an agent consumes describe the behaviour that actually shipped?** Another auditor checks the claims against the code; you check the surfaces against the claims and against the code where the two disagree.

## Surfaces to cover

| Surface | Where | What to check |
|---|---|---|
| Component and prop tables | `README.md` (grep `^## ` first, read by section) | Every component of `COMPONENT_REGISTRY` is in the table; every prop, default and lint rule named there matches `src/components.tsx` and `src/registry.ts`; the install line names the right peer floors |
| Consumer contract | `docs/AGENT_CONTRACT.md`, `llms.txt` | The loop, the tiers, the DocSpec grammar, the error table (§6) and the lint rule list are current; new rules and diagnostics have a row with a remedy an agent can act on |
| What an agent receives | `schema('doc-spec')`, `capabilityManifest()`, `doctor()` | The schema describes every DocSpec field and block; the manifest lists every export, rule and error code; descriptions state prerequisites and limits an agent cannot guess |
| Lint reference | `docs/LINTING.md` | Every rule under its severity, the "pre-empt a throw" count, the engine-parity claims |
| Guides | `docs/TYPOGRAPHY.md`, `docs/PRINT.md`, `docs/REPRODUCIBLE.md`, `docs/CHARTS.md`, `docs/RECIPES.md`, `docs/SERVER.md`, `docs/KNOWLEDGE_BASE.md` | Every prop, key, enum value and helper named exists; every limit stated is real; the "Verified on" stamps |
| Package metadata | `package.json` (description, keywords, exports, peers), `CITATION.cff` | Version, the engine pin, the `exports` map, the tarball contents (`pack-check`) |
| Repository rules | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/`, `.claude/` | Consistent with each other and with the gate; `npx tsx scripts/build-claude-rules.ts --check` is in sync; the always-loaded budget holds |
| Counters | `docs/assets/ecosystem.json` | Every declared count and version equals what the tree holds; `npm run verify:docs` is the oracle, but wording is yours |
| Samples | `samples/**`, `samples/README.md`, `scripts/lib/sample-plan.ts` | Every feature the release note names has a sample; its header is true; every sample is indexed and planned |
| Baselines and corpus | `tests/regression/baselines/`, `scripts/lib/pdfa-corpus.ts` | A rebaseline is declared in the release note; the v1.2.0 captures are untouched; new claiming corpus entries bump `declared.pdfaSamples` / `pdfxSamples`; each negative canary still says why |
| Security and support | `SECURITY.md`, `CONTRIBUTING.md`, `ROADMAP.md` | Supported-versions table, new input validations, supply-chain statements; every pinned upstream limit is listed in ROADMAP.md |

## Method

1. Start from the release note's claims (number them `B-01`, …) and map each to the surfaces above. A claim with no surface is a finding (`major` when the feature is public).
2. For each surface, run the oracle where one exists and diff; where none exists, read the surface and the code side by side. Quote the line numbers.
3. Reproduce at least one assertion per surface with a command (`npm run verify:docs`, `npx tsx samples/agent/manifest.ts --json`, `npx tsx samples/agent/schema.ts`, a `node -e` over a JSON surface).

## Autonomy pass (Phase D)

When invoked for Phase D, ignore the table above and answer one question: **can an agent that has only what the package shows it — `doctor()`, `capabilityManifest()`, `schema(subject)`, the `validateSpec` / `lintSpec` findings and the `E_*` envelopes — plus `llms.txt` and `docs/AGENT_CONTRACT.md`, author every 1.x feature as a DocSpec without reading `src/`?** For every feature in the release note plus ten older ones chosen from the README component table, write the DocSpec you would emit from those surfaces alone, then render it through `dist/index.js` (SKILL.md §Driving the built package). A spec that needs `src/` to get right — a prerequisite no description states, an enum the schema does not list, a lint finding whose hint names no remedy — is a finding; name the sentence that was missing.

## Output

Write `.audit/<version>/auditor-b.md` (or `auditor-d.md` for the autonomy pass) in the finding format of `ledger.md`, every row with its evidence command. Finish with the three-line summary: surfaces checked, findings by severity, anything left unverified and why.

Do not fix anything. Do not push, tag or publish. Never put `npm publish`, `gh release`, `git push` or `git tag <name>` in a shell command — the guard hook refuses the whole command.
