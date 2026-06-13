---
applyTo: "src/components.tsx"
---

# Component instructions

`components.tsx` is the public, declarative API. Each component is a thin,
side-effect-free factory that emits a lowercase **host tag** via the typed
`h(tag, props, children)` wrapper (the tags are not DOM intrinsics).

- Map each component 1:1 onto a `pdfnative` block. Do NOT invent layout
  primitives (no `<View>`, no flexbox, no CSS props).
- Props flow straight through to `serialize.ts`; keep prop names aligned with the
  pdfnative block fields (see `docs/KNOWLEDGE_BASE.md` §5 and the block
  interfaces re-exported from `pdfnative`).
- Container components (`Document`, `Heading`, `Paragraph`, `List`, `Table`,
  `Row`, `Link`) destructure `children` out of the rest props before forwarding.
- Keep aliases intentional: `Text = Paragraph`, `Toc = TableOfContents`.
- Every exported component and its props interface needs a TSDoc comment.

When you add a component, also: add a host tag in `reconciler/nodes.ts`, a case
in `reconciler/serialize.ts`, an export in `src/index.ts`, and a test in
`tests/compile.test.tsx`.
