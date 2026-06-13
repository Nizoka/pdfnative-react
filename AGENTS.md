# AGENTS.md

Guidance for AI coding agents (and humans) working in the **pdfnative-react**
repository. Keep edits minimal, typed, tested, and idiomatic.

## What this project is

A **custom React renderer** for the [`pdfnative`](https://www.npmjs.com/package/pdfnative)
PDF engine. JSX → React reconciler → `pdfnative` `DocumentParams` → PDF bytes.
It is a **declarative block flow**, not a CSS/flexbox layout engine. There is no
`<View>`.

Start by reading [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md).

## Project layout

| Path | What |
|---|---|
| `src/components.tsx` | Public components; each emits a lowercase host tag. |
| `src/reconciler/nodes.ts` | Host tree node types. |
| `src/reconciler/host-config.ts` | react-reconciler `HostConfig` (mutation mode). |
| `src/reconciler/serialize.ts` | Pure host tree → `DocumentParams` transform. |
| `src/reconciler/render.ts` | `compile(node)`. |
| `src/render.ts` | `renderToBytes/Blob/Stream/File`, `compileDocument`. |
| `src/hooks.ts` | `usePdf`, `usePdfStream` (client). |
| `src/viewer.tsx` | `PDFViewer`, `PDFDownloadLink`, `BlobProvider` (client). |
| `src/core-bridge/index.ts` | The only file allowed to import `pdfnative`. |
| `src/spec/` | Compact `DocSpec` grammar, compiler, and JSON Schema (agent authoring). |
| `src/version.ts` | Single source of truth for the package version. |
| `src/types.ts` | Public types + pdfnative re-exports. |
| `src/index.ts` | Public barrel. |
| `samples/` | Runnable, type-checked examples (gated by `typecheck:samples`). |
| `tests/` | vitest (jsdom). |

## Golden rules

1. **All pdfnative imports go through `src/core-bridge/index.ts`.** Never import
   `pdfnative` elsewhere.
2. **Do not invent a CSS layout model.** Map to the existing pdfnative blocks.
3. **Respect the react-reconciler version contract** (see Knowledge Base §4).
   React 19 ↔ `react-reconciler@^0.31` ↔ `@types/react-reconciler@^0.32`.
   - `getRootHostContext`/`getChildHostContext` must return a **non-null**
     sentinel, or React throws "Expected host context to exist" and OOMs.
   - `createContainer` takes **11** positional args in the 0.32 typings.
   - Use `updateContainerSync` + `flushSyncWork` (with a `flushSync` fallback).
4. **Strict TypeScript, no `any`.** Lint enforces this.
5. **Client modules carry `'use client'`** (`hooks.ts`, `viewer.tsx`). The
   `src/spec/` layer is pure/isomorphic — do **not** add `'use client'` there.
6. **Keep `DocSpec` and JSX in parity.** `src/spec/compile.ts` must build the
   tree from the existing components, never re-implement serialization. Bump
   `src/version.ts` (not an inline literal) when the version changes, and keep
   the JSON Schema `$id` derived from it.

## Token-frugal agent authoring (`src/spec/`)

For LLM agents, the compact `DocSpec` is the cheapest way to author a document:
terse JSON tuples that compile to the **same** PDF as the equivalent JSX. Prefer
it when generating documents programmatically; validate with `docSpecSchema()`.
See Knowledge Base §7 for the contract and gotchas.

## Validate every change

```bash
npm run typecheck:all
npm run lint
npm test
npm run build
```

Add or update tests under `tests/` for any behavioural change, and update
`CHANGELOG.md` under **[Unreleased]**.

## Conventions

- 4-space indent (2 for JSON/YAML).
- `type`-only imports where applicable.
- Keep the public barrel (`src/index.ts`) curated and intentional.
