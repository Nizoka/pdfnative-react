# pdfnative-react

[![npm version](https://img.shields.io/npm/v/pdfnative-react)](https://www.npmjs.com/package/pdfnative-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![pdfnative](https://img.shields.io/npm/v/pdfnative?label=pdfnative&color=0066FF)](https://www.npmjs.com/package/pdfnative)

> **Preview release.** `0.1.0` reserves the package name. The declarative React
> renderer lands in `0.2.0` — follow the [repository](https://github.com/Nizoka/pdfnative-react)
> for progress.

Write PDFs the way you write UIs. `pdfnative-react` turns declarative JSX into
real, on-device PDF documents powered by the zero-dependency
[`pdfnative`](https://www.npmjs.com/package/pdfnative) engine — no SaaS
round-trips, your documents never leave the process.

```tsx
// Coming in 0.2.0
import { Document, Page, Heading, Text, Table, usePdf } from 'pdfnative-react';

function Invoice() {
  return (
    <Document title="Invoice #1024">
      <Page>
        <Heading level={1}>Invoice #1024</Heading>
        <Text>Thank you for your business.</Text>
        <Table
          headers={['Item', 'Qty', 'Total']}
          rows={[['Pro plan', '1', '$49.00']]}
        />
      </Page>
    </Document>
  );
}
```

## The pdfnative ecosystem

| Package | Use it for |
|---|---|
| [`pdfnative`](https://www.npmjs.com/package/pdfnative) | The zero-dependency PDF engine — Node, browsers, Workers, Deno, Bun. |
| **`pdfnative-react`** | Declarative React/JSX components with live preview (this package). |
| [`pdfnative-cli`](https://www.npmjs.com/package/pdfnative-cli) | Render, sign, inspect, and verify PDFs from the shell. |
| [`pdfnative-mcp`](https://www.npmjs.com/package/pdfnative-mcp) | Generate PDFs from Claude Desktop, Cursor, Continue, Zed. |

## License

[MIT](LICENSE) © 2026 Nizoka — [Plika](https://plika.app)
