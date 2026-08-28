/**
 * Visual verification for vision-capable AI agents (dry-run tier 5).
 *
 * Run with: npx tsx samples/agent/visual-verify.tsx
 * Writes `samples/output/visual-verify.pdf` and, when a rasterizer is
 * available, `samples/output/visual-verify-<page>.png`.
 *
 * Tiers 1–4 (validateSpec → compileSpec → lintSpec → inspectSpec) check the
 * document MODEL. This sample closes the loop on APPEARANCE: it renders a
 * document, rasterizes it to PNG with a standard external tool, and prints
 * the image path — a vision-capable agent then LOOKS at the PNG and judges
 * whether the rendered page matches its intent (layout, colors, chart shape,
 * nothing clipped or overlapping).
 *
 * The rasterizer is deliberately external — pdfnative-react adds no runtime
 * dependency for this (golden rule 1). Detected, in order:
 *   pdftoppm  (poppler-utils: `apt install poppler-utils` / `brew install poppler`
 *              / Windows: poppler via Chocolatey or MSYS2)
 *   mutool    (mupdf-tools: `apt install mupdf-tools` / `brew install mupdf`)
 * Without either, the sample degrades cleanly: it prints the geometry report
 * from `inspectDocument` (tier 4) instead and exits 0.
 */

import React from 'react';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    Chart,
    Document,
    Heading,
    Paragraph,
    Table,
    inspectDocument,
    renderToFile,
} from '../../src/index.js';

const OUT_DIR = join('samples', 'output');
mkdirSync(OUT_DIR, { recursive: true });
const pdfPath = join(OUT_DIR, 'visual-verify.pdf');

// A document with enough visual structure to judge: heading, table, chart.
const doc = (
    <Document title="Visual verification">
        <Heading level={1}>Q3 dashboard</Heading>
        <Paragraph>
            A vision agent should see: this heading, a two-row table, and a bar
            chart with four ascending bars.
        </Paragraph>
        <Table
            headers={['Region', 'Revenue']}
            rows={[
                { cells: ['North', '12k'], type: 'default', pointed: false },
                { cells: ['South', '31k'], type: 'default', pointed: false },
            ]}
        />
        <Chart
            chartType="bar"
            series={[{ label: 'Revenue', values: [8, 15, 22, 31] }]}
            categories={['Q1', 'Q2', 'Q3', 'Q4']}
            title="Ascending quarters"
            altText="Four bars rising from 8 to 31."
        />
    </Document>
);

await renderToFile(doc, pdfPath);
console.log(`Wrote ${pdfPath}`);

/** First rasterizer found on PATH, or null. */
function findRasterizer(): { name: string; args: (pdf: string, prefix: string) => string[] } | null {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const has = (bin: string): boolean =>
        spawnSync(which, [bin], { encoding: 'utf8' }).status === 0;
    if (has('pdftoppm')) {
        return { name: 'pdftoppm', args: (pdf, prefix) => ['-png', '-r', '144', pdf, prefix] };
    }
    if (has('mutool')) {
        return { name: 'mutool', args: (pdf, prefix) => ['draw', '-o', `${prefix}-%d.png`, '-r', '144', pdf] };
    }
    return null;
}

const rasterizer = findRasterizer();
if (rasterizer === null) {
    console.log(
        '\nNo rasterizer found (pdftoppm or mutool). Falling back to the tier-4 '
            + 'geometry report — install poppler-utils or mupdf-tools for the visual tier.\n',
    );
    const inspection = inspectDocument(doc);
    console.log(`Pages: ${inspection.pages.length}`);
    for (const page of inspection.pages) {
        for (const block of page.blocks) {
            console.log(
                `  page ${page.index + 1}: ${block.type} at y=${block.top.toFixed(0)} `
                    + `(${block.width.toFixed(0)}×${block.height.toFixed(0)} pt)`,
            );
        }
    }
    process.exit(0);
}

const prefix = join(OUT_DIR, 'visual-verify');
const result = spawnSync(rasterizer.name, rasterizer.args(pdfPath, prefix), { encoding: 'utf8' });
if (result.status !== 0) {
    console.error(`${rasterizer.name} failed: ${result.stderr || result.error?.message || 'unknown'}`);
    process.exit(1);
}
const pngs = readdirSync(OUT_DIR).filter((f) => f.startsWith('visual-verify') && f.endsWith('.png'));
if (pngs.length === 0 || !existsSync(join(OUT_DIR, pngs[0]))) {
    console.error(`${rasterizer.name} exited 0 but produced no PNG.`);
    process.exit(1);
}
console.log(`Rasterized with ${rasterizer.name}:`);
for (const png of pngs) console.log(`  ${join(OUT_DIR, png)}`);
console.log('\nA vision agent should now read the PNG(s) and compare against its intent.');
