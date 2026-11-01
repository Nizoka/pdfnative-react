# Security Policy

## Supported versions

The current minor line receives fixes of every kind; the previous minor line
receives security fixes only; older lines are not maintained.

| Version | Supported |
|---|---|
| `1.4.x` | :white_check_mark: |
| `1.3.x` | security fixes only |
| `< 1.3` | :x: |

### Supported runtimes

| | 1.x | What a minor may change |
|---|---|---|
| Node.js | Every line in Active or Maintenance LTS: Node.js 22 and 24, both run by the `ci` workflow on Linux, Windows and macOS as required checks. Node.js 26 (Active LTS since 2026-10-28) is run by the advisory `node-current` workflow — tested, not promised — and joins `ci.yml` as a required check in 1.5.0 | Drop a line after its end of life, announced one minor ahead |
| React | React 19 (`peerDependencies.react`), server and client: the root bundle is server-safe, `pdfnative-react/client` carries the hooks and the viewer | Nothing: raising the peer floor is major |
| pdfnative (engine) | The minor this release aligns on, as a caret range (`peerDependencies.pdfnative`, 1.4.0: `^1.9.0`); `doctor()` names the floor and grades an older engine down | The floor follows the engine minor: an engine-alignment minor of this package raises it by one engine minor, declared in the release note's Compatibility table and in `capabilityManifest().contract.engine` — the one accepted contract delta (`tests/manifest-superset.test.ts`) |
| TypeScript (consumers) | TypeScript 5.0 and later, under `moduleResolution` `node16`/`nodenext` and `bundler` | Raise the floor, never to a release younger than two years |
| Deno, Bun, edge runtimes | Documented as HTTP-handler targets in [docs/SERVER.md](docs/SERVER.md) (`renderToResponse` is a Web `Response`); they are not a tested runtime of this package — the engine smoke-tests them, the full suite runs on Node.js only, and no version floor is promised | — |

`engines.node` is `>=22`, inherited from the engine. npm warns, and refuses only
under `engine-strict`, when a runtime is outside the range.

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Report privately through GitHub's private vulnerability reporting:
<https://github.com/Nizoka/pdfnative-react/security/advisories/new>
(the repository's **Security → Advisories → Report a vulnerability** form).

Alternatively, email [hello@pdfnative.dev](mailto:hello@pdfnative.dev) with:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version(s) and environment.

Disclosure timeline:

1. We acknowledge every report within **5 business days**.
2. We target a fix, or a documented mitigation, within **90 days** of the
   report; a fix ships as a patch release of every supported line, with a
   GitHub Security Advisory and a CVE where one applies.
3. Disclosure is **coordinated**: we agree the publication date with the
   reporter, and ask for the time above before any public disclosure and for
   no exploitation beyond what demonstrates the issue. We credit the reporter
   in the advisory unless they prefer otherwise.

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

## Compatibility promise

Four things are proven mechanically for the whole 1.x line, on every pull
request, so that "no breaking change" is a check and not a sentence:

| Leg | What is promised | Held by |
|---|---|---|
| Exports and types | Every runtime export of `pdfnative-react` and `pdfnative-react/client`, and every exported type name, keeps its name; a consumer written against a previous minor keeps type-checking against the current `src/` | `tests/api-surface.test.ts` against the frozen captures `tests/regression/baselines/api-surface.v1.2.0.json` and `api-surface.v1.3.0.json`; `npm run typecheck:compat` compiles the previous releases' samples, as tagged, under `tests/regression/compat/` |
| DocSpec schema and capability manifest | The JSON Schema only widens (every property, enum member and block branch kept, nothing newly required); every component, block, entry point, error code and lint rule of `capabilityManifest()` is still listed, with the same severity | `tests/schema-superset.test.ts` and `tests/manifest-superset.test.ts` against `doc-spec.schema.v1.*.json` and `manifest.v1.*.json` |
| Behaviour | The previous release's own test suite, exactly as tagged, passes against the current sources; the files or tests it may skip are listed in `tests/regression/compat/allow-v1.3.0.json`, each with a reason and, for a behaviour change inherited from the engine, the release-note ledger entry that justifies it | `npm run compat:previous` (`scripts/run-compat.ts`), the required `compat-previous` check and the publish gate |
| Bytes | An unchanged document renders the same bytes across minors | `tests/regression/baselines/samples.sha256.json`, re-anchored only with a ledger entry in the release note, checked by `sample-regression` (Linux) and by the `os` job of `ci.yml` (Windows and macOS, through the gate's `verify:samples` step) |

A removal, a rename, a narrowing or a changed default is a major release. The
frozen captures (`*.v1.2.0.json`, `*.v1.3.0.json`, `tests/regression/compat/v1.*/`)
are never regenerated. Two things move with the engine, by design and declared
each time: the `pdfnative` peer floor (one engine minor per engine-alignment
minor, see the runtimes table) and the engine types this package re-exports
(`Color`, `ChartSeries`, …), which may *widen* — code that narrows them may
need a new branch, code that passes values in never does; the release note's
Upgrade section lists each widening.

## Supply chain

- **One runtime dependency** (`react-reconciler`); `pdfnative` and `react` are peers. A proposal adding a runtime package is refused by `npm run verify:issue` and by the tests.
- `.npmrc` sets `ignore-scripts=true`: nothing executes on install, the gate builds. Every workflow installs with `npm ci --ignore-scripts`.
- Every workflow job starts with `step-security/harden-runner` (Linux, Windows and macOS alike), checks out with `persist-credentials: false`, pins every action to one commit SHA, and declares its permissions and a timeout. The workflows themselves are linted on every pull request by the `workflow lint` job (zizmor 1.30.1 and actionlint 1.7.12, each verified by SHA-256 before it runs). `tests/tools/workflows.test.ts` locks all of it.
- Dependency Review runs on every pull request (fails on high severity, licence allow-list); `npm audit --audit-level=high` runs in CI and weekly; CodeQL analyses `actions` and `javascript-typescript` on every push and pull request and weekly; OpenSSF Scorecard runs weekly.
- The untrusted-input surface (`validateSpec`, `lintSpec`, `toErrorEnvelope`, `doctor`) is fuzzed with a seeded corpus (`tests/fuzz-validate.test.ts`) and property-tested with fast-check (`tests/property-validate.test.ts`): none of them throws, whatever the input.
- Releases are published by `publish.yml` in four jobs — `guard` → `build` → `publish` → `attest` — with `egress-policy: block` on `guard`, `publish` and `attest`. The `build` job (no `id-token`) runs the publish gate, packs the tarball once, records its digests and runs the consumer smoke test against that packed tarball with lockfile-pinned peers; `publish` runs behind the protected `npm-publish` environment through npm **Trusted Publishing** (OIDC, no long-lived token) with an npm client pinned by the SHA-512 integrity of its registry tarball and `--provenance`; `attest` fetches the published tarball back, compares its digest with the one `build` recorded, verifies `npm audit signatures`, writes the SBOMs (CycloneDX and SPDX for the runtime tree, CycloneDX for the toolchain) and attaches them with the build-provenance attestation to the GitHub Release (SLSA Build L2). The tarball is exactly `dist/**`, `llms.txt`, `LICENSE`, `README.md` and `package.json` (gate step `pack-check`).
- One release gate (`npx tsx scripts/gate.ts --publish --require-all`) runs before every publish; the branch and tag rulesets under `.github/rulesets/` require seven status checks on `main` — `ci (22)`, `ci (24)`, `os (windows-latest)`, `os (macos-latest)`, `compat-previous`, `workflow lint` and `sample-regression` — and make release tags immutable.
- AI agents working in this repository never push, tag, release or publish: those commands are refused by a committed hook (`.claude/hooks/guard.mjs`) and reserved to the maintainer ([docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md)).

## Code safety

- No `eval()`, `Function()` or dynamic code execution; `sideEffects: false`, no module-level side effect; `'use client'` only on the `/client` subpath.
- `validateSpec` bounds its recursion and never throws; `schema()` rejects an unknown subject with `E_INPUT`; `doctor()` never throws; `toErrorEnvelope` wraps anything thrown into one of the six documented error codes. `renderToResponse` sanitises the file name before it reaches `Content-Disposition`.
- `validateIssueDraft` runs only linear regular expressions over untrusted Markdown (CodeQL `js/polynomial-redos` is enforced).

### Accepted Scorecard findings

These findings are deliberate and stay:

- **Token-Permissions** — the `attest` job of `publish.yml` holds `contents: write` at the job level: it is the pipeline's only write grant, needed to attach the SBOM and the tarball to the published GitHub Release.
- **Code-Review** — scores 0 on a single-maintainer repository. Compensating controls: the `/code-review` pass on every branch diff, the release audit (`/release-audit`), the seven required checks, CodeQL and the previous release's suite replayed on every pull request.
- **Pinned-Dependencies** — the consumer smoke test installs the exact versions the lockfile resolved to, without a hash: npm has no hash pinning for a registry install. The npm client itself is pinned by SHA-512 integrity.
- **Vulnerabilities** — the `minimatch@3.x` moderate advisories reachable under eslint 9 have no fixed 3.x release; they are a dev-tree-only exposure (nothing of it ships in the tarball) and move with the eslint 10 migration tracked in ROADMAP.md.
