---
description: "Use when touching file IO, HTTP responses, the engine bridge, image or ICC inputs, the dependency set or the workflows."
applyTo: "src/core-bridge/**,src/response.ts,src/render.ts,src/assets.ts,src/fonts.ts,src/governance.ts,src/lint.ts,.github/workflows/**,.github/actions/**,package.json"
---
# Security Standards

## Boundaries of the library
- The library never reads `process.env`, never opens a network connection and never writes a file except through `renderToFile` / `renderToFileStream` at the path the caller gives (`tests/tools/hermetic-env.test.ts` holds the first; `fromUrl` fetches only what the caller asked for, with the caller's `fetch`).
- Every engine call goes through `src/core-bridge/index.ts`; a new engine feature is bridged there, typed in `src/types.ts`, and never re-implemented. Byte-level post-processing (merge, sign, encrypt, extract, validate) stays out of the barrel (golden rule 7) so the authoring package can never become a decryption or signing surface.
- `renderToResponse` sets `Content-Type`, `Content-Disposition` (the file name is sanitised) and `Content-Length`; never echo caller input into a header unescaped.

## Inputs that reach the engine
- Images are bytes the caller supplies (`Uint8Array`); the engine checks the magic bytes. ICC profiles for `outputIntent` go through the engine's `acsp` / size checks; the lint rule `L_OUTPUT_INTENT_PROFILE` reads the header first so a malformed profile is a finding, not a mid-render throw.
- `validateSpec` bounds its recursion and never throws; `schema()` rejects an unknown subject with `E_INPUT` (`Object.hasOwn`, never a truthiness check); `doctor()` never throws; `toErrorEnvelope` is total even for a thrown value with no primitive conversion. Fuzzed in `tests/fuzz-validate.test.ts` and property-tested in `tests/property-validate.test.ts` (fast-check).
- `validateIssueDraft` (`src/governance.ts`) runs regexes over untrusted Markdown: keep every pattern linear (CodeQL `js/polynomial-redos` is enforced; `tests/governance.test.ts` pins the backtracking case).

## Dependencies and CI
- Exactly one runtime dependency (`react-reconciler`); `pdfnative` and `react` are peers. Adding a runtime package is a governance blocker (`npm run verify:issue`, `tests/tools/workflows.test.ts`, `verify:docs` rule `manifest-shape`).
- npm publish via OIDC Trusted Publishing only: `publish.yml` runs guard → build → publish → attest; the gate, the consumer smoke test and `npm pack` run in `build` without an id-token, `publish` (the protected `npm-publish` environment, blocked egress) fetches the npm client by SHA-512 integrity and uploads the packed tarball with `--provenance`, and `attest` fetches the published tarball back, compares digests, writes the SBOMs and the build-provenance attestation and attaches them to the release (SLSA Build L2).
- Every workflow job: `step-security/harden-runner` first on every runner, macOS included (`egress-policy: block` with an `allowed-endpoints` list, or `audit # <date>: <reason>` — Windows and macOS are audit-only per the vendor matrix), `persist-credentials: false`, `npm ci --ignore-scripts`, explicit `permissions` (writes at job level only), a timeout; one commit SHA per action across the tree; the `workflow lint` job runs zizmor and actionlint (SHA-256-verified) on every pull request. Seven required checks: `ci (22)`, `ci (24)`, `os (windows-latest)`, `os (macos-latest)`, `compat-previous`, `workflow lint`, `sample-regression`. `tests/tools/workflows.test.ts` asserts all of it — update the test in the same change as a workflow.
- `.npmrc` sets `ignore-scripts=true`: nothing builds on install, the gate builds. The tarball is exactly `dist/**`, `llms.txt`, `LICENSE`, `README.md` and `package.json` (gate step `pack-check`).
- Keep the lockfile committed; `npm audit --audit-level=high` runs in CI and weekly; Dependency Review runs on every pull request; CodeQL (`actions` and `javascript-typescript`, `security-extended`) runs on every push and pull request and weekly; Scorecard runs weekly; Dependabot waits seven days before proposing a version and never narrows a peer range (`versioning-strategy: increase-if-necessary`).
- veraPDF is downloaded at a pinned version and checked against a committed SHA-256 before it is executed (`.github/actions/setup-verapdf`).
