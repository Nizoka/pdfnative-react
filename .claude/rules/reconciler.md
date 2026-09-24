---
paths:
  - "src/reconciler/**"
---
<!-- GENERATED from .github/instructions/reconciler.instructions.md by scripts/build-claude-rules.ts — do not edit -->

# Reconciler instructions

These files implement the React custom renderer. They are the most version-
sensitive part of the codebase.

- Target the `react-reconciler@^0.31` runtime with `@types/react-reconciler@^0.32`
  typings (React 19). The types are one minor ahead of the runtime — do not
  assume they match.
- `host-config.ts` implements the full 0.32 `HostConfig` (14 generic params, the
  last being `TransitionStatus`). Many members are framework-required no-ops
  (suspense, hydration, transition/priority surface). Keep them; do not delete.
- `getRootHostContext` / `getChildHostContext` MUST return the non-null
  `HOST_CONTEXT` sentinel. Returning `null` makes React throw "Expected host
  context to exist" and spin into an OOM.
- `render.ts` uses `updateContainerSync` + `flushSyncWork` (with a `flushSync`
  fallback). `createContainer` takes 11 positional args.
- `serialize.ts` is a **pure** transform (no side effects, no engine calls). The
  root must be `<Document>` or it throws `PdfStructureError`. Strip `undefined`
  props via `compact()` (build a new object — do not `delete` keys).
  - **Nested lists** (`toListItem`): an item collects its own text from
    **non**-`item`/`list` children only (do not reuse `elementText`, which would
    swallow sub-item text), and returns a plain `string` when it has no
    sub-items so flat lists stay byte-identical.
  - **Layout sugar** (`resolveLayout`): every `<Document>` sugar prop folds
    whole into `layout` under the engine's key — no deep merge — and an
    explicit `layout` prop wins. When no sugar is set and no `layout` is given
    the result is `undefined`, never `{}`: an empty object changes the bytes of
    every existing document (`tests/layout-sugar.test.tsx` pins it).
    `creationDate` accepts a `Date` or an ISO string (`toCreationDate()`); an
    unparseable string is an `E_INPUT` `PdfReactError`, never a silent
    fallback to the clock. `keepWithNext` / `splittable` reach a block only
    when set.
- `nodes.ts` defines the in-memory host tree (`ElementNode`/`TextNode`).

When changing any of these, run `npm test` — the compile/render tests assert the
exact `DocumentParams` shape and real `%PDF-`…`%%EOF` output.
