# v1.0.0 — Stable API + the engine 1.5.0 authoring features

> **Branch:** `release/v1.0.0` → `main`
> **Type:** Stable release (one breaking change: `pdfnative` → peer dependency)
> **pdfnative:** `^1.5.0` (peer + dev)

## Summary

v1.0.0 marks the public API of **pdfnative-react** as stable under semantic
versioning. It integrates the document-*authoring* features the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) engine added through
1.5.0 and ships the conveniences originally planned for 0.4.0. Three themes:

1. **Engine 1.4/1.5 authoring surface** — bookmarks/outline & page labels on
   `<Document>`, viewer preferences and a layout debug overlay via `layout`,
   `inspectDocument`/`inspectSpec`, nested lists, table `cellBorders`/
   `cellVAlign`, and SVG `<text>` as native selectable text.
2. **0.4.0 conveniences** — `<Section>`, `resolveFonts`/`options.fonts`, and the
   `fromUrl`/`fromBase64` image helpers, plus `renderToFileStream`.
3. **Stability, scope & governance** — `pdfnative` becomes a peer dependency; the
   package's scope is stated explicitly (authoring, not byte-level
   post-processing); and the `pdfnative` family's AI human-in-the-loop governance
   contract is adopted here (draftsman-only, `npm run verify:issue`).

## Breaking change

- **`pdfnative` moved from `dependencies` to `peerDependencies` (`^1.5.0`)**, and
  is also a `devDependency` for local tests. Consumers install it themselves
  (`npm install pdfnative-react pdfnative react`). Matches how the engine is
  already external in the tsup build; lets apps control the engine version.

## Changes

### `src/core-bridge/index.ts`
- Re-exports `inspectDocumentLayout` and `streamToFile` (runtime), plus the new
  engine types (`OutlineItem`, `PageLabelRange`, `PageLabelStyle`,
  `ViewerPreferences`, `LayoutDebugOptions`, `LayoutInspection`,
  `InspectedPage`/`InspectedBlock`, `CellBorders`, `ListItem`,
  `StreamToFileResult`, `FontData`). Still the only runtime `pdfnative` import.

### `src/components.tsx`
- `<Document>` gains `outline` (`OutlineItem[] | 'auto'`) and `pageLabels`.
- `<Section>` — the one composite component (heading + children; `level`,
  `color`, `break`), resolved before the reconciler runs.
- `<List>`/`<Item>` accept nested items (child `<List>`, nested `<Item>`, or the
  `items` data prop with `{ text, items }`).
- `<Table>` gains `cellBorders` and `cellVAlign`.

### `src/reconciler/serialize.ts`
- Document-level `outline`/`pageLabels` pass through; table `cellBorders`/
  `cellVAlign` forwarded. New `toListItem`/`subItemsOf` recursion emits a plain
  `string` for leaf items (byte-identical to the flat case) or `{ text, items }`
  for nested ones — collecting the item's own text from **non**-`item`/`list`
  children so sub-item text is never swallowed into the parent label.

### `src/render.ts` + new `src/fonts.ts` + new `src/assets.ts`
- `inspectDocument(node, options?)` and `renderToFileStream(node, path, options?)`
  (constant memory; verified to preserve `/Outlines`).
- `resolveFonts(map)` registers loaders and returns `FontEntry[]`; internal
  `optionsWithFonts` resolves `options.fonts` for the async entries.
  `RenderOptions.fonts` + `FontsMap`/`FontLoader` types added.
- `validateFontData(data)` re-exported (opt-in font check) + `FontValidationResult`.
- `fromUrl(url, init?)` / `fromBase64(payload)` produce `<Image>` bytes.

### `src/spec/` (DocSpec parity)
- `DocSpec` gains `outline`/`pageLabels`; `ul`/`ol` items accept nested
  `ListItem`s; `TableSpecBody` gains `cellBorders`/`cellVAlign`. New `inspectSpec`
  and `renderSpecToFileStream`. `schema.ts` adds recursive `listItem`/
  `outlineItem` `$defs`, `outline`/`pageLabels` top-level props, and the
  previously-missing table body fields. No `['sec']` tuple (sugar only).

### `src/hooks.ts`
- `usePdf`/`usePdfStream` resolve `options.fonts` asynchronously (memoized per
  fonts-object identity), preserving the microtask defer + cancellation contract.

### Samples & tests
- 11 new samples (outline, viewer-preferences, debug-inspect, nested-lists,
  cell-borders, math, svg-text, section, fonts-prop, image-helpers,
  stream-to-file); `samples/README.md` updated.
- Tests extended across compile/render/options/spec/hooks/version (incl. the
  flat-list regression guard, the streaming-`/Outlines` check, and a
  `CITATION.cff` version pin).

### New: AI-governance / human-in-the-loop contract
- Adopts the `pdfnative` family's governance contract for this repo:
  `.github/ai-governance.json` (draftsman role, HITL-mandatory, no autonomous
  GitHub writes, minimal-dependency policy), `.github/AGENT_RULES.md`, a
  `.github/drafts/` staging area (git-ignored except the README/release
  artifacts), `docs/AI_GOVERNANCE.md`, and a dependency-free
  `scripts/verify-issue.mjs` CLI wired as `npm run verify:issue`.
- `tests/governance.test.ts` exercises the CLI (pass / dependency-violation /
  missing-repro) and asserts the `ai-governance.json` policy + `AGENT_RULES.md`
  + drafts staging area. The draftsman rule is added to `AGENTS.md`, `CLAUDE.md`,
  and `.github/copilot-instructions.md`.

### Docs & governance
- `README.md` (peer-dep install, new feature sections, a "Migrating 0.2 → 1.0"
  note, the post-processing boundary, and an AI-governance doc link),
  `docs/KNOWLEDGE_BASE.md`, `llms.txt`, `ROADMAP.md` (React 18 → non-goal;
  0.2.x/0.4.0 shipped), `CHANGELOG.md` (1.0.0 with Breaking Changes),
  `SECURITY.md` (1.x table), `CITATION.cff`.
- `CLAUDE.md` added (points to `AGENTS.md`); `AGENTS.md` and the Copilot
  instruction files updated; `.github/CODEOWNERS` globs fixed to real paths.

## Validation

- `npm run typecheck:all` → clean (src + tests + samples).
- `npm run lint` → clean.
- `npm run test:coverage` → **79 / 79 passing** (8 files); statements **92.5 %**,
  branches **85.3 %**, functions **96.2 %**, lines **94.3 %** (thresholds met).
- `npm run verify:issue` → the governance CLI validates a draft (pass / fail).
- `npm run build` → dual ESM + CJS + types; `pdfnative` stays external.
- All 11 new samples emit valid PDFs (`fromUrl` degrades gracefully offline).

## Backward compatibility

- One breaking change: `pdfnative` is now a peer dependency. Everything else is
  additive — new components/props/functions and type re-exports; the existing
  component/render/hook/spec surface is unchanged and flat lists still serialize
  to `string[]`.

## Out of scope (by design)

- **React 18** — non-goal; the reconciler is bound to a single React 19
  `react-reconciler` contract.
- **No CSS/flexbox/`<View>`** — declarative block flow.
- **Byte-level post-processing** (merge/split, annotations, signing, crypto,
  font compilation) — use the `pdfnative` engine directly; deliberately not
  re-exported.

## Self-review checklist

- [x] Only `src/core-bridge/index.ts` imports `pdfnative` at runtime;
      `src/types.ts` keeps its sanctioned type-only import.
- [x] No CSS/flexbox/`<View>`; new blocks map 1:1 onto pdfnative (Section is
      pure sugar, no host tag).
- [x] `DocSpec` ↔ JSX parity preserved; nested lists/outline/pageLabels/table
      styling forwarded and tested.
- [x] Spec module stays pure/isomorphic — no `'use client'`.
- [x] Schema `$id` derived from `src/version.ts`; version pinned to
      `package.json` **and** `CITATION.cff`.
- [x] Strict TypeScript, no `any` (one contained `as` widening in `resolveFonts`
      for the engine's over-strict font-loader type); `type`-only imports.
- [x] `renderToFileStream` verified to preserve `/Outlines`; flat-list output
      unchanged (regression test).
- [x] AI-governance contract shipped (draftsman-only, HITL); `verify:issue` CLI
      + `tests/governance.test.ts` green; the library makes no GitHub/network calls.
- [x] Coverage green; 79/79 tests; `typecheck:all`, lint, build all clean.
