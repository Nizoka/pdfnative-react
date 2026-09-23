// @vitest-environment node
/**
 * The two-time-zone proof over the BUILT package.
 *
 * "Byte-identical on every host" is asserted in the README and proven here:
 * one document, rendered by `dist/index.js` in two child processes whose
 * `TZ` sit on opposite sides of the date line, must produce the same bytes —
 * with a per-document `creationDate`, and with the process-wide
 * `setDefaultCreationDate()` alone. The dates inside the file end in
 * `+00'00'` in both zones, and the `{date}` placeholder follows the pin.
 *
 * Skips without `dist/` in a plain local run; under the gate
 * (`GATE_REQUIRE_ARTIFACTS=1`) a missing build fails the file.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DIST_INDEX, REPO_ROOT, hasDist, requireArtifact } from '../_dist.js';

const skip = requireArtifact(hasDist, 'dist/index.js', 'npm run build');

/** The zones MCP's proof uses: opposite sides of the date line. */
const ZONES = ['Pacific/Kiritimati', 'America/Los_Angeles'] as const;

const SPEC = {
    title: 'Two zones',
    header: { right: 'Built {date}' },
    layout: { compress: false },
    blocks: [['h1', 'Reproducible'], ['p', 'Same bytes in every zone.']],
};

/** Render through dist/index.js in a child process under `tz`; returns the PDF as latin1 text. */
function renderIn(tz: string, mode: 'prop' | 'default'): string {
    const url = pathToFileURL(DIST_INDEX).href;
    const pin = '2026-01-01T23:30:00Z';
    const script = [
        `const lib = await import(${JSON.stringify(url)});`,
        mode === 'default' ? `lib.setDefaultCreationDate(new Date(${JSON.stringify(pin)}));` : '',
        `const spec = ${JSON.stringify(SPEC)};`,
        mode === 'prop' ? `spec.creationDate = ${JSON.stringify(pin)};` : '',
        'const bytes = lib.renderSpecToBytes(spec);',
        "process.stdout.write(Buffer.from(bytes).toString('base64'));",
    ].join('\n');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: REPO_ROOT,
        env: { ...process.env, TZ: tz, NO_COLOR: '1' },
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000,
    });
    if (r.status !== 0) throw new Error(`render under TZ=${tz} failed (exit ${String(r.status)}): ${r.stderr}`);
    return Buffer.from(r.stdout.trim(), 'base64').toString('latin1');
}

describe.skipIf(skip)('reproducible build across time zones (built package)', () => {
    it('a document pinned with creationDate is byte-identical in two zones, and the dates are UTC', () => {
        const [a, b] = ZONES.map((tz) => renderIn(tz, 'prop'));
        expect(a.startsWith('%PDF-')).toBe(true);
        expect(a).toBe(b);
        expect(a).toContain("/CreationDate (D:20260101233000+00'00')");
        // The {date} placeholder follows the pin, in UTC: 23:30Z is still 1 January.
        expect(a).toContain('Built 2026-01-01');
    });

    it('a process-wide setDefaultCreationDate() pin gives the same bytes as the prop, in both zones', () => {
        const viaDefault = ZONES.map((tz) => renderIn(tz, 'default'));
        expect(viaDefault[0]).toBe(viaDefault[1]);
        expect(viaDefault[0]).toBe(renderIn(ZONES[0], 'prop'));
    });
});
