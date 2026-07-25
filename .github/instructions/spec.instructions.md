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
  `outline`, `pageLabels`, `watermark`, `header`, `footer`, `attachments` and
  `tagged` are top-level `DocSpec` fields (not tuples), mirroring `<Document>`.
  Nested list items use `{ text, items }` in the `ul`/`ol` grammar.
- **`src/registry.ts` is the single source of truth.** `schema.ts` derives
  `$defs.block.oneOf` — including each tuple's kind discriminator, arity and
  description — from `BLOCK_REGISTRY`, and `validate.ts` derives its arity and
  payload rules from the same table. Never restate any of that in a builder.
  Compile-time `Assert<Equals<…>>` locks make omission a `tsc` failure.
- **`validate.ts` is the dependency-free dry run.** `validateSpec(unknown)` must
  never throw and must never recurse without a depth bound — it is the gate for
  untrusted input. Unknown top-level fields are a *warning*, so a newer spec
  meeting an older package degrades gracefully. `KNOWN_FIELDS` is locked to
  `keyof DocSpec` at compile time.
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

When you add a block kind, all ten steps are required — the first five are
enforced by the compiler, so skipping any of them fails `npm run typecheck`:

1. `src/reconciler/nodes.ts` — the host tag.
2. `src/components.tsx` — the component and its props.
3. `src/reconciler/serialize.ts` — the `case` in `toBlock`.
4. `src/spec/types.ts` — the tuple type, added to the `BlockSpec` union.
5. **`src/registry.ts`** — the `BLOCK_REGISTRY` and `COMPONENT_REGISTRY` entries.
6. `src/spec/compile.ts` — the `case` (the `never` guard will demand it).
7. `src/spec/schema.ts` — the builder, registered in `BLOCK_SCHEMAS`.
8. `src/spec/index.ts` and `src/index.ts` — export the new types.
9. `tests/` — a serialization test **and** a `compileSpec` ↔ JSX parity test,
   plus the ordered list in `tests/registry.test.ts`.
10. `samples/`, `samples/README.md`, `llms.txt`, `README.md`, `CHANGELOG.md`.

The same discipline applies to a lint rule: add it to `LINT_RULES` in
`src/registry.ts`, implement it in `src/lint.ts`, list it in
`EMITTED_LINT_RULES`, and add a test — the registry alone cannot catch a rule
that is declared but never emitted.
