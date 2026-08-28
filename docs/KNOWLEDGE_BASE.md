# Knowledge Base — pdfnative-react

This document explains how pdfnative-react is built and why. It is the reference
for contributors and for AI agents working in this repository.

## 1. What this package is

pdfnative-react is a **custom React renderer** for the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) PDF engine. You compose a
document with JSX components; a React reconciler compiles that tree into a
`pdfnative` `DocumentParams` object; the engine renders it to PDF bytes.

It is **not** a CSS/flexbox layout engine. pdfnative models a document as an
ordered *flow of blocks*, and pdfnative-react exposes those blocks 1:1.

## 2. The compile pipeline

```
 JSX tree
   │  React.createElement (via component factories in components.tsx)
   ▼
 Host tree of ElementNode / TextNode      (reconciler/nodes.ts)
   │  react-reconciler (mutation mode)     (reconciler/host-config.ts)
   ▼
 RootContainer { children: HostNode[] }
   │  serialize()                          (reconciler/serialize.ts)
   ▼
 DocumentParams { title, blocks, … }       (pdfnative model)
   │  buildDocumentPDFBytes / …Stream      (core-bridge/index.ts → pdfnative)
   ▼
 Uint8Array  (a valid PDF: %PDF-… …%%EOF)
```

Key properties:

- **Synchronous & DOM-free.** `compile()` reconciles into an in-memory tree and
  serializes immediately. There is no DOM, no async scheduling, no Suspense.
- **Single source of truth.** Every pdfnative import funnels through
  `src/core-bridge/index.ts`, keeping the engine surface small and auditable.

## 3. Module map

| Module | Responsibility |
|---|---|
| `src/components.tsx` | Public component factories; each emits a lowercase host tag. `Section` is the one *composite* (no host tag). |
| `src/reconciler/nodes.ts` | Host tree node types (`ElementNode`, `TextNode`, `RootContainer`). |
| `src/reconciler/host-config.ts` | The react-reconciler `HostConfig` (mutation mode). |
| `src/reconciler/serialize.ts` | Pure transform: host tree → `DocumentParams`. |
| `src/reconciler/render.ts` | `compile(node)` — drives the reconciler and serializes. |
| `src/render.ts` | `renderToBytes/Blob/Stream/File/FileStream`, `compileDocument`, `inspectDocument`. |
| `src/response.ts` | `renderToResponse` — web-standard `Response`, streaming by default. Server-only; **never** `'use client'`. |
| `src/client.ts` | The `pdfnative-react/client` subpath entry. Re-exports the hooks and viewer components; built separately so the `'use client'` directive reaches `dist/client.*`. |
| `src/lint.ts` | `lintDocument` — runs on the *compiled* model, so JSX and `DocSpec` share one implementation. |
| `src/registry.ts` | **Single source of truth**: block grammar, components, lint rules. Pure data, no engine import. See §9. |
| `src/errors.ts` | `ErrorCode`, `PdfReactError`, `PdfStructureError`, `toErrorEnvelope`. |
| `src/manifest.ts` | `capabilityManifest()` — derived wholly from `registry.ts`, `errors.ts` and `spec/schema.ts`. |
| `src/doctor.ts` | `doctor()` — environment pre-flight. Every check is wrapped; it must never throw. |
| `src/governance.ts` | `aiGovernancePolicy`, `agentRulesText`, `validateIssueDraft`. |
| `src/fonts.ts` | `resolveFonts` (loader map → `FontEntry[]`) + internal `optionsWithFonts`. `validateFontData` is re-exported from `core-bridge`. |
| `src/assets.ts` | `fromUrl` / `fromBase64` image-byte helpers (pure, no engine import). |
| `src/hooks.ts` | `usePdf`, `usePdfStream` (client). |
| `src/viewer.tsx` | `PDFViewer`, `PDFDownloadLink`, `BlobProvider` (client). |
| `src/core-bridge/index.ts` | The only place that imports `pdfnative` at runtime. |
| `src/spec/validate.ts` | `validateSpec` — structural validation with no JSON-Schema engine. |
| `src/types.ts` | Public types + type-only re-exports of the pdfnative model. |
| `src/index.ts` | Public barrel. |

Two import-graph invariants worth preserving:

- **`src/registry.ts` imports nothing at runtime.** That is what lets
  `spec/schema.ts` describe a lint report without importing `lint.ts` — and
  therefore without dragging the engine into the schema path. Emitting a schema
  stays a pure, dependency-free operation. (It is also why `LINT_RULES` lives in
  the registry and is merely *re-exported* from `lint.ts`.)
- **`core-bridge` imports `estimateChartHeight` and `validatePrintOptions` as
  capability probes** for `doctor()` — a 1.6.0 marker and a 1.7.0 marker,
  probed newest-first for graded messaging. Probing beats parsing a version
  string out of `package.json` — it survives bundling into a browser build,
  which the CLI learned the hard way when tsup flattened its `require` away.
  `validatePrintOptions` doubles as the implementation of the `L_PRINT_BOXES`
  lint rule (the engine's own validator, called in a try/catch, so the finding
  carries the engine's message and can never drift). Together with `PG_W`/`PG_H`
  (the engine's default page size, imported for the same rule), none of these
  are re-exported from the public barrel.

The golden rule has one sanctioned exception: `src/types.ts` may import
*type-only* from `pdfnative` directly. All *runtime* imports go through
`core-bridge`. `src/types.ts` also defines the ergonomic `FontLoader`
(`() => Promise<unknown>`) rather than re-exporting the engine's stricter one,
because the auto-generated font-data modules do not structurally satisfy it
under `strict`; `resolveFonts` widens to the engine's loader type in one spot.

## 4. react-reconciler version contract

This is the single most fragile dependency relationship. Three versions must
move together:

| React | `react-reconciler` runtime | `@types/react-reconciler` |
|---|---|---|
| 19 | `^0.31` | `^0.32` |

Notes learned the hard way:

- The **types and runtime are skewed by one minor**: `@types@0.32` describes the
  `0.31` runtime. Do not assume the type version equals the runtime version.
- The `0.32` `HostConfig` has **14 generic parameters** (the last is
  `TransitionStatus`) and requires the transition/priority and
  suspense-on-commit members (`setCurrentUpdatePriority`, `maySuspendCommit`,
  `waitForCommitToBeReady`, …). `prepareUpdate` was removed; `commitUpdate` is
  `(instance, type, prevProps, nextProps, handle)`.
- `getRootHostContext` / `getChildHostContext` **must return a non-null value.**
  React uses `null` as its internal "no context" sentinel and will throw
  *"Expected host context to exist"* (then spin into an OOM) if you return
  `null`. We return a frozen empty object.
- `createContainer` takes **11 positional args** in `0.32` (it added
  `onDefaultTransitionIndicator` before `transitionCallbacks`).
- The synchronous flush API was renamed: the `0.31` runtime exposes
  `updateContainerSync` + `flushSyncWork`, not `flushSync`. `render.ts` prefers
  the new pair and falls back to `flushSync(fn)` for older runtimes.

## 5. Serialization rules (`serialize.ts`)

- Text for a block comes from its `text` prop, otherwise from the concatenated
  text of its children.
- `<List ordered>` → `style: 'numbered'`; otherwise `'bullet'`.
- **Nested lists** (`toListItem`): an `<Item>` serializes to a plain `string`
  when it has no sub-items (byte-identical to the flat case), or to a
  `{ text, items }` `ListItem` otherwise. Its own text collects **only**
  non-`item`/`list` children — reusing `elementText` here would wrongly swallow
  the sub-items' text into the parent label. Sub-items come from the `items`
  prop, directly nested `<Item>` children, or a nested child `<List>`.
- `<Table>` headers come from the `headers` prop or the first `<Row header>`;
  data rows come from the `rows` prop or `<Row>`/`<Cell>` children;
  `cellBorders`/`cellVAlign` pass straight through.
- **Document-level** `outline` and `pageLabels` are `<Document>` props (not
  content blocks) — they reference post-layout page indexes, like `metadata`.
- **Layout sugar** (`watermark`, `header`, `footer`, `attachments`, `tagged`) is
  likewise `<Document>` props: page furniture, not blocks in the flow. Making
  them components would mean host tags with no corresponding pdfnative block,
  which golden rule 2 forbids. `resolveLayout()` folds them into `layout` under
  the engine's keys, with an explicit `layout` prop always winning — mirroring
  how `RenderOptions.layout` overrides `DocumentParams.layout` in `prepare()`.
  **Critical invariant:** when no sugar prop is set and no `layout` is given,
  `resolveLayout` returns `undefined`, never `{}`. An empty object would change
  the serialized bytes of every existing document; `tests/layout-sugar.test.tsx`
  pins this.
- `<Section>` is a **composite** component: React resolves it to a `<Heading>`
  (optionally preceded by `<PageBreak>`) plus its children *before* the
  reconciler runs, so the serializer never sees a `section` host tag.
- `<Page>` siblings are joined with an inserted `pageBreak` block.
- The root must be `<Document>`; otherwise a `PdfStructureError` is thrown.
- `undefined` props are stripped so emitted JSON is deterministic.

## 6. Testing

- `tests/compile.test.tsx` — asserts the `DocumentParams` shape for every block,
  including outline/pageLabels, nested lists (all forms + the flat-list
  regression), `<Section>`, and table `cellBorders`/`cellVAlign`.
- `tests/render.test.tsx` — asserts real PDF output (`%PDF-` … `%%EOF`) for
  bytes/blob/stream/file, `renderToFileStream` (and that `/Outlines` survives the
  streaming path), `inspectDocument` geometry, `fromUrl`/`fromBase64`, and
  `resolveFonts`.
- `tests/options.test.tsx` — layout/font merge behavior and that
  `viewerPreferences`/`debug` survive it.
- `tests/hooks.test.tsx` — exercises `usePdf`/`usePdfStream` under jsdom,
  including the async `options.fonts` path.
- `tests/compile-snapshot.test.tsx` — a committed golden snapshot of the compiled
  model for a document using every block and every document-level prop. The rest
  of the suite asserts *shapes*; this asserts the whole output, so a serializer
  change that silently drops a prop or reorders blocks cannot pass unnoticed.
  When it changes, read the diff before running `vitest -u`.
- `tests/viewer.test.tsx` — `PDFViewer`, `PDFDownloadLink` (both children forms)
  and `BlobProvider`.
- `tests/spec.test.tsx` — asserts `compileSpec` parity with the equivalent JSX,
  nested list/outline/pageLabels/cellBorders forwarding, `inspectSpec`, real
  `renderSpec*` PDF output, and the JSON Schema `$id`/version/recursive `$defs`.
- `tests/version.test.ts` — pins `version` to `package.json` and `CITATION.cff`
  (reads them via `process.cwd()`; `import.meta.url` file URLs break under jsdom),
  plus the engine peer floor, the single-runtime-dependency rule, and that
  `llms.txt` ships in the tarball.
- `tests/registry.test.ts` — locks the exact, ordered registry contents and
  cross-checks the derived schema. See §9.
- `tests/chart.test.tsx` — `<Chart>` serialization, every chart type, DocSpec
  parity, real PDF output.
- `tests/layout-sugar.test.tsx` — the sugar-folding rules and the
  `layout === undefined` invariant.
- `tests/response.test.tsx` — the HTTP contract, streaming vs buffered, and that
  both modes emit identical bytes.
- `tests/lint.test.tsx` — one assertion per lint rule, plus `lintSpec ≡ lintDocument`.
- `tests/agent.test.tsx` — the error taxonomy (including that
  `PdfStructureError` is still the same class object on its legacy import path),
  the manifest ↔ barrel cross-check, `doctor`, and `validateSpec`.
- `tests/schema.test.ts` — every subject, the versioned `$id`, and the
  `docSpecSchema()` backward-compatibility alias.
- `tests/governance.test.ts` — the `verify-issue.mjs` CLI as a black box, the
  exported policy against `.github/ai-governance.json`, and the source-level
  parity of the duplicated regex tables.
- `tests/fuzz-validate.test.ts` — deterministic structural fuzzing of
  `validateSpec` (seeded PRNG, fixed literal seed): it must never throw and
  must flag every seeded-invalid input.
- `tests/pdfua.test.tsx` — the PDF/UA round-trip: render tagged output, then
  validate the bytes with the engine's `validatePdfUA` (the one place a test
  may import the engine's *API* directly — it exercises the finished bytes,
  which the authoring surface deliberately does not re-export; the
  `pdfnative/fonts/*` data subpaths are a documented consumer pattern and
  fair game anywhere).
- jsdom lacks `URL.createObjectURL`; `tests/setup.ts` stubs it.

Beyond vitest sits the **external conformance tier**:
`scripts/generate-pdfa-corpus.mjs` renders an 11-file PDF/A corpus through the
*built* package (both authoring doors, all four conformance targets, this
release's chart/print features) into `test-output/pdfa/`, and
`scripts/validate-pdfa.mjs` validates every claiming file with the pinned
veraPDF reference validator (six outcomes: PASS/FAIL/XFAIL/XPASS/INFRA/SKIP).
Two design points matter: the corpus carries **two negative canaries** veraPDF
must reject (their absence — or an XPASS — fails the run, so a validator that
accepts everything can never turn the gate green), and without veraPDF the
runner **skips with exit 0** — a skip, not a pass; CI (`verapdf.yml` + the
pre-publish gate) sets `VERAPDF_REQUIRED=1` to fail closed. veraPDF is an
external tool, never a dependency.

## 7. Agent authoring contract (`src/spec/`)

pdfnative-react is a *library*, so the token cost LLM agents pay is **authoring**
a document, not invoking a CLI. The `src/spec/` layer gives agents a compact,
JSON-serializable grammar — `DocSpec` — that compiles to the **same**
`DocumentParams` as the equivalent JSX.

```
 DocSpec (tuples)            spec/types.ts   — the grammar
   │  specToElement()        spec/compile.ts — projects tuples onto components
   ▼
 <Document> element  ──────► the normal compile pipeline (§2)
```

Design rules:

- **Parity by construction.** `compile.ts` builds the JSX tree from the existing
  components via `createElement`, so a spec and its JSX twin can never drift.
  Tests assert `compileSpec(spec)` `toEqual` the JSX `compileDocument`.
- **Block tuples** are `[kind, …payload, opts?]`; per-block opts reuse the
  component prop types (via `Pick`/`Omit`) so the spec inherits the components'
  type safety. `TableRowSpec` accepts either a `string[]` (widened to
  `{ cells, type:'default', pointed:false }`) or a full `PdfRow`.
- **Versioned schema.** `schema(subject?)` returns a Draft 2020-12 JSON Schema
  whose `$id` is `https://pdfnative.dev/schema/react/<version>/<subject>.schema.json`
  (`version` comes from `src/version.ts`, the single source of truth that
  `tests/version.test.ts` pins to `package.json`). Seven subjects; `docSpecSchema()`
  is retained and delegates to `schema('doc-spec')`. Agents can self-validate a
  spec before rendering — or use `validateSpec`, which needs no validator at all.
- **Isomorphic, no `'use client'`.** The spec module is pure/render-agnostic;
  `renderSpec*` reuse the existing isomorphic `render*` entry points.
- **No `['sec']` tuple.** `<Section>` is JSX sugar with no capability beyond a
  heading followed by its blocks, so DocSpec stays frugal and omits it — agents
  emit `['h2', title]` + the blocks directly. Nested lists, `outline`,
  `pageLabels`, table `cellBorders`/`cellVAlign`, charts, and the layout sugar
  *are* in the grammar, because they express capability the tuples otherwise
  couldn't.
- **Body objects for data-heavy blocks.** `table`, `img`, `field` and `chart`
  take a named body (`['chart', { chartType, series, … }]`) rather than deep
  positional payloads. The token saving from positional form is marginal on a
  nested structure like `series[].values`, and named keys measurably reduce
  generation errors — which is the point of the grammar.
- **GOTCHA.** `createElement` for default-param components (`Spacer`,
  `TableOfContents`) needs an explicit generic (`createElement<SpacerProps>`),
  otherwise TS infers `Attributes` and rejects the extra props (TS2769).

## 8. Design boundaries

- **No `<View>`/flexbox.** Honest mapping to the engine's block flow.
- **React 19 only.** The reconciler is bound to a single, pinned
  `react-reconciler` contract; dual React 18/19 support is a non-goal.
- **Browser & Node.** `renderToFile` / `renderToFileStream` are Node-only
  (dynamic `node:fs`); `fromUrl`/`fromBase64` and everything else are isomorphic.
- **Authoring only.** pdfnative-react builds documents. Byte-level
  post-processing — merge/split, annotations, digital signatures, crypto
  providers, font compilation — is done with the `pdfnative` engine directly on
  the bytes this library emits. The wrapper deliberately does not re-export
  those APIs.
- **One builder, not two.** The engine also ships a legacy *table-centric*
  builder (`buildPDF`/`buildPDFBytes` over `PdfParams`: `docTitle`,
  `infoItems`, `balanceText`…). It is authoring, but it is a narrower
  predecessor of the document builder this package wraps — everything it can
  express is expressible as document blocks, and mapping JSX onto both would
  mean two serializers and two grammars for one output. Deliberately not
  surfaced; this is a decision, not an oversight.
- **Streaming has two hard limits, checked eagerly.** The engine's streaming
  path cannot know the final page count when page 1 is emitted, so
  `<TableOfContents>` and `{pages}` templates are unstreamable.
  `renderToStream` runs the engine's `validateDocumentStreamable` *before*
  handing out the generator — otherwise `renderToResponse` (streaming by
  default) would fail mid-response, after the headers were sent.

## 9. Agent automation contract

§7 covers *authoring* cheaply. This section covers everything else an agent
needs to run without a human: knowing whether the environment works, what the
API is, and whether its own output is correct. The user-facing version is
[AGENT_CONTRACT.md](AGENT_CONTRACT.md); this is the implementation view.

### The anti-drift mechanism

The hard problem with a machine-readable API description is that it rots. The
CLI solved it by deriving both its shell completions and its capability manifest
from one `COMMANDS` table; we apply the same idea, with a compile-time lock on
top.

`src/registry.ts` holds four tables and imports nothing at runtime:

| Table | Consumers |
|---|---|
| `BLOCK_REGISTRY` | `spec/schema.ts` (`$defs.block.oneOf`, kind discriminators, arity, descriptions), `spec/validate.ts` (arity + payload rules), `manifest.ts` (`specBlocks`) |
| `COMPONENT_REGISTRY` | `manifest.ts` (`components`) |
| `CLIENT_COMPONENT_REGISTRY` | `manifest.ts` (`clientComponents`) — the preview/download components, which emit no host tag and are therefore kept out of the `HostTag` exhaustiveness lock |
| `LINT_RULES` | `lint.ts` (severities), `spec/schema.ts` (`lint-report` enum), `manifest.ts` (`lintRules`) |

Two independent locks make omission a failure rather than a silent gap:

1. **Compile-time.** The file ends with `Assert<Equals<RegisteredBlockKind,
   BlockSpecKind>>` and the `HostTag` equivalent. Add a member to `BlockSpec`
   or `HostTag` without registering it and `npm run typecheck` fails. The
   `satisfies Record<BlockGroupId, …>` on `BLOCK_SCHEMAS` in `schema.ts` is a
   second, independent compile error for the same mistake.
2. **Test-time.** `tests/registry.test.ts` pins the exact ordered contents and
   cross-checks the generated schema; `tests/agent.test.tsx` asserts every name
   the manifest advertises resolves to a real export of `src/index.ts`.

**If you change this mechanism, verify it is still real:** delete a registry
entry and confirm *both* `npm run typecheck` and `tests/registry.test.ts` fail.
If only one does, the lock has become decorative and needs fixing.

### The four dry-run tiers

Deliberately layered so an agent pays only for the confidence it needs:

| Tier | Call | Cost | Catches |
|---|---|---|---|
| 1 | `validateSpec(unknown)` | trivial | Shape: unknown kind, wrong arity, wrong payload type |
| 2 | `compileSpec` / `compileDocument` | cheap | Structure that cannot map onto the model |
| 3 | `lintSpec` / `lintDocument` | cheap | Accessibility, and engine constraints that would throw |
| 4 | `inspectSpec` / `inspectDocument` | ≈ a render | Pagination and geometry |

`validateSpec` deliberately bundles **no** JSON-Schema validator: the package
only *emits* schemas, so it stays dependency-free and usable in edge runtimes.
Its findings are path-anchored (`blocks[3][1]`) so an agent can repair its own
output rather than guessing. Unknown top-level fields are a *warning*, not an
error, which preserves forward compatibility when a newer spec meets an older
package.

Tier 3 is where the real leverage is: thirteen of the twenty-five lint rules —
the eight `L_CHART_*` errors, `L_PRINT_BOXES`, `L_VIEWER_PRINT_RANGE`,
`L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED` and `L_MAX_BLOCKS_EXCEEDED` —
mirror validation the engine performs by **throwing mid-render**.
`L_ATTACHMENTS_NEED_PDFA3` exists because writing
`samples/layout/watermark-header-footer.tsx` hit exactly that throw;
`L_CHART_EMPTY` and `L_MAX_BLOCKS_EXCEEDED` because later review rounds found
three more engine throws with no rule behind them. `L_PRINT_BOXES` takes the
principle to its limit: instead of re-stating the engine's print-geometry
rules it *calls* the engine's `validatePrintOptions` in a try/catch, so the
finding is the engine's own message. Since engine 1.7.0 there is also a
render-time diagnostics channel (`layout.strict` / `layout.onDiagnostic`) for
the conformance problems only a render can see — see `docs/LINTING.md`.

### Error taxonomy

`PdfReactError` carries a stable `ErrorCode` and a `toJSON()` producing the
ecosystem's envelope. `PdfStructureError` extends it.

The class **moved** from `reconciler/serialize.ts` to `errors.ts` in 1.1.0, but
`serialize.ts` re-exports the same class object, so both import paths yield an
identical `instanceof` — `tests/agent.test.tsx` asserts the object identity, not
just the behaviour.

`toErrorEnvelope(unknown)` normalises *any* thrown value, so a caller only ever
handles one shape.

### `doctor()` must never throw

Every check is wrapped: `doctor()` reports rather than raises, which is what
makes it safe to call before anything else. The engine check is a **capability
probe** (`typeof validatePrintOptions === 'function'`, falling back to
`estimateChartHeight` to tell a 1.6.x engine apart) rather than a
version-string parse: it works after bundling, in the browser, and it tests the
capability we actually need instead of a number that claims it.

It has one reachability limit, worth stating plainly because an earlier draft of
these docs claimed the opposite. `core-bridge` re-exports the engine statically,
so a *completely absent* peer fails at module resolution — `doctor()` is never
called. That failure is already unambiguous (`ERR_MODULE_NOT_FOUND`), and
routing it through `doctor()` would mean giving up the static bridge that golden
rule 1 rests on. What the probes do catch is an engine that resolves but is
older than 1.7.0 — reported as `1.6.x` with an upgrade hint when the 1.6.0
marker is present, and as missing-or-older otherwise; under a bundler or CJS
interop an absent export yields `undefined` rather than a link error.

### Governance duplication is deliberate

`scripts/verify-issue.mjs` must stay zero-dependency and runnable in a checkout
that has never been built — CI and the black-box tests invoke it with plain
`node`. It therefore cannot import `src/governance.ts`. The regex tables are
duplicated, and `tests/governance.test.ts` parses the script's source to assert
both copies are literally identical. Duplication with a proof is honest;
duplication with a comment is not.
