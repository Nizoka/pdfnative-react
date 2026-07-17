# Security Policy

## Supported versions

The latest published `1.x` release receives security fixes. Older versions are
not maintained.

| Version | Supported |
|---|---|
| `1.x` | ✅ |
| `< 1.0` | ❌ |

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
bytes locally — it performs no network I/O. Vulnerabilities in the underlying
PDF engine should be reported to the
[`pdfnative`](https://www.npmjs.com/package/pdfnative) project.
