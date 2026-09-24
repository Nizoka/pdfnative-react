---
paths:
  - "src/core-bridge/**"
  - "src/response.ts"
  - "src/render.ts"
  - "src/assets.ts"
  - "src/fonts.ts"
  - "src/governance.ts"
  - "src/lint.ts"
  - ".github/workflows/**"
  - ".github/actions/**"
  - "package.json"
---
<!-- GENERATED from .github/instructions/security.instructions.md by scripts/build-claude-rules.ts — do not edit -->

# Security Standards

## Boundaries of the library
- The library never reads `process.env`, never opens a network connection and never writes a file except through `renderToFile` / `renderToFileStream` at the path the caller gives (`tests/tools/hermetic-env.test.ts` holds the first; `fromUrl` fetches only what the caller asked for, with the caller's `fetch`).
- Every engine call goes through `src/core-bridge/index.ts`; a new engine feature is bridged there, typed in `src/types.ts`, and never re-implemented. Byte-level post-processing (merge, sign, encrypt, extract, validate) stays out of the barrel (golden rule 7) so the authoring package can never become a decryption or signing surface.
- `renderToResponse` sets `Content-Type`, `Content-Disposition` (the file name is sanitised) and `Content-Length`; never echo caller input into a header unescaped.

## Inputs that reach the engine
- Images are bytes the caller supplies (`Uint8Array`); the engine checks the magic bytes. ICC profiles for `outputIntent` go through the engine's `acsp` / size checks; the lint rule `L_OUTPUT_INTENT_PROFILE` reads the header first so a malformed profile is a finding, not a mid-render throw.
- `validateSpec` bounds its recursion and never throws; `schema()` rejects an unknown subject with `E_INPUT` (`Object.hasOwn`, never a truthiness check); `doctor()` never throws. Fuzzed in `tests/fuzz-validate.test.ts`.
- `validateIssueDraft` (`src/governance.ts`) runs regexes over untrusted Markdown: keep every pattern linear (CodeQL `js/polynomial-redos` is enforced; `tests/governance.test.ts` pins the backtracking case).

## Dependencies and CI
- Exactly one runtime dependency (`react-reconciler`); `pdfnative` and `react` are peers. Adding a runtime package is a governance blocker (`npm run verify:issue`, `tests/tools/workflows.test.ts`, `verify:docs` rule `manifest-shape`).
- npm publish via OIDC Trusted Publishing only, from the protected `npm-publish` environment, with an exactly pinned npm client, `--provenance`, a CycloneDX SBOM and a build-provenance attestation.
- Every workflow job: `step-security/harden-runner` first (skipped on macOS only — the action supports Linux, and Windows in audit mode), `persist-credentials: false`, `npm ci --ignore-scripts`, explicit `permissions`, a timeout; one commit SHA per action across the tree. `tests/tools/workflows.test.ts` asserts all of it — update the test in the same change as a workflow.
- `.npmrc` sets `ignore-scripts=true`: nothing builds on install, the gate builds. The tarball is exactly `dist/**`, `llms.txt`, `LICENSE`, `README.md` and `package.json` (gate step `pack-check`).
- Keep the lockfile committed; `npm audit --audit-level=high` runs in CI and weekly; Dependency Review runs on every pull request; CodeQL and Scorecard run weekly.
- veraPDF is downloaded at a pinned version and checked against a committed SHA-256 before it is executed (`.github/actions/setup-verapdf`).
