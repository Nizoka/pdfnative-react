/**
 * Shared by the suites that drive the BUILT package (`dist/`): the two-time-
 * zone reproducibility proof and the sample regression gate. In a plain local
 * run they skip when their input is absent; under the gate's ci / publish
 * profiles, which build and generate before `test:coverage` and set
 * `GATE_REQUIRE_ARTIFACTS=1`, a missing input FAILS the file instead — a
 * runner where these suites quietly skipped would prove nothing.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..');
export const DIST_INDEX = join(REPO_ROOT, 'dist', 'index.js');

export const hasDist = existsSync(DIST_INDEX);
export const artifactsRequired = process.env['GATE_REQUIRE_ARTIFACTS'] === '1';

/** Throw when a required artefact is missing under the gate; return the skip flag otherwise. */
export function requireArtifact(present: boolean, what: string, produce: string): boolean {
    if (!present && artifactsRequired) {
        throw new Error(`${what} is missing but GATE_REQUIRE_ARTIFACTS=1: the gate produces it before test:coverage — run \`${produce}\``);
    }
    return !present;
}
