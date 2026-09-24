---
paths:
  - "src/components.tsx"
---
<!-- GENERATED from .github/instructions/components.instructions.md by scripts/build-claude-rules.ts — do not edit -->

# Component instructions

`components.tsx` is the public, declarative API. Each component is a thin,
side-effect-free factory that emits a lowercase **host tag** via the typed
`h(tag, props, children)` wrapper (the tags are not DOM intrinsics).

- Map each component 1:1 onto a `pdfnative` block. Do NOT invent layout
  primitives (no `<View>`, no flexbox, no CSS props). The one exception is
  `Section` — a *composite* that returns a `Fragment` of `<Heading>` + children
  (optionally a leading `<PageBreak>`); it emits no host tag, so it needs no
  `nodes.ts`/`serialize.ts` case.
- Props flow straight through to `serialize.ts`; keep prop names aligned with the
  pdfnative block fields (see `docs/KNOWLEDGE_BASE.md` §5 and the block
  interfaces re-exported from `pdfnative`).
- Container components (`Document`, `Heading`, `Paragraph`, `List`, `Table`,
  `Row`, `Link`) destructure `children` out of the rest props before forwarding.
- Keep aliases intentional: `Text = Paragraph`, `Toc = TableOfContents`.
- Every exported component and its props interface needs a TSDoc comment, and
  the comment states the engine-side limits a consumer cannot guess (which
  options need a registered font, which are no-ops on the bundled fonts, what
  `pdfx` refuses) — each is a lint rule before it is an engine throw.
- Document-level sugar (`watermark`, `header`, `footer`, `attachments`,
  `tagged`, `print`, `pdfx`, `outputIntent`, `typography`, `creationDate`) is a
  `<Document>` prop folded by `resolveLayout()` — never a component. A new
  engine layout option follows the same pattern and gets a `DocSpec` twin.
- Colour props are typed `Color` (hex, RGB tuple, CMYK tuple, operand string);
  `ParagraphAlign` (`Align | 'justify'`) is for paragraphs only — `Align` is
  shared by images, barcodes, SVG and charts and must stay three-valued.
- Compile-time locks (`ChartPropsCoversChartBlock`,
  `TypographyPropsCoverTypographyOptions`) make an engine key that is not
  reachable from JSX a build error: extend them for every engine object a prop
  mirrors.

When you add a component:

1. `reconciler/nodes.ts` — add the host tag.
2. `reconciler/serialize.ts` — add the `case` in `toBlock`. **Compiler-enforced:**
   a missing case fails `npm run typecheck` on the `const exhaustive: never` guard.
3. **`src/registry.ts`** — add the `COMPONENT_REGISTRY` entry. **Compiler-enforced:**
   `ComponentRegistryIsExhaustive` fails typecheck if a `HostTag` has no component.
4. `src/index.ts` — export the component and its props type.
5. `tests/compile.test.tsx` — a serialization test, plus the ordered list in
   `tests/registry.test.ts`.
6. If it adds authoring capability, mirror it in the `DocSpec` grammar + schema
   (`src/spec/`) — see `spec.instructions.md` for that checklist — and refresh
   `tests/compile-snapshot.test.tsx` deliberately, reading the diff.

Composites like `Section` skip steps 1–3: they emit no host tag, and
`COMPONENT_REGISTRY` records them with `tag: null`. A test asserts `Section` is
the *only* one.

Client-side components (`PDFViewer`, `PDFDownloadLink`, `BlobProvider`) go in
`CLIENT_COMPONENT_REGISTRY` instead, and must be re-exported from
`src/client.ts` so they reach the `pdfnative-react/client` subpath.
