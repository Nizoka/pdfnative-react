/**
 * Preload for the sample generator's child processes.
 *
 * `scripts/generate-samples.ts` starts every sample as
 * `node --import tsx --import <this file> samples/<name>.tsx`, so the engine's
 * process-wide creation instant is pinned before the sample's first line runs
 * and the sample source stays exactly what the README documents — no harness
 * import, no special export. The samples import `../src/index.js`, whose
 * core-bridge resolves `pdfnative` to the same module instance this preload
 * pins (one file URL, one ESM cache entry).
 *
 * The instant is `SOURCE_DATE_EPOCH` when the parent set it (the generator
 * always does, from scripts/helpers/io.ts), otherwise the wall clock stays —
 * running a sample by hand is unaffected.
 *
 * Plain JavaScript on purpose: it is loaded before the TypeScript hooks are
 * guaranteed to be active. This is tooling, not the library: the package
 * itself never reads the environment (docs/REPRODUCIBLE.md).
 */
import { setDefaultCreationDate } from 'pdfnative';

const epoch = process.env.SOURCE_DATE_EPOCH;
if (epoch !== undefined && /^\d{1,12}$/.test(epoch)) {
    setDefaultCreationDate(new Date(Number(epoch) * 1000));
}
