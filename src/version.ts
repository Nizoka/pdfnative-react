/**
 * Single source of truth for the package version.
 *
 * Kept in its own module so non-barrel files (e.g. the spec schema) can read the
 * version without importing the public barrel — which would create an import
 * cycle. A test pins this constant to `package.json`.
 *
 * @packageDocumentation
 */

/** Current package version (kept in sync with `package.json`). */
export const version = '1.0.0';
