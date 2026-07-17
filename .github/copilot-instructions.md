# pdfnative-react — GitHub Copilot instructions

You are working in **pdfnative-react**, a custom React renderer for the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) PDF engine. JSX is compiled
by a React reconciler into a `pdfnative` `DocumentParams` object, which is then
rendered to PDF bytes. It is a **declarative block flow**, not a CSS/flexbox
layout engine — there is no `<View>`.

Read [docs/KNOWLEDGE_BASE.md](../docs/KNOWLEDGE_BASE.md) and
[AGENTS.md](../AGENTS.md) before making non-trivial changes.

## Architecture (one line)

`JSX → components.tsx → react-reconciler (host-config.ts) → host tree (nodes.ts) → serialize.ts → DocumentParams → core-bridge → pdfnative → PDF bytes`

## Hard rules

- **Only `src/core-bridge/index.ts` may import `pdfnative`.** Everything else
  imports from there or from `src/types.ts`.
- **Never add a CSS/flexbox layout model.** Map components 1:1 onto pdfnative
  blocks (heading, paragraph, list, table, image, link, spacer, pageBreak, toc,
  barcode, svg, formField). `<Section>` is the single allowed *composite* (it
  resolves to a heading + children, emitting no host tag).
- **`pdfnative` is a peer dependency.** Never move it back to `dependencies`.
- **Authoring only.** Do not re-export byte-level post-processing (merge/split,
  annotations, signing, crypto, font compilation) — point to the engine instead.
- **Document-level `outline`/`pageLabels`** live on `<Document>` props (they
  reference post-layout pages), not as content blocks.
- **react-reconciler version contract:** React 19 ↔ `react-reconciler@^0.31` ↔
  `@types/react-reconciler@^0.32`. Specifically:
  - `getRootHostContext`/`getChildHostContext` must return a **non-null**
    sentinel (returning `null` makes React throw "Expected host context to
    exist" and OOM).
  - `createContainer` takes **11** positional args in the 0.32 typings.
  - The synchronous flush API is `updateContainerSync` + `flushSyncWork` (with a
    `flushSync` fallback) — `flushSync` does not exist on the 0.31 runtime.
- **Do not run the renderer synchronously inside a React effect/commit.** `usePdf`
  defers `renderToBytes` via `queueMicrotask` to avoid reconciler reentrancy
  (which deadlocks). Preserve this when editing hooks.
- **Client modules carry `'use client'`** (`hooks.ts`, `viewer.tsx`).
- **Strict TypeScript, no `any`** (lint-enforced). Use `type`-only imports.

## Validate every change

```bash
npm run typecheck:all && npm run lint && npm test && npm run build
```

Add/adjust tests under `tests/` and update `CHANGELOG.md` under **[Unreleased]**.

## Style

- 4-space indentation (2 for JSON/YAML), per `.editorconfig`.
- Keep the public barrel `src/index.ts` curated and intentional.
- Prefer small, focused diffs; avoid unrelated refactors.
