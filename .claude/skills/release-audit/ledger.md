# Ledger and verdict formats

Everything lives under `.audit/<version>/` (git-ignored). Plain Markdown, one table per file, so `git diff`-style review and grep both work.

## Finding format (auditors)

One row per claim or surface, including the ones that hold:

| id | severity | claim / surface | evidence command | observed | expected | status |
|---|---|---|---|---|---|---|
| A-03 | major | "`pdfx="pdfx4"` writes a /GTS_PDFX output intent" | `npx vitest run tests/pdfx.test.tsx -t "output intent"` | 1 passed | 1 passed | holds |
| B-07 | blocker | docs/LINTING.md lists `L_PDFX_NO_FONTS` under Errors | `npx tsx scripts/verify-docs.ts --json` | missing row | documented | finding |

- `id` — `A-`, `B-`, `D-` (autonomy pass) or `V-` (raised by a verifier), zero-padded to two digits.
- `severity` — `blocker` (a shipped claim is false, a public surface is wrong, a gate would fail), `major` (a user or an agent is misled, no gate catches it), `minor` (wording, ordering, a stale example that still behaves), `note` (observation, no action).
- `evidence command` — the exact command; the verifier re-runs it verbatim. A row without one is `unverified`.
- `status` — `holds`, `finding`, `unverified`.

## Verifier format

The auditor table plus two columns:

| … | stamp | justification |
|---|---|---|
| … | CONFIRMED | re-ran the command; the rule is in LINT_RULES (src/registry.ts) and has no row in docs/LINTING.md |
| … | DOWNGRADED → minor | real, but `lint-rule-parity` fails the gate on it — cannot ship silently |
| … | REJECTED | the prop is documented in the README table and in the schema description |
| … | DUPLICATE of B-02 | same missing sentence, different document |

## Ledger (`ledger.md`)

Only `CONFIRMED` and `DOWNGRADED` findings, sorted by severity then id, with two more columns:

| id | severity | claim / surface | evidence command | fix | waiver |
|---|---|---|---|---|---|

- `fix` — the commit hash that resolved it, or `open`.
- `waiver` — empty, or the maintainer's one-line reason for shipping with it (only `major` and below may be waived).

Above the table: the tally per severity and per stamp, the previous tag, the HEAD hash audited, and the date.

## Verdict (`verdict.md`)

```
Verdict: GO | NO-GO
Release: v<version>   HEAD: <hash>   Previous: <tag>   Date: <YYYY-MM-DD>
Blockers open: <n>   Majors open: <n>   Waived: <n>
Findings: <confirmed> confirmed, <downgraded> downgraded, <rejected> rejected, <duplicate> duplicate
Next: <the one command the maintainer runs next — the fix loop, or scripts/release-prepare.ts>
```

Then the open blockers, one per line, each with its evidence command.
