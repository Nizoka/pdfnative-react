---
applyTo: "src/spec/**"
---

# Spec (agent authoring) instructions

`src/spec/` is the compact `DocSpec` grammar that lets AI agents author PDFs
with far fewer tokens than JSX. It is pure, isomorphic, and side-effect-free.

- **Parity by construction.** `compile.ts` must build the document by projecting
  block tuples onto the existing components via `createElement` — never
  re-implement serialization. A spec and its JSX twin must produce identical
  `DocumentParams` (tests assert `toEqual`).
- **No new model.** Block kinds map 1:1 onto the existing pdfnative blocks. Do
  not add layout primitives, and do not introduce props the components lack.
  Pure JSX sugar with no new capability (e.g. `<Section>`) is deliberately
  **not** given a tuple — agents emit the underlying blocks. Document-level
  `outline`/`pageLabels` are top-level `DocSpec` fields (not tuples), mirroring
  `<Document>`. Nested list items use `{ text, items }` in the `ul`/`ol` grammar.
- **Reuse component prop types.** Per-block opts types are derived from the
  component prop interfaces (via `Pick`/`Omit`) so the spec inherits their type
  safety and cannot drift.
- **No `'use client'`.** The spec module is render-agnostic; `renderSpec*` reuse
  the isomorphic `render*` entry points.
- **Versioned schema.** `schema.ts` builds a Draft 2020-12 JSON Schema whose
  `$id` is derived from `src/version.ts` (the single source of truth pinned to
  `package.json` by `tests/version.test.ts`). Keep `$id` in sync with the
  grammar.
- **GOTCHA.** `createElement` for default-param components (`Spacer`,
  `TableOfContents`) needs an explicit generic (`createElement<SpacerProps>`),
  or TS infers `Attributes` and rejects the extra props (TS2769).

When you add a block kind: add the tuple type in `types.ts`, a `case` in
`compile.ts`, a per-block schema builder in `schema.ts`, an export in
`src/spec/index.ts` (and `src/index.ts` if public), and a test in
`tests/spec.test.tsx`.
