/**
 * Agent authoring sample — build a full document from a compact DocSpec.
 *
 * Run with: npx tsx samples/agent/compact-spec.ts
 * Writes `compact-spec.pdf` to the current directory.
 *
 * The `DocSpec` below is plain JSON-serializable data: short positional tuples
 * that an LLM can emit with a fraction of the tokens of the equivalent JSX,
 * while compiling to exactly the same PDF. No CSS, no layout engine — just
 * pdfnative's declarative block flow.
 */

import { renderSpecToFile, type DocSpec } from '../../src/index.js';

const spec: DocSpec = {
    title: 'Invoice #2048',
    footerText: 'Acme Inc · hello@acme.example',
    metadata: { author: 'Acme Inc', subject: 'Invoice #2048' },
    blocks: [
        ['h1', 'Invoice #2048'],
        ['p', 'Issued 2026-06-13 · Due 2026-07-13', { color: '#555' }],
        ['sp', 8],
        ['p', 'Billed to: Globex Corporation'],
        ['table', {
            h: ['Item', 'Qty', 'Unit', 'Total'],
            r: [
                ['Pro plan (annual)', '1', '$490.00', '$490.00'],
                ['Extra seats', '5', '$12.00', '$60.00'],
                ['Priority support', '1', '$99.00', '$99.00'],
            ],
            zebra: true,
        }],
        ['sp', 8],
        ['p', 'Total due: $649.00', { align: 'right' }],
        ['qr', 'https://acme.example/pay/2048', { width: 96, height: 96, align: 'right' }],
    ],
};

await renderSpecToFile(spec, 'compact-spec.pdf');
console.log('Wrote compact-spec.pdf');
