/**
 * Hermetic process environment — side-effect module.
 *
 * Import this module FIRST, before anything that loads `src/` or `dist/`.
 * ES modules evaluate imports in source order, so a bare
 * `import './helpers/hermetic.js';` placed above the others runs before them.
 *
 * 1. `TZ=UTC` (see ./tz.ts): pdfnative >= 1.8 writes its own dates in UTC,
 *    but the scripts and tests format instants themselves (expected strings,
 *    the sample creation date), so the zone is pinned regardless.
 * 2. Every operator knob inherited from the parent shell is removed.
 *    pdfnative-react itself reads no environment variable — by design, a
 *    library never reads the process environment on behalf of its host — but
 *    the sample generator honours `SOURCE_DATE_EPOCH` (reproducible-builds.org)
 *    and `PDFNATIVE_REACT_*` is reserved for future tooling knobs; a
 *    developer's shell must not change the bytes a script produces.
 *
 * Scripts that want a pin set it explicitly after this import.
 *
 * Ported from pdfnative-mcp 1.7.0 (scripts/helpers/hermetic.ts).
 */
import './tz.js';

/** True for a variable the tooling (or the engine pin) would read. */
export function isOperatorKnob(name: string): boolean {
    return name.startsWith('PDFNATIVE_REACT_') || name === 'SOURCE_DATE_EPOCH';
}

/** Remove every operator knob from `env` in place; returns the removed names. */
export function scrubEnv(env: NodeJS.ProcessEnv): string[] {
    const removed: string[] = [];
    for (const key of Object.keys(env)) {
        if (isOperatorKnob(key)) {
            delete env[key];
            removed.push(key);
        }
    }
    return removed;
}

scrubEnv(process.env);
process.env.NO_COLOR = '1';
process.env.FORCE_COLOR = '0';
