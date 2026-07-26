# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in **pdfnative-react**.

**[AGENTS.md](AGENTS.md) is the canonical, detailed guide** — read it, plus
[docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md), before non-trivial changes.
This file is the quick reference.

## What this is

A custom React renderer for the [`pdfnative`](https://www.npmjs.com/package/pdfnative)
PDF engine:

`JSX → components.tsx → react-reconciler → serialize.ts → DocumentParams → core-bridge → pdfnative → PDF bytes`

It is a declarative **block flow**, not a CSS/flexbox engine. There is no `<View>`.

Peer: `pdfnative` ^1.6.0 · React 19 · Node ≥ 22.

## Golden rules

1. **Runtime `pdfnative` imports go only through `src/core-bridge/index.ts`.**
   Sanctioned exception: `src/types.ts` may import *type-only*. `pdfnative` is a
   **peer dependency** — do not move it to `dependencies`.
2. **No CSS layout model.** Map 1:1 onto pdfnative blocks. `<Section>` is the one
   allowed composite (heading + children, no host tag).
3. **react-reconciler contract:** React 19 ↔ `react-reconciler@^0.31` ↔
   `@types/react-reconciler@^0.32`. Non-null host-context sentinel; 11-arg
   `createContainer`; `updateContainerSync` + `flushSyncWork`. See KB §4.
4. **Strict TypeScript, no `any`** (lint-enforced); `type`-only imports.
5. **`'use client'`** on `hooks.ts` / `viewer.tsx`; never on `src/spec/`.
6. **Keep `DocSpec` ↔ JSX in parity.** New authoring capability reaches both the
   JSX props and the `DocSpec` grammar + schema, **and `src/registry.ts`** — the
   single source the schema, `validateSpec` and `capabilityManifest()` all derive
   from (omission fails `typecheck`). Bump `src/version.ts` (the schema `$id`
   derives from it; a test pins it to `package.json` + `CITATION.cff`).
7. **Authoring only.** Byte-level post-processing (merge/split, form
   fill/flatten, text extraction, decryption, annotations, signing, crypto, font
   compilation) is the engine's job — don't re-export it. See
   [docs/RECIPES.md](docs/RECIPES.md).
8. **AI governance — draftsman, not submitter.** Never open/submit issues or PRs
   autonomously. Draft into `.github/drafts/`, run `npm run verify:issue`,
   present a compliance report, and let a human submit under their own identity.
   See [.github/AGENT_RULES.md](.github/AGENT_RULES.md) and
   [docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md).

## Validate every change

```bash
npm run typecheck:all && npm run lint && npm test && npm run build
```

Add/adjust tests under `tests/` and update `CHANGELOG.md` under **[Unreleased]**.
4-space indent (2 for JSON/YAML); keep the `src/index.ts` barrel curated.
