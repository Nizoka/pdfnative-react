# Compatibility snapshots — the shipped samples against the current source

Each `v<N>/samples/` folder is `git archive v<N> samples` (the `.ts` / `.tsx`
files only), verbatim, with one mechanical edit: every `../src/index.js` /
`../../src/index.js` (and `../../src/client.js`, `../../scripts/lib/…`) import
is rewritten to reach the **current** `src/` (or `scripts/`) from this deeper
directory. `npm run typecheck:compat` compiles all of them (`tsconfig.json`
here), so a consumer written against the 1.2.0 or the 1.3.0 API keeps
type-checking against the current surface — the strongest practical proof that
no prop, export or type was removed or narrowed. Every snapshot is frozen: it
is never regenerated, and never edited beyond that import rewrite. A new minor
adds a folder and a line in the `include` of `tsconfig.json`; it removes
nothing.

| Folder | Captured from | Samples |
|---|---|---|
| `v1.2.0/` | tag `v1.2.0` | 39 |
| `v1.3.0/` | tag `v1.3.0` | 44 |

The runtime half of the same proof is `tests/api-surface.test.ts`
(`tests/regression/baselines/api-surface.v1.2.0.json` and
`api-surface.v1.3.0.json`); the JSON-Schema half is
`tests/schema-superset.test.ts` (`doc-spec.schema.v*.json`); the manifest and
lint halves are `tests/manifest-superset.test.ts` (`manifest.v*.json`). Each
test runs once per capture, and also checks that the captures form a chain
(every later capture is a superset of the earlier one).

The behavioural half is `npm run compat:previous` (`scripts/run-compat.ts`):
the previous tag's own test suite, as tagged, replayed against the current
sources, with `allow-v<N>.json` listing the files it may skip and why.
