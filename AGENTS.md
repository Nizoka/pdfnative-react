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
| `src/components.tsx` | Public components; each emits a lowercase host tag. `Section` is the one composite (no host tag). |
| `src/reconciler/nodes.ts` | Host tree node types. |
| `src/reconciler/host-config.ts` | react-reconciler `HostConfig` (mutation mode). |
| `src/reconciler/serialize.ts` | Pure host tree → `DocumentParams` transform. |
| `src/reconciler/render.ts` | `compile(node)`. |
| `src/render.ts` | `renderToBytes/Blob/Stream/File/FileStream`, `compileDocument`, `inspectDocument`. |
| `src/fonts.ts` | `resolveFonts` (loader map → `FontEntry[]`). |
| `src/assets.ts` | `fromUrl` / `fromBase64` image-byte helpers. |
| `src/hooks.ts` | `usePdf`, `usePdfStream` (client). |
| `src/viewer.tsx` | `PDFViewer`, `PDFDownloadLink`, `BlobProvider` (client). |
| `src/core-bridge/index.ts` | The only file that imports `pdfnative` at runtime. |
| `src/spec/` | Compact `DocSpec` grammar, compiler, and JSON Schema (agent authoring). |
| `src/version.ts` | Single source of truth for the package version. |
| `src/types.ts` | Public types + pdfnative type-only re-exports. |
| `src/index.ts` | Public barrel. |
| `samples/` | Runnable, type-checked examples (gated by `typecheck:samples`). |
| `tests/` | vitest (jsdom). |

## Golden rules

1. **All runtime pdfnative imports go through `src/core-bridge/index.ts`.** The
   one sanctioned exception: `src/types.ts` may import *type-only* from
   `pdfnative`. Never import the engine's runtime elsewhere. (`pdfnative` is a
   **peer dependency** — never move it back to `dependencies`.)
2. **Do not invent a CSS layout model.** Map to the existing pdfnative blocks.
   `<Section>` is the single allowed *composite* (heading + children, no host
   tag); do not add more composites without a reason.
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
   tree from the existing components, never re-implement serialization. Any new
   authoring capability (e.g. outline, page labels, nested lists, table cell
   styling) must reach both the JSX props and the `DocSpec` grammar + schema.
   Bump `src/version.ts` (not an inline literal) when the version changes — the
   JSON Schema `$id` derives from it, and a test pins it to `package.json` and
   `CITATION.cff`.
7. **Authoring only.** Byte-level post-processing (merge/split, annotations,
   signatures, crypto, font compilation) is the engine's job — do not re-export
   it. Document "use `pdfnative` directly" instead.

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
