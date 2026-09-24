#!/usr/bin/env tsx
/**
 * pdfnative-react — Sample regression gate (v1.3.0)
 * ===================================================
 * Fingerprints every generated sample and compares the result to the
 * committed baseline, so a change anywhere in the renderer — or in the
 * pdfnative engine it pins — that alters existing output is caught before it
 * ships.
 *
 * The baseline is a CHAIN, not a snapshot of the current tree. Each entry
 * records the release whose output its hash is (`since`) and keeps it across
 * every later rebaseline that leaves the sample alone, so 1.4.0 will still be
 * held to the bytes v1.3.0 emitted, and so on. An entry whose hash is
 * deliberately re-anchored moves to the release doing the re-anchoring, which
 * is what makes it visible in review. A sample introduced by the release under
 * development has no earlier reference, so it is reported but does not fail —
 * pass `--strict` to require it to be baselined in the same pull request.
 *
 * Usage:
 *   npm run test:generate                       # populate test-output/samples/
 *   npm run verify:samples                      # compare against the baseline
 *   npx tsx scripts/verify-samples.ts --update  # rewrite the baseline
 *   npx tsx scripts/verify-samples.ts --strict  # also fail on new samples
 *   npx tsx scripts/verify-samples.ts --json    # machine-readable report
 *
 * (PowerShell swallows a bare `--`, so call the script directly when passing
 * flags rather than `npm run verify:samples -- --update`.)
 *
 * The fingerprinting itself lives in `scripts/lib/sample-fingerprint.ts`,
 * shared with the vitest gate at `tests/regression/samples.test.ts` so both
 * agree on what "unchanged output" means.
 *
 * Exit codes:
 *   0 — every sample matches the baseline (or --update rewrote it)
 *   1 — a fingerprint changed, a sample vanished, or a new sample is not in
 *       the baseline
 *   2 — bad usage, or test-output/samples/ is empty (run test:generate first)
 *
 * Why not a pixel diff: pdfnative ships no rasteriser, so charts, SVG,
 * barcodes, watermarks, printer's marks and colour emoji would all compare as
 * blank; bytes are the reference. The visual tier stays external and opt-in
 * (samples/agent/visual-verify.tsx).
 */

// Must be first: pins TZ and scrubs operator knobs before the engine is loaded.
import './helpers/hermetic.js';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative } from 'node:path';

import {
    REPO_ROOT, BASELINE_PATH,
    fingerprintAll, loadBaseline, compareToBaseline, currentVersion, chainSince, unexpectedDuplicates,
    type Fingerprint, type Baseline,
} from './lib/sample-fingerprint.js';
import { SAMPLE_CREATION_DATE } from './helpers/io.js';

/** Provenance written only when no manifest exists yet. */
const INITIAL_PROVENANCE =
    'Initial baseline: every entry is anchored to the release that created it. Replace this note '
    + 'with the account of how the entries were verified; later rebaselines carry it forward.';

/**
 * Write the manifest, carrying each sample's `since` forward.
 *
 * The provenance note is the maintainer's account of why each group of
 * entries is anchored where it is. It is carried forward verbatim: an
 * --update must never silently replace it. Edit it by hand in the same
 * commit as the rebaseline it explains.
 */
function saveBaseline(entries: Record<string, Fingerprint>, previous: Baseline | null): void {
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    const version = currentVersion();
    const sorted = chainSince(entries, previous, version);
    const payload: Baseline = {
        $comment:
            'Fingerprints of every sample in test-output/samples/ (each sample run by '
            + 'scripts/generate-samples.ts in its own process with the creation instant pinned, '
            + 'in UTC). Regenerate deliberately with `npx tsx scripts/verify-samples.ts --update`, '
            + 'and say why in the release notes: a changed hash means existing output changed. '
            + 'Mode `bytes` is a SHA-256 of the file; mode `semantic` is a SHA-256 of a canonical '
            + 'projection of the document, reserved for encrypted samples (CSPRNG file key and IVs), '
            + 'of which this repository has none. '
            + 'Each entry\'s `since` names the release whose output the hash is: it is carried '
            + 'forward untouched while the sample is unchanged, and moves to the release doing '
            + 'the rebaseline when the hash changes, so the chain 1.3.0 -> 1.4.0 -> … stays '
            + 'auditable and every re-anchoring is visible in the diff.',
        baselineVersion: version,
        provenance: previous?.provenance ?? INITIAL_PROVENANCE,
        creationDate: SAMPLE_CREATION_DATE.toISOString(),
        timezone: 'UTC',
        entries: sorted,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main(): number {
    const args = process.argv.slice(2);
    for (const a of args) {
        if (a !== '--update' && a !== '--json' && a !== '--strict') {
            console.error(`Unknown argument "${a}". Expected --update, --json and/or --strict.`);
            return 2;
        }
    }
    const update = args.includes('--update');
    const jsonMode = args.includes('--json');
    const strict = args.includes('--strict');

    const { entries, unreadable, missingSemantic } = fingerprintAll();
    const total = Object.keys(entries).length;
    if (total === 0 && unreadable.length === 0) {
        console.error('test-output/samples/ holds no samples — run `npm run test:generate` first.');
        return 2;
    }
    // Two samples meant to show a difference must not be the same file.
    const duplicates = unexpectedDuplicates(entries);

    if (update) {
        if (unreadable.length > 0 || missingSemantic.length > 0 || duplicates.length > 0) {
            for (const u of unreadable) console.error(`✗ ${u.path}: ${u.error}`);
            for (const m of missingSemantic) console.error(`✗ ${m}: listed in ENCRYPTED_SAMPLES but not generated`);
            for (const g of duplicates) console.error(`✗ ${g.join(' == ')}: identical bytes (list the pair in IDENTICAL_SAMPLE_GROUPS if that is intended)`);
            console.error('\nRefusing to write a baseline while samples are unreadable, missing or unexpectedly identical.');
            return 1;
        }
        const previous = loadBaseline();
        saveBaseline(entries, previous);
        console.log(`Baseline updated: ${String(total)} samples → ${relative(REPO_ROOT, BASELINE_PATH)}`);
        return 0;
    }

    const baseline = loadBaseline();
    if (baseline === null) {
        console.error(
            `No baseline at ${relative(REPO_ROOT, BASELINE_PATH)}.\n`
            + 'Create it with: npx tsx scripts/verify-samples.ts --update',
        );
        return 1;
    }

    const { changed, added, removed } = compareToBaseline(entries, baseline);

    if (jsonMode) {
        console.log(JSON.stringify({
            baselineVersion: baseline.baselineVersion,
            currentVersion: currentVersion(),
            total, changed, added, removed, unreadable, missingSemantic, duplicates,
        }, null, 2));
    } else {
        for (const u of unreadable) console.error(`✗ unreadable  ${u.path}: ${u.error}`);
        for (const m of missingSemantic) console.error(`✗ missing     ${m} (listed in ENCRYPTED_SAMPLES)`);
        for (const g of duplicates) console.error(`✗ identical   ${g.join(' == ')} (a pair meant to differ emits the same bytes)`);
        for (const p of changed) {
            const b = baseline.entries[p];
            const c = entries[p];
            const sizeNote = b.size === c.size ? `${String(c.size)} B` : `${String(b.size)} B → ${String(c.size)} B`;
            console.error(`✗ changed     ${p}  [${c.mode}]  ${sizeNote}`);
        }
        for (const p of removed) console.error(`✗ disappeared ${p} (in the baseline, not generated)`);
        // A sample introduced by the release under development has no earlier
        // reference to be held to, so it informs rather than blocks. Pass
        // --strict to require the manifest to be rebaselined in the same PR.
        for (const p of added) {
            const line = `${strict ? '✗' : '•'} new         ${p} (no prior reference — rebaseline to start tracking it)`;
            if (strict) console.error(line); else console.log(line);
        }
    }

    const failures = changed.length + removed.length + unreadable.length + missingSemantic.length
        + duplicates.length + (strict ? added.length : 0);
    if (failures === 0) {
        if (!jsonMode) {
            const semantic = Object.values(entries).filter((e) => e.mode === 'semantic').length;
            const tracked = total - added.length;
            console.log(
                `✓ ${String(tracked)} tracked samples match the baseline `
                + `(${String(tracked - semantic)} byte-exact, ${String(semantic)} semantic)`
                + `${added.length > 0 ? `; ${String(added.length)} new, untracked` : ''}.`,
            );
        }
        return 0;
    }

    if (!jsonMode) {
        console.error(
            `\n${String(failures)} sample(s) diverged from the baseline.\n`
            + 'If the change is intended, say so in the release notes and rebaseline with:\n'
            + '  npm run test:generate && npx tsx scripts/verify-samples.ts --update',
        );
    }
    return 1;
}

process.exit(main());
