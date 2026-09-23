# Knowledge Base — pdfnative-react

This document explains how pdfnative-react is built and why. It is the reference
for contributors and for AI agents working in this repository.

> pdfnative-react **v1.3.0** on pdfnative 1.8.0. _Verified on 2026-09-22 against the source tree._

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
| `scripts/` | The gate (`gate.ts`), the sample generator (`generate-samples.ts`, one child process per sample with the creation instant pinned), the baseline verifier (`verify-samples.ts`), the conformance corpus and its two validators (`generate-pdfa-corpus.ts`, `validate-pdfx.ts`, `validate-pdfa.ts`), the documentation verifier (`verify-docs.ts` over `lib/react-surface.ts`), `release-prepare.ts`, `build-claude-rules.ts`; `helpers/hermetic.ts` + `helpers/tz.ts` pin `TZ=UTC` and scrub operator variables first. See `scripts/README.md`. |
| `tests/regression/` | The frozen 1.2.0 captures (`baselines/*.v1.2.0.json`), the sample byte baseline, the v1.2.0 samples compatibility snapshot (`compat/`), the engine-surface matrix. |
| `tests/tools/` | Tests of the repository tooling (gate, workflows, verify-docs, release-prepare, guard hook, agent config). |
| `docs/assets/ecosystem.json` | Every count and version the docs quote; `verify:docs` derives what it can from the tree and holds the rest. |

Two import-graph invariants worth preserving:

- **`src/registry.ts` imports nothing at runtime.** That is what lets
  `spec/schema.ts` describe a lint report without importing `lint.ts` — and
  therefore without dragging the engine into the schema path. Emitting a schema
  stays a pure, dependency-free operation. (It is also why `LINT_RULES` lives in
  the registry and is merely *re-exported* from `lint.ts`.)
- **`core-bridge` imports `setDefaultCreationDate`, `validatePrintOptions` and
  `estimateChartHeight` as capability probes** for `doctor()` — a 1.8.0, a
  1.7.0 and a 1.6.0 marker, probed newest-first for graded messaging (a 1.7.x
  engine is reported as needing >= 1.8.0). Probing beats parsing a version
  string out of `package.json` — it survives bundling into a browser build,
  which the CLI learned the hard way when tsup flattened its `require` away.
  `validatePrintOptions` doubles as the implementation of the `L_PRINT_BOXES`
  lint rule (the engine's own validator, called in a try/catch, so the finding
  carries the engine's message and can never drift). Together with `PG_W`/`PG_H`
  (the engine's default page size, imported for the same rule) and
  `PDF_X_CONFORMANCE_TARGETS` (the `L_PDFX_TARGET` rule), none of these are
  re-exported from the public barrel. The six environment helpers that ARE
  re-exported (`setDeflateRawImpl`, `wrapZlib`, `setDefaultCreationDate`,
  `getDefaultCreationDate`, `setHyphenationProvider`, `getHyphenationProvider`)
  are the engine's own functions, unchanged — a test asserts identity.

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
- **Layout sugar** (`watermark`, `header`, `footer`, `attachments`, `tagged`,
  `print`, and since 1.3.0 `pdfx`, `outputIntent`, `typography`, `creationDate`) is
  likewise `<Document>` props: page furniture, not blocks in the flow. Making
  them components would mean host tags with no corresponding pdfnative block,
  which golden rule 2 forbids. `resolveLayout()` folds them into `layout` under
  the engine's keys, with an explicit `layout` prop always winning — mirroring
  how `RenderOptions.layout` overrides `DocumentParams.layout` in `prepare()`.
  **Critical invariant:** when no sugar prop is set and no `layout` is given,
  `resolveLayout` returns `undefined`, never `{}`. An empty object would change
  the serialized bytes of every existing document; `tests/layout-sugar.test.tsx`
  pins this. `creationDate` accepts a `Date` or an ISO 8601 string (the
  `DocSpec` form): `toCreationDate()` converts, and an unparseable string is an
  `E_INPUT` `PdfReactError` — never a silent fallback to the clock. `typography`
  is folded whole (no deep merge), like `print`.
- **`ParagraphAlign`** (`Align | 'justify'`) is a separate type because `Align`
  is shared by images, barcodes, SVG and charts, which the engine does not
  justify; `keepWithNext` / `splittable` reach the heading and paragraph blocks
  only when set (`compact()`), so an unchanged document keeps its bytes.
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
- `tests/typography.test.tsx`, `tests/color.test.tsx`, `tests/pdfx.test.tsx`,
  `tests/reproducible.test.tsx`, `tests/fonts-27.test.tsx`, `tests/doctor.test.ts` —
  the 1.3.0 surface: the twelve typography keys through both doors, CMYK on
  every colour position, a real PDF/X-4 file accepted by the engine's
  `validatePdfX` plus every negative, the creation-date pin and its
  precedence, the five new font modules, the doctor probe order.
- `tests/api-surface.test.ts`, `tests/schema-superset.test.ts`,
  `tests/manifest-superset.test.ts` — the zero-breaking-change proofs against
  the frozen 1.2.0 captures under `tests/regression/baselines/`; the fourth
  proof is `npm run typecheck:compat`, which compiles the frozen v1.2.0 samples
  (`tests/regression/compat/`) against the current `src/`.
- `tests/regression/samples.test.ts`, `tests/regression/reproducible-build.test.ts`,
  `tests/regression/engine-surface.test.ts` — the byte baseline, the two-time-zone
  proof over `dist/index.js`, and the engine-surface matrix (every 1.8.0
  changelog bullet mapped to a test or a waiver).
- `tests/tools/*` — the gate table, the nine workflows, the guard hook, the
  agent configuration, `verify-docs` (run on the real tree and on a corrupted
  sandbox), `release-prepare`, the hermetic environment.
- jsdom lacks `URL.createObjectURL`; `tests/setup.ts` stubs it. vitest runs
  under `TZ=UTC` with `pool: 'forks'`; node-only suites carry
  `// @vitest-environment node`.

Beyond vitest sits the **conformance tier**: `scripts/generate-pdfa-corpus.ts`
renders a 16-file corpus through the *built* package (both authoring doors,
all four PDF/A targets, PDF/X-4, typography and CMYK under a claim) into
`test-output/pdfa/`; `scripts/validate-pdfx.ts` checks the PDF/X files with
the engine's `validatePdfX()` in-process (never skipped, a `ci` gate step), and
`scripts/validate-pdfa.ts` validates every PDF/A-claiming file with the pinned
veraPDF reference validator (outcomes PASS/FAIL/XFAIL/XPASS/INFRA/SKIP). Two
design points matter: the corpus carries **three negative canaries** the
validators must reject (an XPASS fails the run, so a validator that accepts
everything can never turn the gate green), and without veraPDF the runner
**skips with exit 0** — a skip, not a pass; the gate's `--require-all` flag,
which CI and the publish workflow pass, turns that skip into a failure.
veraPDF is an external tool, never a dependency.

## 6a. Reproducibility

Unencrypted engine output is a pure function of its inputs plus one date.
Since engine 1.8.0 every date is written in UTC, the trailer `/ID` derives
from the creation instant and the `{date}` placeholder follows it, so a
document whose instant is pinned — `creationDate` (prop, DocSpec key or
`layout.creationDate`), or `setDefaultCreationDate()` for the process —
renders to the same bytes on every host. The library reads no environment
variable: the repository scripts honour `SOURCE_DATE_EPOCH` for the sample
generator (`scripts/helpers/pin-creation-date.mjs`), the package never will.

What the repository proves: `tests/reproducible.test.tsx` (the pin reaches the
bytes; precedence prop > default > clock), `tests/regression/reproducible-build.test.ts`
(the built package in two child processes under `Pacific/Kiritimati` and
`America/Los_Angeles` — same bytes), and the byte baseline
`tests/regression/baselines/samples.sha256.json`, generated by
`npm run test:generate` (each sample in its own process, instant pinned to
`2026-01-01T00:00:00Z`) and held by `npm run verify:samples` on Linux, Windows
and macOS. The baseline is a chain: each entry carries `since`, the release
whose output it is, carried forward while the sample is unchanged; a
rebaseline is a declared decision in the release note. `IDENTICAL_SAMPLE_GROUPS`
lists the one pair rendered twice on purpose; `ENCRYPTED_SAMPLES` is empty —
no sample of this repository encrypts, and the semantic fingerprint mode
exists only to fail loudly if one ever does.

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
- **No environment variables.** The library never reads `process.env`
  (`tests/tools/hermetic-env.test.ts` holds it): a pinned date, a compressor
  or a hyphenation provider is set through an exported helper by the host.
- **Typography is a layout option, not a component.** A `<Typography>` wrapper <!-- verify-docs:allow registry-parity -->
  would be a host tag with no block behind it (golden rule 2); the twelve keys
  are page furniture, so they live on `<Document typography>` like `print`.
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

`src/registry.ts` holds five tables and imports nothing at runtime:

| Table | Consumers |
|---|---|
| `BLOCK_REGISTRY` | `spec/schema.ts` (`$defs.block.oneOf`, kind discriminators, arity, descriptions), `spec/validate.ts` (arity + payload rules), `manifest.ts` (`specBlocks`) |
| `DOC_SPEC_FIELDS` | `spec/validate.ts` (`KNOWN_FIELDS`), `manifest.ts` (`specFields`), `tests/registry.test.ts` (holds the schema `properties` to it) — locked to `keyof DocSpec` |
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

Tier 3 is where the real leverage is: twenty of the 37 lint rules — the eight
`L_CHART_*` errors, `L_PRINT_BOXES`, `L_VIEWER_PRINT_RANGE`,
`L_ATTACHMENTS_NEED_PDFA3`, `L_TAGGED_ENCRYPTED`, `L_MAX_BLOCKS_EXCEEDED`,
`L_OUTPUT_INTENT_PROFILE` and the six PDF/X coherence rules — mirror
validation the engine performs by **throwing at build time**.
`L_ATTACHMENTS_NEED_PDFA3` exists because writing
`samples/layout/watermark-header-footer.tsx` hit exactly that throw;
`L_CHART_EMPTY` and `L_MAX_BLOCKS_EXCEEDED` because later review rounds found
three more engine throws with no rule behind them. `L_PRINT_BOXES` takes the
principle to its limit: instead of re-stating the engine's print-geometry
rules it *calls* the engine's `validatePrintOptions` in a try/catch, so the
finding is the engine's own message; the six PDF/X rules of 1.3.0 restate the
engine's throws in the same order and with the same wording (a parity test
holds each message to the throw it pre-empts), and `ENGINE_INPUT_ERROR_PREFIXES`
in `errors.ts` classifies the same throws as `E_INPUT` for callers who skip the
linter. Since engine 1.7.0 there is also a render-time diagnostics channel
(`layout.strict` / `layout.onDiagnostic`) for the conformance problems only a
render can see — 9 diagnostic codes as of 1.8.0; see `docs/LINTING.md`.

### Error taxonomy

`PdfReactError` carries a stable `ErrorCode` — one of 6 error codes — and a
`toJSON()` producing the ecosystem's envelope. `PdfStructureError` extends it.

The class **moved** from `reconciler/serialize.ts` to `errors.ts` in 1.1.0, but
`serialize.ts` re-exports the same class object, so both import paths yield an
identical `instanceof` — `tests/agent.test.tsx` asserts the object identity, not
just the behaviour.

`toErrorEnvelope(unknown)` normalises *any* thrown value, so a caller only ever
handles one shape.

### `doctor()` must never throw

Every check is wrapped: `doctor()` reports rather than raises, which is what
makes it safe to call before anything else. The engine check is a **capability
probe** (`typeof setDefaultCreationDate === 'function'`, falling back to
`validatePrintOptions` and then `estimateChartHeight` to tell a 1.7.x or a
1.6.x engine apart) rather than a
version-string parse: it works after bundling, in the browser, and it tests the
capability we actually need instead of a number that claims it.

It has one reachability limit, worth stating plainly because an earlier draft of
these docs claimed the opposite. `core-bridge` re-exports the engine statically,
so a *completely absent* peer fails at module resolution — `doctor()` is never
called. That failure is already unambiguous (`ERR_MODULE_NOT_FOUND`), and
routing it through `doctor()` would mean giving up the static bridge that golden
rule 1 rests on. What the probes do catch is an engine that resolves but is
older than 1.8.0 — reported as `1.7.x` or `1.6.x` with an upgrade hint when
the corresponding marker is present, and as missing-or-older otherwise; under a bundler or CJS
interop an absent export yields `undefined` rather than a link error.

### Governance duplication is deliberate

`scripts/verify-issue.mjs` must stay zero-dependency and runnable in a checkout
that has never been built — CI and the black-box tests invoke it with plain
`node`. It therefore cannot import `src/governance.ts`. The regex tables are
duplicated, and `tests/governance.test.ts` parses the script's source to assert
both copies are literally identical. Duplication with a proof is honest;
duplication with a comment is not.
