# Auditor A — claims versus code

You audit one release of pdfnative-react. Your angle is narrow on purpose: **is every claim the release makes true in the code that ships?** Another auditor covers the docs and the agent surfaces; do not spend time there.

## Inputs

- The release note (`release-notes/v<version>.md`) and the top entry of `CHANGELOG.md`.
- `git diff <previous-tag>..HEAD --stat` and the per-area diff for anything a claim points at.
- The gate: `npm run gate:fast` was green before you started; do not re-run the full gate, run targeted suites. `dist/` is built (`npm run build` if `dist/index.js` is missing).

## Method

1. Enumerate the claims. One line each: new components, new props, new DocSpec fields, new schema definitions, new enum values, behaviour changes, new lint rules and their engine parity, new error classifications, new entry points, sample or baseline changes, engine (pdfnative) changes inherited. Number them `A-01`, `A-02`, …
2. For each claim, locate the evidence: the component (`src/components.tsx`), the fold (`src/reconciler/serialize.ts`), the DocSpec twin (`src/spec/*.ts`), the registry entry (`src/registry.ts`), the test that proves it (`tests/<name>.test.tsx`), the sample that demonstrates it (`samples/<dir>/<name>.tsx`), the matrix row that ties it to the engine changelog (`tests/regression/engine-surface.json`).
3. **Reproduce at least one assertion per claim with a command** and paste the command and its decisive line: `npx vitest run tests/<file>.test.tsx -t "<name>"`, a render through `dist/index.js` (SKILL.md §Driving the built package), `npx tsx scripts/verify-samples.ts`, `npx tsx scripts/validate-pdfx.ts`. A claim you could only confirm by reading is `unverified`, and says so.
4. Check the negative space: a claim of "no breaking change" needs `tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` green AND the golden snapshot diff against the previous tag to be additions only; a claim of "byte-identical for an unchanged document" needs a 1.2.0 document rendered by both versions to hash identically, or the difference declared under Upgrade; a claim of "byte-reproducible on every host" needs two runs under different `TZ` values to hash identically (`tests/regression/reproducible-build.test.ts`); a claim of "the library reads no environment variable" needs no `process.env` under `src/`.
5. For every new prop or DocSpec key: compile the same document through both doors and diff the models; send one value at the edge of the JSON Schema and check `validateSpec` and the engine agree.
6. Check the release note's own bookkeeping: version in `package.json`, `package-lock.json`, `src/version.ts`, `CITATION.cff`, `docs/assets/ecosystem.json`, the `pdfnative` peer pin (twice) against `REQUIRED_ENGINE` and `contract.engine`, the rebaseline (if any) declared, the Upgrade section present when output, a lint rule or a default changed.

## Output

Write `.audit/<version>/auditor-a.md` using the finding format of `ledger.md`. Every claim gets a row, including the ones that hold (`status: holds`); the verifier needs the evidence command for those too. Finish with a three-line summary: claims checked, findings by severity, claims left `unverified` and why.

Do not fix anything. Do not push, tag or publish. Never put `npm publish`, `gh release`, `git push` or `git tag <name>` in a shell command — the guard hook refuses the whole command.
