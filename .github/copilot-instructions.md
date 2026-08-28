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
  barcode, svg, **chart**, formField). `<Section>` is the single allowed
  *composite* (it resolves to a heading + children, emitting no host tag).
- **`src/registry.ts` is the single source of truth** for the block grammar, the
  component list and the lint rules. `src/spec/schema.ts`, `src/spec/validate.ts`
  and `src/manifest.ts` all *derive* from it — never restate a kind, an arity or
  a rule in those files. Compile-time `Assert<Equals<…>>` locks mean forgetting
  to register something fails `npm run typecheck`. See the 10-step checklist in
  [AGENTS.md](../AGENTS.md).
- **`pdfnative` is a peer dependency** (`^1.7.0`; Node ≥ 22). Never move it back
  to `dependencies`.
- **Authoring only.** Do not re-export byte-level post-processing (merge/split,
  form fill/flatten, text extraction, decryption, annotations, signing, crypto,
  font compilation) — point to [docs/RECIPES.md](../docs/RECIPES.md) instead.
- **Document-level props on `<Document>`**, not content blocks: `outline` and
  `pageLabels` (they reference post-layout pages), plus the layout sugar
  `watermark`, `header`, `footer`, `attachments`, `tagged`, `print`. The sugar folds into
  `layout` via `resolveLayout()`, where an explicit `layout` always wins — and
  which must keep returning `undefined`, never `{}`, when nothing is set, or
  every existing document changes bytes.
- **Agent-facing surface must stay honest.** `doctor()` must never throw;
  `validateSpec()` must never throw and must bound its recursion; `schema()` must
  reject unknown subjects with `E_INPUT` (use `Object.hasOwn`, not a truthiness
  check); `capabilityManifest()` must list *every* public export, and a test
  locks both directions.
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
- **Client modules carry `'use client'`** (`hooks.ts`, `viewer.tsx`), and are
  re-exported from `src/client.ts`, which is built as the separate
  `pdfnative-react/client` subpath so the directive reaches `dist/client.*`.
  The root bundle must never carry it — marking it would break every server
  usage — and `src/response.ts` is server-side by design.
- **Strict TypeScript, no `any`** (lint-enforced). Use `type`-only imports.
- **AI governance (draftsman, never submitter).** Do not open/submit issues or
  PRs autonomously. Draft into `.github/drafts/`, validate with
  `npm run verify:issue`, present a compliance report, and let a human submit.
  See [.github/AGENT_RULES.md](AGENT_RULES.md) and [docs/AI_GOVERNANCE.md](../docs/AI_GOVERNANCE.md).

## Validate every change

```bash
npm run typecheck:all && npm run lint && npm test && npm run build
```

Add/adjust tests under `tests/` and update `CHANGELOG.md` under **[Unreleased]**.

## Style

- 4-space indentation (2 for JSON/YAML), per `.editorconfig`.
- Keep the public barrel `src/index.ts` curated and intentional.
- Prefer small, focused diffs; avoid unrelated refactors.
