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
- **`pdfnative` is a peer dependency** (`^1.8.0`; Node ≥ 22). Never move it back
  to `dependencies`. The pin, `REQUIRED_ENGINE` in `src/doctor.ts`,
  `contract.engine` in `src/manifest.ts` and `docs/assets/ecosystem.json` move
  together (`verify:docs` rule `peer-pin-parity`), with the engine-surface
  matrix `tests/regression/engine-surface.json`.
- **Authoring only.** Do not re-export byte-level post-processing (merge/split,
  form fill/flatten, text extraction, decryption, annotations, signing, crypto,
  font compilation) — point to [docs/RECIPES.md](../docs/RECIPES.md) instead.
- **Document-level props on `<Document>`**, not content blocks: `outline` and
  `pageLabels` (they reference post-layout pages), plus the layout sugar
  `watermark`, `header`, `footer`, `attachments`, `tagged`, `print`, `pdfx`,
  `outputIntent`, `typography`, `creationDate`. The sugar folds into `layout`
  via `resolveLayout()`, where an explicit `layout` always wins — and which
  must keep returning `undefined`, never `{}`, when nothing is set, or every
  existing document changes bytes. Typography is a layout option, never a
  component.
- **Colour props accept CMYK** (a four-element percent tuple or a four-operand
  string) beside hex and RGB; `Color` admits the tuple. `Align` stays
  three-valued; `ParagraphAlign` adds `'justify'` for paragraphs only.
- **The library reads no environment variable.** A pinned date, a compressor or
  a hyphenation provider is set through an exported helper by the host; the
  repository scripts honour `SOURCE_DATE_EPOCH`, the package never will.
- **JSDoc states the engine-side limits** a consumer cannot guess: which options
  need a registered font, which are no-ops on the bundled fonts, what `pdfx`
  refuses. Every such limit is a lint rule before it is an engine throw.
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
npm run gate:fast      # typecheck:all, lint, test, verify:docs — while iterating
npm run gate           # the CI profile: + build, dist checks, samples, coverage, corpus, PDF/X
```

The gate (`scripts/gate.ts`) is the single definition of green; do not run the
four commands by hand and call it done. Add/adjust tests under `tests/` and
update `CHANGELOG.md` under **[Unreleased]**. Every count and version quoted in
the docs comes from `docs/assets/ecosystem.json` (`npm run verify:docs`).
`.claude/rules/*.md` are generated from `.github/instructions/` — edit the
source and run `npm run agents:rules`. English everywhere (`verify:docs` rule
`prose-language`); no `Co-Authored-By` trailer.

## Style

- 4-space indentation (2 for JSON/YAML), per `.editorconfig`.
- Keep the public barrel `src/index.ts` curated and intentional.
- Prefer small, focused diffs; avoid unrelated refactors.
