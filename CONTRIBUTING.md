# Contributing to pdfnative-react

Thanks for your interest in improving pdfnative-react! This project aims for a
high open-source bar: typed, tested, linted, and reproducible.

## Prerequisites

- Node.js **≥ 22** (use `nvm use` — see `.nvmrc`). The floor is inherited from
  the `pdfnative` engine, which requires it as of 1.6.0.
- npm (bundled with Node).

## Setup

```bash
git clone https://github.com/Nizoka/pdfnative-react.git
cd pdfnative-react
npm install
```

## Everyday commands

| Command | Purpose |
|---|---|
| `npm run build` | Build dual ESM + CJS bundles and type declarations (tsup). |
| `npm run typecheck:all` | Type-check sources and tests. |
| `npm run lint` | ESLint (flat config, typescript-eslint strict). |
| `npm run lint:fix` | Auto-fix lint issues. |
| `npm test` | Run the test suite (vitest). |
| `npm run test:coverage` | Run tests with V8 coverage. |
| `npm run corpus:pdfa` | Render the PDF/A validation corpus into `test-output/pdfa/` (needs a prior build). |
| `npm run validate:pdfa` | Build → render the corpus → validate every PDF/A-claiming file with veraPDF. |

## PDF/A validation (veraPDF)

`npm run validate:pdfa` renders an 11-file corpus through the **built** package
(both authoring doors — JSX and `DocSpec` — across all four conformance
targets 1b/2b/2u/3b) and validates every file with the
[veraPDF](https://verapdf.org) reference validator against the profile it
claims in XMP. Outcomes per file: `PASS`, `FAIL`, `XFAIL` (a **negative
canary** veraPDF must reject — the corpus carries two, and their absence fails
the run), `XPASS` (a negative canary accepted — always fatal: the validator is
not validating), `INFRA` (no usable report — not a verdict), `SKIP`. Exit
codes: `0` ok/skip · `1` conformance or canary failure · `2` no corpus ·
`3` INFRA.

**Without veraPDF installed the script skips with exit 0 — a skip, not a
proof.** CI is **blocking** (`.github/workflows/verapdf.yml` and the
pre-publish gate) and sets `VERAPDF_REQUIRED=1` so a broken install fails
closed. CI pins veraPDF **greenfield 1.30.2** and verifies the installer's
SHA-256 before executing it.

Install locally:

- **macOS**: `brew install --cask verapdf`
- **Linux** (headless):
  ```bash
  curl -fsSL -o installer.zip https://software.verapdf.org/rel/1.30/verapdf-greenfield-1.30.2-installer.zip
  echo "6cc6341cb1af644044054b81f00a6590a7918abb18f762243de115258bcad838  installer.zip" | sha256sum -c
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
  so paths with spaces work. Java 11+ (Temurin 17 recommended) is required.

Environment: `VERAPDF_HOME` (install dir), `VERAPDF_REQUIRED=1` (fail-closed),
`VERAPDF_REPORT_DIR` (raw XML reports, default `test-output/pdfa/reports/`).

## Before opening a pull request

1. `npm run typecheck:all` passes.
2. `npm run lint` is clean.
3. `npm test` is green, with tests for any new behaviour.
4. If PDF/A behaviour, fonts, tagging or the corpus changed:
   `npm run validate:pdfa` passes locally with veraPDF installed — exit 0
   without veraPDF is a skip, not a proof.
5. Update `CHANGELOG.md` under **[Unreleased]**.
6. Keep changes focused; avoid unrelated refactors.

## Architecture

Read [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md) first — especially the
**react-reconciler version contract**, which is the most common source of
breakage.

## Coding conventions

- TypeScript strict; no `any` (lint-enforced).
- 4-space indentation (2 for JSON/YAML); see `.editorconfig`.
- Use `type`-only imports where applicable (lint-enforced).
- All pdfnative imports go through `src/core-bridge/index.ts`.

## Commit & release

- Conventional, descriptive commit messages.
- Releases are cut from GitHub Releases and published to npm via the
  provenance/OIDC workflow (`.github/workflows/publish.yml`). Maintainers only.

By contributing you agree your work is licensed under the project's
[MIT License](LICENSE).
