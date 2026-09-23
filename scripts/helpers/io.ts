/**
 * I/O helpers shared by the sample generator, the corpus generator and the
 * verifiers. Ported from pdfnative-mcp's scripts/helpers/io.ts (1.7.0, itself
 * from pdfnative-cli 1.5.0 and pdfnative 1.8.0).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..', '..');
/** Every generated artefact lives under here; git-ignored. */
export const TEST_OUTPUT_DIR = resolve(REPO_ROOT, 'test-output');
/** The reproducible sample corpus (`npm run test:generate`). */
export const OUTPUT_DIR = resolve(TEST_OUTPUT_DIR, 'samples');

/**
 * The instant every sample is stamped with.
 *
 * Unencrypted pdfnative output is a pure function of its inputs plus this one
 * date — the trailer `/ID` is an MD5 of title + creation date + object count —
 * so pinning it makes the whole sample suite byte-reproducible and lets
 * `npm run verify:samples` detect regressions by hash. Changing this value
 * invalidates every baseline hash.
 *
 * Each sample runs in its own process (scripts/generate-samples.ts), which is
 * started with `scripts/helpers/pin-creation-date.mjs` preloaded: the engine's
 * process-wide `setDefaultCreationDate()` is set to this instant before the
 * sample's first line runs, so a sample that pins nothing still produces the
 * baseline bytes, and one that pins its own `creationDate` wins.
 */
export const SAMPLE_CREATION_DATE = new Date('2026-01-01T00:00:00Z');
export const SAMPLE_CREATION_ISO = SAMPLE_CREATION_DATE.toISOString();
export const SOURCE_DATE_EPOCH = String(Math.floor(SAMPLE_CREATION_DATE.getTime() / 1000));

export interface OutputMode {
    /** Summary lines only. Implied when stdout is not a terminal, unless --verbose. */
    readonly quiet: boolean;
    /** Machine-readable output on stdout. Implies quiet for everything else. */
    readonly json: boolean;
}

/**
 * Parse the `--quiet` / `--verbose` / `--json` trio shared by the sample
 * scripts. A pipe (CI log, an agent's captured output, `scripts/gate.ts`)
 * gets the quiet form by default so a human at a terminal sees the full
 * table and everyone else sees a few lines; `--verbose` forces the table
 * through a pipe, `--quiet` forces the summary at a terminal.
 *
 * Returns an error message for anything else, so callers can exit 2.
 */
export function parseOutputMode(argv: readonly string[], isTTY: boolean = process.stdout.isTTY === true): OutputMode | { readonly error: string } {
    let quiet = false;
    let verbose = false;
    let json = false;
    for (const a of argv) {
        if (a === '--quiet') quiet = true;
        else if (a === '--verbose') verbose = true;
        else if (a === '--json') json = true;
        else return { error: `Unknown argument "${a}". Expected --quiet, --verbose and/or --json.` };
    }
    if (quiet && verbose) return { error: '--quiet and --verbose are mutually exclusive.' };
    return { quiet: json || quiet || (!isTTY && !verbose), json };
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${String(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
