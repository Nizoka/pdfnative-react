# Security Policy

## Supported versions

The current minor line receives fixes of every kind; the previous minor line
receives security fixes only; older lines are not maintained.

| Version | Supported |
|---|---|
| `1.3.x` | :white_check_mark: |
| `1.2.x` | security fixes only |
| `< 1.2` | :x: |

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Report privately via GitHub Security Advisories:

1. Go to the repository's **Security → Advisories** tab.
2. Choose **Report a vulnerability**.

Alternatively, email **hello@pdfnative.dev** with:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version(s) and environment.

We aim to acknowledge reports within a few business days and to coordinate a
fix and disclosure timeline with you.

## Scope

pdfnative-react compiles JSX into a `pdfnative` document model and renders PDF
bytes locally — it performs no network I/O, reads no environment variable,
and writes a file only where `renderToFile` / `renderToFileStream` are told
to. Vulnerabilities in the underlying PDF engine should be reported to the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) project. The package
deliberately re-exports none of the engine's byte-level APIs (decryption,
signing, form filling), so it can never become a surface for them.

## Reproducible builds

Since 1.3.0 (engine 1.8.0) every date the engine writes is UTC, and a
document whose creation instant is pinned — `creationDate` on `<Document>` or
in a `DocSpec`, or `setDefaultCreationDate()` for the process — renders to the
same bytes on every host. The library never reads `SOURCE_DATE_EPOCH` or any
other variable: the pin is explicit, so no environment can silently change
what a consumer builds. Encrypted output is not reproducible by design (fresh
keys, salts and IVs per build). The repository proves the property on its own
sample set on Linux, Windows and macOS (`tests/regression/baselines/samples.sha256.json`,
`sample-regression.yml`), and the `pdfnative` peer pin never moves without a
release note.

## Supply chain

- **One runtime dependency** (`react-reconciler`); `pdfnative` and `react` are peers. A proposal adding a runtime package is refused by `npm run verify:issue` and by the tests.
- `.npmrc` sets `ignore-scripts=true`: nothing executes on install, the gate builds. Every workflow installs with `npm ci --ignore-scripts`.
- Every workflow job starts with `step-security/harden-runner` (skipped on macOS only, where the action is unsupported), checks out with `persist-credentials: false`, pins every action to one commit SHA, and declares its permissions and a timeout. `tests/tools/workflows.test.ts` locks all of it.
- Dependency Review runs on every pull request (fails on high severity, licence allow-list); `npm audit --audit-level=high` runs in CI and weekly; CodeQL and OpenSSF Scorecard run weekly.
- Releases are published through npm **Trusted Publishing** (OIDC, no long-lived token) from the protected `npm-publish` environment, with an exactly pinned npm client, `--provenance`, a CycloneDX SBOM and a build-provenance attestation attached to the GitHub Release. The tarball is exactly `dist/**`, `llms.txt`, `LICENSE`, `README.md` and `package.json` (gate step `pack-check`).
- One release gate (`npx tsx scripts/gate.ts --publish --require-all`) runs before every publish; the branch and tag rulesets under `.github/rulesets/` require five status checks on `main` and make release tags immutable.
- AI agents working in this repository never push, tag, release or publish: those commands are refused by a committed hook (`.claude/hooks/guard.mjs`) and reserved to the maintainer ([docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md)).
