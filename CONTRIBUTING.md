# Contributing to pdfnative-react

Thanks for your interest in improving pdfnative-react! This project aims for a
high open-source bar: typed, tested, linted, reproducible — and verified by one
gate that means the same thing on your machine and in CI.

## First pull request in ten minutes

```bash
git clone https://github.com/Nizoka/pdfnative-react.git
cd pdfnative-react
nvm use                     # Node 22 (.nvmrc); Node >= 22 is the floor, inherited from the engine
npm ci                      # .npmrc disables install-time scripts — nothing builds on install
npm run gate:fast           # typecheck:all, lint, test, verify:docs
```

Make your change, add or adjust a test under `tests/`, update `CHANGELOG.md`
under **[Unreleased]**, run `npm run gate` (the CI profile), open the pull
request with the template filled in. `npm run hooks:install` wires the opt-in
git hooks (pre-commit: lint + CRLF guard; pre-push: the fast gate).

## The gate

`npm run gate` (`scripts/gate.ts`) is the single definition of green. It runs
the steps of its `STEPS` table in order, prints one line per step, and writes
each step's full output to `test-output/.gate/<step>.log`.

| Profile | Command | Steps |
|---|---|---|
| Fast | `npm run gate:fast` | `typecheck:all`, `lint`, `test`, `verify:docs` |
| CI (default) | `npm run gate` | `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx` |
| Publish | `npx tsx scripts/gate.ts --publish --require-all` | everything, plus `validate:pdfa` (veraPDF); a step that would skip fails |

`--only <step>` runs one step, `--from <step>` resumes a profile, `--json`
prints machine output. PowerShell swallows a bare `--` after `npm run`, so
pass flags by calling the script directly. The inline steps hold the BUILT
package: `dist-check` (the eight artefacts of the `exports` map),
`dist-probe` (`'use client'` on `dist/client.*` only, no `console.log`, the
`node:` prefix kept, nothing else under `dist/`), `bundle-smoke` (both entries
bundled for a browser with esbuild) and `pack-check` (the tarball file list,
publint and `@arethetypeswrong/cli` — every entry point resolves for every
module resolution mode).

The individual commands still exist:

| Command | Purpose |
|---|---|
| `npm run build` | Dual ESM + CJS bundles and type declarations (tsup + `scripts/postbuild.mjs`). |
| `npm run typecheck:all` | `src`, `tests`, `samples`, `scripts` and the frozen v1.2.0 samples (`typecheck:compat`) against the current source. |
| `npm run lint` | ESLint (flat config, typescript-eslint strict, `--max-warnings 0`). |
| `npm test` / `npm run test:coverage` | vitest 4 (`TZ=UTC`, `pool: 'forks'`, jsdom by default); coverage thresholds live in `vitest.config.ts` and are never lowered. |
| `npm run test:generate` / `npm run verify:samples` | Render every sample into `test-output/samples/` and hold it to the byte baseline. |
| `npm run corpus:pdfa` / `npm run validate:pdfx` / `npm run validate:pdfa` | The conformance corpus and its two validators. |
| `npm run verify:docs` | Every count, version, component, rule, code, link and stamp in the docs against `docs/assets/ecosystem.json` and the source tree. |

## Samples and the byte baseline

Every sample under `samples/` is listed in `scripts/lib/sample-plan.ts` and
indexed in `samples/README.md` (`verify:docs` rule `sample-index-parity`).
`npm run test:generate` runs each in its own process with the creation instant
pinned to `2026-01-01T00:00:00Z` under `TZ=UTC`, into `test-output/samples/`;
`npm run verify:samples` compares the SHA-256 of every PDF with
`tests/regression/baselines/samples.sha256.json`.

The baseline is a chain: every entry names the release whose output it is
(`since`), carried forward while the sample is unchanged. An intended output
change — a new sample, a deliberate byte change — is rebaselined with
`npx tsx scripts/verify-samples.ts --update`, explained in the manifest's
`provenance` note and declared in the release note's Upgrade section. Never
`--update` to silence a surprise: a moved hash on an unchanged sample is a
regression until proven otherwise.

Samples write their PDF to the current directory, format numbers and dates
with an explicit locale, and never read the environment (the generator pins
the instant, not the sample). `sample-regression.yml` holds the baseline on
Linux, Windows and macOS as a required check.

## PDF/A and PDF/X validation

`npm run corpus:pdfa` renders a 16-file conformance corpus
(`scripts/lib/pdfa-corpus.ts`) through the **built** package — both authoring
doors, JSX and `DocSpec`, every PDF/A target (1b/2b/2u/3b), PDF/X-4, with
three negative canaries — into `test-output/pdfa/`.

- `npm run validate:pdfx` runs the engine's structural `validatePdfX()` over
  the PDF/X files, in-process. It never skips and it is a `ci` gate step.
- `npm run validate:pdfa` validates every PDF/A-claiming file with the
  [veraPDF](https://verapdf.org) reference validator against the profile it
  claims. Outcomes per file: `PASS`, `FAIL`, `XFAIL` (a negative canary
  veraPDF must reject), `XPASS` (a canary accepted — always fatal), `INFRA`
  (no usable report). Without veraPDF the script skips with exit 0 — a skip,
  not a proof; the gate reports `SKIP`, and `--require-all` (what CI and the
  publish workflow pass) turns it into a failure. CI pins veraPDF
  **greenfield 1.30.2** through `.github/actions/setup-verapdf` and verifies
  the installer's SHA-256 before executing it.

Install locally:

- **macOS**: `brew install --cask verapdf`
- **Linux** (headless):
  ```bash
  curl -fsSL -o installer.zip https://software.verapdf.org/rel/1.30/verapdf-greenfield-1.30.2-installer.zip
  sha256sum -c .github/checksums/verapdf-greenfield-1.30.2-installer.zip.sha256   # after renaming to the checksum's file name
  unzip -q installer.zip
  cat > auto-install.xml <<'XML'
  <?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <AutomatedInstallation langpack="eng">
    <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
    <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>/opt/verapdf</installpath></com.izforge.izpack.panels.target.TargetPanel>
    <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select"><pack index="0" name="veraPDF GUI" selected="true"/><pack index="1" name="veraPDF Mac and *nix Scripts" selected="true"/><pack index="2" name="veraPDF Documentation" selected="false"/><pack index="3" name="veraPDF Sample Plugins" selected="false"/></com.izforge.izpack.panels.packs.PacksPanel>
    <com.izforge.izpack.panels.install.InstallPanel id="install"/>
    <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
  </AutomatedInstallation>
  XML
  java -jar verapdf-izpack-installer-*.jar auto-install.xml
  ```
- **Windows** (PowerShell): install via the GUI installer from
  https://docs.verapdf.org/install/ (ships `verapdf.bat`), then
  `$env:VERAPDF_HOME = "C:\Program Files\veraPDF"` (or add it to PATH). The
  `.bat` launcher is invoked through a shell with quoted arguments (Node
  refuses to spawn batch files directly since the CVE-2024-27980 hardening),
  so paths with spaces work. Java 11+ (Temurin 17 recommended) is required;
  set `JAVACMD` to the JDK's `java.exe` when it is not on PATH.

Environment: `VERAPDF_HOME` (install dir), `JAVACMD` (the Java executable),
`VERAPDF_REPORT_DIR` (raw XML reports, default `test-output/pdfa/reports/`).
Every new claiming corpus entry bumps `declared.pdfaSamples` /
`declared.pdfxSamples` in `docs/assets/ecosystem.json`.

## Documentation and the ecosystem manifest

`docs/assets/ecosystem.json` is the single source of every count and version
the docs quote (components, block kinds, DocSpec fields, lint rules, error
codes, tests, samples, corpus files, the engine pin). `npm run verify:docs`
(27 rules, `scripts/verify-docs.ts`) holds README, `llms.txt`, the guides,
AGENTS.md, CLAUDE.md, the instruction files, the release note and the
workflows to it and to the source tree: every component and lint rule of
`src/registry.ts` is documented, every documented one exists, every link and
anchor resolves, every "Verified on" stamp matches. A line that legitimately
quotes a superseded figure opts out with `verify-docs:allow <rule>` on itself
or the line above.

Prose is English everywhere; demonstrated content in another language carries
`demo-language: <tag> (reason)` on or above the line.

## Agent files

`AGENTS.md` (≤ 120 lines) is the editor-agnostic guide; `CLAUDE.md` imports it
and adds a Claude Code addendum; `.github/copilot-instructions.md` and
`.github/instructions/*.instructions.md` carry the per-area detail.
`.claude/rules/*.md` are generated from the instruction files by
`npm run agents:rules` — edit the source, then regenerate. See
[docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md) §8 for the hook, the
permissions and the release-audit skill.

## Coding conventions

- TypeScript strict; no `any` (lint-enforced); `type`-only imports where applicable; relative imports carry `.js`.
- 4-space indentation (2 for JSON/YAML); see `.editorconfig`. LF line endings everywhere (`.gitattributes`).
- All runtime `pdfnative` imports go through `src/core-bridge/index.ts` (the scripts and the byte-checking tests are the documented exception).
- Read [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md) first — especially the react-reconciler version contract.
- Conventional Commits (`feat(scope):`, `fix(scope):`, `docs:`, `chore:`); no `Co-Authored-By` trailer.

## Pull Request Checklist

- [ ] `npm run gate` passes — the CI profile in one command (`npm run gate:fast` for a quick loop while iterating; PowerShell swallows a bare `--`, so call `npx tsx scripts/gate.ts --fast` there)
- [ ] All tests pass (`npm run test`)
- [ ] Type check passes (`npm run typecheck:all` — src, tests, samples, scripts and the v1.2.0 compatibility snapshot)
- [ ] Lint passes (`npm run lint`)
- [ ] New code has tests (coverage thresholds in `vitest.config.ts` must not regress)
- [ ] No `any` types introduced
- [ ] No new runtime dependency (`react-reconciler` stays the only one; `pdfnative` and `react` stay peers)
- [ ] A new authoring capability reaches every wiring point: `src/components.tsx`, `src/reconciler/serialize.ts`, `src/spec/{types,compile,schema}.ts`, `src/registry.ts`, `tests/` (serialization, DocSpec parity, the golden snapshot read before `-u`), `samples/` and `scripts/lib/sample-plan.ts`, `samples/README.md`, `llms.txt`, `README.md`, `docs/AGENT_CONTRACT.md`
- [ ] If samples, PDF/A or PDF/X behaviour changed: `npm run build && npm run test:generate && npm run verify:samples && npm run corpus:pdfa && npm run validate:pdfx && npm run validate:pdfa` passes locally (veraPDF installed — see [PDF/A and PDF/X validation](#pdfa-and-pdfx-validation); new claiming corpus entries bump `declared.pdfaSamples` / `declared.pdfxSamples`; an intended output change is rebaselined with `npx tsx scripts/verify-samples.ts --update` and declared in the release note)
- [ ] If docs, README, llms.txt, AGENTS.md, CLAUDE.md or `.claude/` changed: `npm run verify:docs` passes
- [ ] No breaking change (`tests/api-surface.test.ts`, `tests/schema-superset.test.ts`, `tests/manifest-superset.test.ts` and `npm run typecheck:compat` are green), or documented and versioned accordingly
- [ ] `CHANGELOG.md` updated (Unreleased section) if user-facing changes
- [ ] For releases: follow [Release](#release) — `release-notes/vX.Y.Z.md` and `release-notes/draft/PR-vX.Y.Z.md` written, and `npx tsx scripts/gate.ts --publish --require-all` passes locally, which runs every individual gate: `typecheck:all`, `lint`, `build`, `dist-check`, `dist-probe`, `bundle-smoke`, `pack-check`, `test:generate`, `test:coverage`, `verify:docs`, `verify:samples`, `corpus:pdfa`, `validate:pdfx`, `validate:pdfa`
- [ ] No `Co-Authored-By` trailer and no "generated with" footer anywhere on the branch

## Release

1. `npx tsx scripts/release-prepare.ts --version X.Y.Z` — the mechanical bump: `package.json` + lockfile, `src/version.ts` (the schema `$id` derives from it), `docs/assets/ecosystem.json` + the "Verified on" stamps, `CITATION.cff`, the `SECURITY.md` table, the README engine badge, the knowledge-base header, `llms.txt`, and two scaffolds from `release-notes/TEMPLATE.md` and `release-notes/PR_TEMPLATE.md`.
2. Write `release-notes/vX.Y.Z.md`, mirror its bullets into `CHANGELOG.md` (with the compare link), update `ROADMAP.md`.
3. `npx tsx scripts/gate.ts --publish --require-all` with veraPDF installed — every step, no skip.
4. If output changed on purpose, rebaseline (`--update`) and declare it in the note's Upgrade section.
5. Run the `release-audit` Claude Code skill; fix what it confirms.
6. Fill `release-notes/draft/PR-vX.Y.Z.md`. Everything after this line is the maintainer's: push, open the pull request with that body, wait for the five required checks, merge, tag `vX.Y.Z`, publish the GitHub Release with the note as its body. `publish.yml` then re-runs the publish gate and publishes through npm Trusted Publishing, attaching the SBOM and the provenance attestation.

Rollback: never unpublish — cut a superseding patch; tags are immutable (`.github/rulesets/tags.json`).

## Bumping the engine pin

The `pdfnative` peer pin moves only with a release note. In the same change:
`peerDependencies` and `devDependencies` in `package.json`, `REQUIRED_ENGINE`
in `src/doctor.ts` (with a new capability probe), `contract.engine` in
`src/manifest.ts`, `packages.pdfnative` in `docs/assets/ecosystem.json`
(`verify:docs` rule `peer-pin-parity` holds the four together), and
`tests/regression/engine-surface.json` — every bullet of the engine's release
entry mapped to a test or a sample here, or waived with a reason
(`tests/regression/engine-surface.test.ts` fails until the matrix follows).
Then regenerate the samples and read the baseline diff: inherited byte changes
go in the Upgrade section.

## Branch protection

`.github/rulesets/main.json` requires five status checks on `main`: `ci (22)`,
`ci (24)`, `os (windows-latest)`, `os (macos-latest)` and `sample-regression`.
`verapdf` and `docs` are blocking workflows but not required checks (they are
path-filtered). `.github/rulesets/tags.json` makes `v*` tags immutable. Import
both through **Settings → Rules → Rulesets → Import** after they change;
`verify:docs` rule `ruleset-parity` keeps the contexts pointing at real jobs.
The `npm-publish` environment and the npm Trusted Publisher are bound by the
maintainer.

## Reporting bugs and security issues

See [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md). AI agents draft
issues under `.github/drafts/` and never submit them ([.github/AGENT_RULES.md](.github/AGENT_RULES.md)).

## License

By contributing you agree your work is licensed under the project's
[MIT License](LICENSE).
