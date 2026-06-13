# v0.2.0 — The declarative renderer + a token-frugal agent authoring layer

> **Branch:** `release/v0.2.0` → `main`
> **Type:** First implemented release (v0.1.0 reserved the name only — no
> functional surface existed to break)
> **pdfnative:** `^1.3.0` (peer/runtime)

## Summary

v0.2.0 is the first functional release of **pdfnative-react** — the declarative
React renderer for the [`pdfnative`](https://www.npmjs.com/package/pdfnative)
PDF engine. JSX compiles, via a custom React reconciler, into a `pdfnative`
`DocumentParams` object and renders real PDF bytes — no DOM, no headless
browser, no native modules. Three themes, one release:

1. **The renderer** — 17 components mapped 1:1 onto the pdfnative block flow
   (`Document`, `Page`, `Heading`, `Paragraph`/`Text`, `List`/`Item`,
   `Table`/`Row`/`Cell`, `Image`, `Link`, `Spacer`, `PageBreak`,
   `TableOfContents`/`Toc`, `Barcode`, `Svg`, `FormField`), four render targets
   (`renderToBytes`/`Blob`/`Stream`/`File` + `compileDocument`), client hooks
   (`usePdf`, `usePdfStream`) and preview components (`PDFViewer`,
   `PDFDownloadLink`, `BlobProvider`).
2. **Token-frugal agent authoring** — a compact, JSON-serializable `DocSpec`
   grammar that lets autonomous AI agents emit documents with several times
   fewer tokens than JSX, and compiles to the **same** PDF because it is built
   on the very same components. No MCP server (that is
   [`pdfnative-mcp`](https://www.npmjs.com/package/pdfnative-mcp)), no daemon, no
   new runtime dependency — just a grammar + a versioned JSON Schema.
3. **Exhaustive samples + supply-chain transparency** — a type-checked
   `samples/` tree covering every capability, a CycloneDX SBOM attached to each
   release, and provenance-signed npm publishes (OIDC Trusted Publishing).

## Changes

### New: `src/spec/` (token-frugal agent authoring)
- `types.ts` — the `DocSpec` grammar: block tuples `[kind, …payload, opts?]`
  whose per-block opts types are derived from the component prop interfaces
  (via `Pick`/`Omit`) so the spec inherits the components' type safety and can
  never drift. `TableRowSpec` accepts a `string[]` (widened to
  `{ cells, type:'default', pointed:false }`) or a full `PdfRow`.
- `compile.ts` — `blockToElement` projects each tuple onto the existing
  components via `createElement`; `specToElement(spec)` builds the `<Document>`
  tree; `compileSpec` + `renderSpecToBytes`/`Blob`/`Stream`/`File` reuse the
  isomorphic `render*` pipeline. Parity is guaranteed by construction.
- `schema.ts` — `docSpecSchema()` returns a Draft 2020-12 JSON Schema whose
  `$id` (`https://pdfnative.dev/schema/react/<version>/doc-spec.schema.json`)
  embeds the package version; `docSpecSchemaId()` returns it. Pure data.
- `index.ts` — spec barrel.

### New: `src/version.ts`
- Single source of truth for the package version (a separate module to avoid an
  import cycle between the barrel and the schema). `tests/version.test.ts` pins
  it to `package.json`.

### `src/index.ts`
- Re-exports the spec surface (`compileSpec`, `specToElement`, `renderSpec*`,
  `docSpecSchema`, `docSpecSchemaId`, and the `DocSpec`/`BlockSpec` types) and
  now sources `version` from `src/version.ts`.

### New: `samples/`
- `text/typography`, `table/data-table`, `media/{image,link,barcode,svg}`,
  `forms/form-fields`, `structure/sections`, `fonts/custom-fonts`,
  `layout/page-setup` (PDF/A-2b), `client/{use-pdf,viewer}` (`'use client'`),
  and `agent/{compact-spec,schema}` — plus the original `invoice`/`report`.
  Every runnable sample produces a valid PDF.
- `samples/tsconfig.json` + a new `typecheck:samples` script folded into
  `typecheck:all` so the samples are a CI gate. `samples/README.md` indexes them.
  (Replaces the old root `tsconfig.samples.json`.)

### New: tests
- `tests/spec.test.tsx` — asserts `compileSpec` `toEqual` the equivalent JSX
  `compileDocument`, `ol`→numbered / `ul`→bullet, `PdfRow` objects alongside
  string arrays, `['page', …]` grouping, all media/link/svg/field/img blocks,
  `h1`/`h2`/`h3` and all five barcode formats, real `renderSpec*` PDF output
  (`%PDF-…%%EOF`), `renderSpecToFile`, and the schema `$id`/version.
- `tests/version.test.ts` — pins `version` to `package.json` (reads it via
  `process.cwd()`; an `import.meta.url` file URL breaks under jsdom).

### Docs & governance
- `README.md` — full 0.2.0 rewrite (components/render/hooks tables, a migration
  table from `@react-pdf/renderer`, a **"Agent authoring (token-frugal)"**
  section, a samples index, and an OpenSSF Scorecard badge).
- `docs/KNOWLEDGE_BASE.md` — new **§7 Agent authoring contract** (parity rules,
  the versioned schema, the `createElement` default-param gotcha).
- `AGENTS.md` — `src/spec/`/`src/version.ts`/`samples/` in the layout table, a
  golden rule to keep `DocSpec`↔JSX in parity, and a token-frugal authoring note.
- `CHANGELOG.md`, `release-notes/v0.2.0.md`, `ROADMAP.md` — DocSpec, schema,
  samples, and SBOM entries. `CITATION.cff` + `package.json` keywords
  (`ai-agent`, `agentic`, `json-schema`, `sbom`, `supply-chain`). `llms.txt` —
  the compact-spec grammar.
- `.github/instructions/spec.instructions.md` — `applyTo: src/spec/**` authoring
  contract (parity-by-construction, no `'use client'`, versioned `$id`).
- `.github/workflows/publish.yml` — SHA-pinned actions, `timeout-minutes: 20`,
  `contents: write` + `id-token: write`, verify-dist + import smoke test, and
  CycloneDX SBOM generate→upload→attach. `ci.yml` — `typecheck:all` now covers
  samples; sample changes trigger CI.

## Validation

- `npm run typecheck:all` → clean (src + tests + samples).
- `npm run lint` → clean.
- `npx vitest run --coverage` → **46 / 46 passing**; thresholds met — statements
  **94.29 %**, branches **84.61 %**, functions **97.7 %**, lines **95.73 %**.
- `npm run build` → CJS **26.25 KB**, ESM **24.64 KB**, types **27.12 KB**
  (`.d.ts` + `.d.cts`).
- `npm pack --dry-run` → `pdfnative-react-0.2.0.tgz`, 9 files, **69.5 kB**
  (README + dist + types only).
- Smoke: `require('./dist/index.cjs')` exposes `renderToBytes`,
  `renderSpecToBytes`, `docSpecSchema`, `version === '0.2.0'`; the ESM import
  resolves the same surface. All 12 runnable samples emit valid PDFs.

## Backward compatibility

- v0.1.0 was a **name-reservation placeholder** with no functional API, so there
  is no prior surface to break.
- Everything in this PR beyond the base renderer is **additive**: the `DocSpec`
  layer and the schema are new exports; the component/render/hook surface is
  unchanged. `version` moving to `src/version.ts` is internal (the exported
  value is identical).

## Out of scope (by design)

- **MCP / daemon / HTTP** — covered by the separate
  [`pdfnative-mcp`](https://www.npmjs.com/package/pdfnative-mcp) server; this
  package stays a library.
- **No new runtime dependency** — `pdfnative` remains the only one; the SBOM
  generator is CI-only.
- **No CSS/flexbox/`<View>`** — pdfnative is a declarative block flow by design.
- **React 18** — tracked for 0.3.0 (the react-reconciler peer/type matrix makes
  dual-support costly to do correctly).

## Self-review checklist

- [x] Only `src/core-bridge/index.ts` imports `pdfnative`; the spec layer reuses
      the existing components/render pipeline (no new engine surface).
- [x] No CSS/flexbox/`<View>` introduced; block kinds map 1:1 onto pdfnative.
- [x] `DocSpec` ↔ JSX parity is asserted (`compileSpec` `toEqual`
      `compileDocument`) and guaranteed by construction.
- [x] The spec module is pure/isomorphic — **no** `'use client'`; `renderSpec*`
      reuse the isomorphic `render*` entry points.
- [x] Schema `$id` is derived from `src/version.ts`, which a test pins to
      `package.json`.
- [x] Strict TypeScript, no `any`; `type`-only imports; ESM-first `.js` imports.
- [x] `pdfnative` is still the only runtime dependency (SBOM generator is CI-only).
- [x] Coverage thresholds green; 46/46 tests pass; `typecheck:all` (incl.
      samples), lint, build, and `npm pack --dry-run` all clean.
