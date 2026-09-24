#!/usr/bin/env tsx
/**
 * pdfnative-react — reproducible sample generator (v1.3.0)
 * =========================================================
 * Runs every sample of scripts/lib/sample-plan.ts exactly as the README
 * documents it (`npx tsx samples/<name>.tsx`) and collects the PDFs under
 * `test-output/samples/`, where `scripts/verify-samples.ts` fingerprints them
 * against the committed baseline
 * (tests/regression/baselines/samples.sha256.json).
 *
 * Each sample runs in its own process — `node --import tsx --import
 * scripts/helpers/pin-creation-date.mjs <sample>` — with the working
 * directory set under test-output/samples/<dir>/, so a sample that writes
 * `x.pdf` next to itself lands where the baseline expects it and the sample
 * sources carry no harness of their own. The samples import `../src/index.js`,
 * their documented form; the BUILT package is held by the corpus generator,
 * the gate's dist probes and the two-time-zone test.
 *
 * Reproducibility is pinned twice, on purpose: the preload sets the engine's
 * process-wide creation instant from `SOURCE_DATE_EPOCH` (scripts/helpers/
 * io.ts), and a sample that demonstrates the pin passes `creationDate` itself.
 * The environment is hermetic (helpers/hermetic.ts): UTC, no operator knob
 * inherited from the shell, no network — the one sample that fetches is run
 * but excluded from the baseline (`exclude: 'network'`).
 *
 * The output directory is emptied first, so a stale sample can never be
 * fingerprinted as if this run had produced it.
 *
 * Usage:  npm run test:generate
 *         npx tsx scripts/generate-samples.ts [--quiet | --verbose] [--json]
 * Exit:   0 every sample ran and wrote what the plan says · 1 a sample failed,
 *         wrote something the plan does not list, or forgot an output ·
 *         2 bad usage.
 */

// Must be first: pins TZ and scrubs operator knobs before anything else loads.
import './helpers/hermetic.js';

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { OUTPUT_DIR, REPO_ROOT, SOURCE_DATE_EPOCH, formatBytes, parseOutputMode } from './helpers/io.js';
import { SAMPLE_PLAN, expectedOutputs, sampleDir, type SampleEntry } from './lib/sample-plan.js';

// `--import` takes a specifier, not a path: a bare `D:\…` is read as a URL
// scheme on Windows (ERR_UNSUPPORTED_ESM_URL_SCHEME), so hand Node a file URL.
const PRELOAD_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'helpers', 'pin-creation-date.mjs')).href;
const LOG_DIR = join(REPO_ROOT, 'test-output', '.samples');
/** One sample must never take longer than this — a hang, not a slow render. */
const SAMPLE_TIMEOUT_MS = 180_000;

interface Run {
    readonly entry: SampleEntry;
    readonly status: number | null;
    readonly seconds: number;
    readonly log: string;
    readonly stdout: string;
    readonly stderr: string;
}

function runSample(entry: SampleEntry): Promise<Run> {
    const cwd = join(OUTPUT_DIR, sampleDir(entry.source));
    mkdirSync(cwd, { recursive: true });
    const source = join(REPO_ROOT, entry.source);
    const log = join(LOG_DIR, `${entry.source.replace(/[^a-z0-9]/gi, '-')}.log`);
    const started = Date.now();
    return new Promise((resolveRun) => {
        const child = spawn(
            process.execPath,
            ['--import', 'tsx', '--import', PRELOAD_URL, source],
            {
                cwd,
                env: {
                    ...process.env,
                    SOURCE_DATE_EPOCH,
                    TZ: 'UTC',
                    NO_COLOR: '1',
                    FORCE_COLOR: '0',
                    // tsx resolves its tsconfig from the working directory; point it at the repo's.
                    TSX_TSCONFIG_PATH: join(REPO_ROOT, 'samples', 'tsconfig.json'),
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            },
        );
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
        const timer = setTimeout(() => child.kill(), SAMPLE_TIMEOUT_MS);
        child.on('close', (status) => {
            clearTimeout(timer);
            resolveRun({ entry, status, seconds: (Date.now() - started) / 1000, log, stdout, stderr });
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            resolveRun({ entry, status: null, seconds: (Date.now() - started) / 1000, log, stdout, stderr: `${stderr}\n${err.message}` });
        });
    });
}

/** Run the plan with a small worker pool; the outputs are files, so order does not matter. */
async function runAll(entries: readonly SampleEntry[], width: number, onDone: (run: Run) => void): Promise<Run[]> {
    const queue = [...entries];
    const runs: Run[] = [];
    const worker = async (): Promise<void> => {
        for (;;) {
            const next = queue.shift();
            if (next === undefined) return;
            const run = await runSample(next);
            runs.push(run);
            onDone(run);
        }
    };
    await Promise.all(Array.from({ length: Math.min(width, entries.length) }, worker));
    return runs;
}

function* walkPdfs(dir: string): Generator<string> {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) yield* walkPdfs(p);
        else if (entry.endsWith('.pdf')) yield p;
    }
}

async function main(): Promise<number> {
    const mode = parseOutputMode(process.argv.slice(2));
    if ('error' in mode) {
        process.stderr.write(`${mode.error}\n`);
        return 2;
    }
    const { quiet, json } = mode;
    const say = (s: string): void => { if (!json && !quiet) process.stdout.write(`${s}\n`); };

    for (const entry of SAMPLE_PLAN) {
        if (!existsSync(join(REPO_ROOT, entry.source))) {
            process.stderr.write(`sample-plan: ${entry.source} does not exist\n`);
            return 1;
        }
    }

    rmSync(OUTPUT_DIR, { recursive: true, force: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });
    rmSync(LOG_DIR, { recursive: true, force: true });
    mkdirSync(LOG_DIR, { recursive: true });

    const started = Date.now();
    const width = Math.max(1, Math.min(4, availableParallelism() - 1));
    const runs = await runAll(SAMPLE_PLAN, width, (run) => {
        writeFileSync(run.log, `# ${run.entry.source}\n# exit ${String(run.status)}\n\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}\n`);
        say(`  ${run.status === 0 ? 'ran   ' : 'FAIL  '} ${run.entry.source}  ${run.seconds.toFixed(1)}s`);
    });

    let failures = 0;
    for (const run of runs.sort((a, b) => a.entry.source.localeCompare(b.entry.source))) {
        if (run.status !== 0) {
            failures++;
            process.stderr.write(`FAIL  ${run.entry.source} (exit ${String(run.status)})\n`);
            for (const line of run.stderr.trim().split(/\r?\n/).slice(-12)) process.stderr.write(`      ${line}\n`);
            process.stderr.write(`      (full log: ${relative(REPO_ROOT, run.log).replace(/\\/g, '/')})\n`);
            continue;
        }
        for (const rel of expectedOutputs(run.entry)) {
            const file = join(OUTPUT_DIR, rel);
            if (!existsSync(file)) {
                failures++;
                process.stderr.write(`FAIL  ${run.entry.source} did not write ${rel}\n`);
            } else if (readFileSync(file).subarray(0, 5).toString('latin1') !== '%PDF-') {
                failures++;
                process.stderr.write(`FAIL  ${rel} does not start with %PDF-\n`);
            }
        }
    }

    // Every PDF on disk is one the plan lists; a sample that writes an extra
    // file would otherwise be fingerprinted under a name nobody reviewed. The
    // network-excluded sample's output is removed so it never enters the baseline.
    const planned = new Set(SAMPLE_PLAN.filter((e) => e.exclude === undefined).flatMap(expectedOutputs));
    const excluded = new Set(SAMPLE_PLAN.filter((e) => e.exclude !== undefined).flatMap(expectedOutputs));
    let bytes = 0;
    let collected = 0;
    for (const file of walkPdfs(OUTPUT_DIR)) {
        const rel = relative(OUTPUT_DIR, file).split('\\').join('/');
        if (excluded.has(rel)) {
            rmSync(file);
            say(`  skip   ${rel} (network — run, not fingerprinted)`);
            continue;
        }
        if (!planned.has(rel)) {
            failures++;
            process.stderr.write(`FAIL  ${rel} was written but no sample-plan entry lists it\n`);
            continue;
        }
        bytes += statSync(file).size;
        collected++;
    }

    const seconds = (Date.now() - started) / 1000;
    if (json) {
        process.stdout.write(`${JSON.stringify({ ran: runs.length, failures, samples: collected, bytes, seconds, outputDir: OUTPUT_DIR }, null, 2)}\n`);
        return failures === 0 ? 0 : 1;
    }
    process.stdout.write(`${String(collected)} samples, ${formatBytes(bytes)}, ${seconds.toFixed(1)} s → test-output/samples/ (${String(runs.length)} samples run, ${String(width)} in parallel)\n`);
    return failures === 0 ? 0 : 1;
}

process.exit(await main());
