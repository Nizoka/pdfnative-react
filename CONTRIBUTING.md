# Contributing to pdfnative-react

Thanks for your interest in improving pdfnative-react! This project aims for a
high open-source bar: typed, tested, linted, and reproducible.

## Prerequisites

- Node.js **≥ 20** (use `nvm use` — see `.nvmrc`).
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

## Before opening a pull request

1. `npm run typecheck:all` passes.
2. `npm run lint` is clean.
3. `npm test` is green, with tests for any new behaviour.
4. Update `CHANGELOG.md` under **[Unreleased]**.
5. Keep changes focused; avoid unrelated refactors.

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
