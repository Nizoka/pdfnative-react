# Compatibility snapshot — the v1.2.0 samples against the current source

`v1.2.0/samples/` is `git archive v1.2.0 samples`, verbatim, with one mechanical
edit: every `../src/index.js` / `../../src/index.js` import is rewritten to reach
the **current** `src/` from this deeper directory. `npm run typecheck:compat`
compiles them (`tsconfig.json` here), so a consumer written against the 1.2.0
API keeps type-checking against the 1.3.0 surface — the strongest practical
proof that no prop, export or type was removed or narrowed. The snapshot is
frozen: it is never regenerated, and never edited beyond that import rewrite.

The runtime half of the same proof is `tests/api-surface.test.ts`
(`tests/regression/baselines/api-surface.v1.2.0.json`); the JSON-Schema half is
`tests/schema-superset.test.ts`; the manifest and lint halves are
`tests/manifest-superset.test.ts`.
