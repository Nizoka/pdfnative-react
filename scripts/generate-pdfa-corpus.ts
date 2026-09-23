#!/usr/bin/env tsx
/**
 * pdfnative-react — conformance corpus generator (PDF/A + PDF/X, v1.3.0)
 * =======================================================================
 * Renders the table in scripts/lib/pdfa-corpus.ts through the BUILT package
 * (`dist/index.js` — what `npm publish` ships) into `test-output/pdfa/`, and
 * writes `manifest.json` describing each file's expectations for
 * `scripts/validate-pdfa.ts` (veraPDF) and `scripts/validate-pdfx.ts`
 * (pdfnative's validatePdfX()).
 *
 * Usage:  npm run build && npm run corpus:pdfa
 *         npx tsx scripts/generate-pdfa-corpus.ts [--quiet | --verbose] [--json]
 * Exit:   0 when every file was written, 1 at the first entry that fails to
 *         render, 2 when dist/ is missing or on bad usage.
 *
 * Reproducible: hermetic environment (helpers/hermetic.ts), every instant
 * pinned — the manifest records each file's sha256 so a byte change is visible.
 */

// Must be first: pins TZ and scrubs operator knobs before dist/ is loaded.
import './helpers/hermetic.js';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { REPO_ROOT, parseOutputMode } from './helpers/io.js';
import { CORPUS, OUT_DIR, claimOf, type BuiltPackage, type CorpusContext, type DocSpec } from './lib/pdfa-corpus.js';
import type { CorpusFile, CorpusManifest } from './lib/verapdf.js';
import type { PdfDiagnostic } from '../src/index.js';

const DIST = join(REPO_ROOT, 'dist', 'index.js');

async function main(): Promise<number> {
    const mode = parseOutputMode(process.argv.slice(2));
    if ('error' in mode) {
        process.stderr.write(`${mode.error}\n`);
        return 2;
    }
    const { quiet, json } = mode;
    const say = (s: string): void => { if (!json && !quiet) process.stdout.write(`${s}\n`); };
    const note = (s: string): void => { if (!json) process.stderr.write(`${s}\n`); };

    if (!existsSync(DIST)) {
        process.stderr.write('dist/index.js not found — run `npm run build` first.\n');
        return 2;
    }
    // `pathToFileURL`, never string concatenation: a git-bash-style
    // `file:///d/...` path throws ERR_INVALID_FILE_URL_PATH on Windows.
    const lib = (await import(pathToFileURL(DIST).href)) as BuiltPackage;
    const { createElement: h } = await import('react');

    // One resolved font set for every entry that embeds fonts. PDF/A and
    // PDF/X require every rendering font embedded; Noto Sans ships with the
    // engine peer.
    const fontEntries = await lib.resolveFonts({
        latin: () => import('pdfnative/fonts/noto-sans-data.js'),
    });

    const diagnostics: string[] = [];
    const ctx: CorpusContext = {
        lib,
        h,
        fontEntries,
        noteDiagnostic: (d: PdfDiagnostic) => { diagnostics.push(d.code); },
    };

    mkdirSync(OUT_DIR, { recursive: true });
    // Prune PDFs left over from an older corpus layout so the validator's
    // "unlisted file" note only ever points at something unexpected. Only
    // top-level *.pdf files are pruned — manifest.json and reports/ stay.
    const current = new Set(CORPUS.map((e) => e.file));
    for (const stale of readdirSync(OUT_DIR).filter((f) => f.endsWith('.pdf') && !current.has(f))) {
        rmSync(join(OUT_DIR, stale));
        say(`  pruned ${stale}`);
    }

    const files: CorpusFile[] = [];
    let totalBytes = 0;
    const started = Date.now();

    for (const entry of CORPUS) {
        const outPath = join(OUT_DIR, entry.file);
        diagnostics.length = 0;
        try {
            const doc = entry.produce(ctx);
            if (entry.door === 'jsx') await lib.renderToFile(doc as Parameters<typeof lib.renderToFile>[0], outPath);
            else await lib.renderSpecToFile(doc as DocSpec, outPath);
        } catch (err) {
            process.stderr.write(`FAIL  ${entry.file}\n      ${err instanceof Error ? err.message : String(err)}\n`);
            return 1;
        }
        if (!existsSync(outPath)) {
            process.stderr.write(`FAIL  ${entry.file}\n      produced no file.\n`);
            return 1;
        }
        const bytes = readFileSync(outPath);
        if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
            process.stderr.write(`FAIL  ${entry.file}\n      output does not start with %PDF-.\n`);
            return 1;
        }
        if (diagnostics.length > 0) {
            note(`  note ${entry.file}: engine diagnostics ${[...new Set(diagnostics)].join(', ')} (informational — expected on the negative canaries and on form-pdfa2b's conservative /DA warning)`);
        }
        totalBytes += bytes.byteLength;
        const claims = claimOf(entry);
        const compliant = entry.expectCompliant !== false;
        files.push({
            file: entry.file,
            door: entry.door,
            entry: entry.entry,
            bytes: bytes.byteLength,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            expectPdfAClaim: claims === 'pdfa',
            // A file that makes no claim is never validated, so it has no compliance expectation.
            expectCompliant: claims === 'pdfa' && compliant,
            expectPdfXClaim: claims === 'pdfx',
            expectPdfXCompliant: claims === 'pdfx' && compliant,
        });
        const tag = claims === 'none' ? 'no claim' : `${claims === 'pdfa' ? 'PDF/A' : 'PDF/X'}${compliant ? '' : ', NEGATIVE canary'}`;
        say(`  wrote  ${entry.file.padEnd(34)} ${String(bytes.byteLength).padStart(8)} B  (${entry.door}, ${tag})`);
    }

    const manifest: CorpusManifest = { generatedBy: 'scripts/generate-pdfa-corpus.ts', files };
    writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const pdfa = files.filter((f) => f.expectPdfAClaim);
    const pdfx = files.filter((f) => f.expectPdfXClaim);
    const seconds = (Date.now() - started) / 1000;
    if (json) {
        process.stdout.write(`${JSON.stringify({
            generated: files.length, bytes: totalBytes, seconds,
            pdfa: { claiming: pdfa.length, negatives: pdfa.filter((f) => !f.expectCompliant).length },
            pdfx: { claiming: pdfx.length, negatives: pdfx.filter((f) => !f.expectPdfXCompliant).length },
            outputDir: OUT_DIR, files,
        }, null, 2)}\n`);
    } else {
        process.stdout.write(
            `Conformance corpus: ${String(files.length)} file(s), ${String(totalBytes)} bytes, ${seconds.toFixed(1)} s — `
            + `${String(pdfa.length)} PDF/A (${String(pdfa.filter((f) => !f.expectCompliant).length)} negative), `
            + `${String(pdfx.length)} PDF/X (${String(pdfx.filter((f) => !f.expectPdfXCompliant).length)} negative) → test-output/pdfa/\n`,
        );
    }
    return 0;
}

process.exit(await main());
