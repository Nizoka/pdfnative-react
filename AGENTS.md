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
| `src/response.ts` | `renderToResponse` — web-standard `Response`. Server-only; never `'use client'`. |
| `src/lint.ts` | `lintDocument` — accessibility and engine-constraint rules. |
| `src/registry.ts` | **Single source of truth** for the block grammar, components and lint rules. See below. |
| `src/errors.ts` | `ErrorCode` taxonomy, `PdfReactError`, `PdfStructureError`. |
| `src/manifest.ts` | `capabilityManifest()` — derived entirely from the registries. |
| `src/doctor.ts` | `doctor()` — environment pre-flight. Must never throw. |
| `src/governance.ts` | The HITL policy, protocol text and draft validator, as runtime capability. |
| `src/fonts.ts` | `resolveFonts` (loader map → `FontEntry[]`). |
| `src/assets.ts` | `fromUrl` / `fromBase64` image-byte helpers. |
| `src/hooks.ts` | `usePdf`, `usePdfStream` (client). |
| `src/viewer.tsx` | `PDFViewer`, `PDFDownloadLink`, `BlobProvider` (client). |
| `src/core-bridge/index.ts` | The only file that imports `pdfnative` at runtime. |
| `src/spec/` | Compact `DocSpec` grammar, compiler, JSON Schema, `validateSpec`. |
| `src/version.ts` | Single source of truth for the package version. |
| `src/types.ts` | Public types + pdfnative type-only re-exports. |
| `src/index.ts` | Public barrel. |
| `samples/` | Runnable, type-checked examples (gated by `typecheck:samples`). |
| `tests/` | vitest (jsdom). |

## Golden rules

1. **All runtime pdfnative imports go through `src/core-bridge/index.ts`.** The
   one sanctioned exception: `src/types.ts` may import *type-only* from
   `pdfnative`. Never import the engine's runtime elsewhere **in `src/`** —
   a test may import the engine directly when it verifies the *finished
   bytes* (e.g. `validatePdfUA` in `tests/pdfua.test.tsx`; see Knowledge
   Base §6), since bridging a post-processing API would violate rule 7.
   (`pdfnative` is a **peer dependency** — never move it back to
   `dependencies`.)
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
   styling, charts) must reach both the JSX props and the `DocSpec` grammar +
   schema — **and be registered in `src/registry.ts`**, which the schema, the
   validator and the capability manifest all derive from. Bump `src/version.ts`
   (not an inline literal) when the version changes — the JSON Schema `$id`
   derives from it, and a test pins it to `package.json` and `CITATION.cff`.
7. **Authoring only.** Byte-level post-processing (merge/split, form
   fill/flatten, text extraction, decryption, annotations, signatures, crypto,
   font compilation) is the engine's job — do not re-export it. Point at
   [docs/RECIPES.md](docs/RECIPES.md), which shows how to call `pdfnative`
   directly on the bytes this library produces.
8. **AI governance — you are a draftsman, never a submitter.** Never open, edit,
   or submit issues/PRs/releases autonomously. Write a local draft in
   `.github/drafts/`, validate it with `npm run verify:issue`, present it plus a
   compliance report, and let a human submit under their own identity. See
   [.github/AGENT_RULES.md](.github/AGENT_RULES.md) and
   [docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md).

## The registry is the single source of truth

`src/registry.ts` holds four tables — the `DocSpec` block grammar, the component
list, the client components, and the lint rules. Four things *derive* from them
rather than restating them:

1. `src/spec/schema.ts` — `$defs.block.oneOf`, plus each tuple's kind
   discriminator, arity and description.
2. `src/spec/validate.ts` — arity and payload-type rules.
3. `src/manifest.ts` — the capability manifest.
4. `tests/registry.test.ts` — pins the exact, ordered contents.

Omission is a **build error**, not a silent gap: the file ends with
`Assert<Equals<…>>` types, so adding a member to `BlockSpec` or `HostTag`
without registering it fails `npm run typecheck`.

If you ever change this mechanism, verify it is still real: delete an entry and
confirm that **both** `npm run typecheck` and `tests/registry.test.ts` fail. If
only one does, the lock is decorative.

### Adding a block kind

1. `src/reconciler/nodes.ts` — add the host tag.
2. `src/components.tsx` — add the component and its props.
3. `src/reconciler/serialize.ts` — add the `case` in `toBlock`.
4. `src/spec/types.ts` — add the tuple type and add it to the `BlockSpec` union.
5. **`src/registry.ts`** — add the `BLOCK_REGISTRY` and `COMPONENT_REGISTRY` entries.
6. `src/spec/compile.ts` — add the `case` (the `never` guard will demand it).
7. `src/spec/schema.ts` — add the builder to `BLOCK_SCHEMAS`.
8. `src/spec/index.ts` and `src/index.ts` — export the new types.
9. `tests/` — a serialization test **and** a `compileSpec` ↔ JSX parity test.
10. `samples/`, `samples/README.md`, `llms.txt`, `README.md`, `CHANGELOG.md`.

## Token-frugal agent authoring (`src/spec/`)

For LLM agents, the compact `DocSpec` is the cheapest way to author a document:
terse JSON tuples that compile to the **same** PDF as the equivalent JSX. Prefer
it when generating documents programmatically; validate with `validateSpec()` or
against `schema('doc-spec')`. See Knowledge Base §7 and §9, and
[docs/AGENT_CONTRACT.md](docs/AGENT_CONTRACT.md).

### Recommended agent loop

```
doctor()             will this environment work at all?  (never throws)
capabilityManifest() what can I do here?
schema(subject)      what grammar do I emit?
validateSpec(json)   is it well-formed?                  dry run, tier 1
compileSpec(spec)    does it map onto the model?         dry run, tier 2
lintSpec(spec)       accessible, and legal for the engine? dry run, tier 3
renderSpecTo*(spec)  only now, produce bytes.
```

Branch on error `code`, never on the message. Codes are stable across releases;
messages are not.

## Validate every change

```bash
npm run typecheck:all
npm run lint
npm test
npm run build
npm run validate:pdfa   # PDF/A conformance (veraPDF) — skips cleanly when
                        # veraPDF is not installed; CI runs it blocking with
                        # VERAPDF_REQUIRED=1. See CONTRIBUTING.md.
```

Add or update tests under `tests/` for any behavioural change, and update
`CHANGELOG.md` under **[Unreleased]**.

### Documentation drift gate

The same fact is stated in README, `llms.txt`, the Knowledge Base, the agent
contract, the CHANGELOG, the release notes and the capability manifest. When you
change a **count** or a **claim**, sweep for the old one before you commit:

```bash
grep -rniE "six (rules|of these|pre-empt)|sixteen|five (rules|constraints)|three tables|peer is missing" \
  --include=*.md --include=*.txt --include=*.ts --include=*.tsx . \
  | grep -v node_modules | grep -v '^\./dist'
```

Widen the alternation to whatever phrasing you are retiring — and widen it
*generously*. A previous release shipped a wrong count in `CHANGELOG.md` for a
full round because the sweep searched `six pre-empt` while the text read
`Six rules pre-empt`. The gate is only as good as its regex.

## Conventions

- 4-space indent (2 for JSON/YAML).
- `type`-only imports where applicable.
- Keep the public barrel (`src/index.ts`) curated and intentional.
