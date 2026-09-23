// @vitest-environment node
// scripts/helpers/hermetic.ts is imported first by every generator and by
// the gate: it pins TZ=UTC and removes every operator knob inherited from the
// developer's shell, so a local SOURCE_DATE_EPOCH can never change the bytes
// a script produces by accident (the generator sets its own, on purpose).
// The library itself reads no environment variable — that is a design rule,
// held here on the source tree.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isOperatorKnob, scrubEnv } from '../../scripts/helpers/hermetic.js';

const ROOT = resolve(import.meta.dirname, '..', '..');

function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir).sort()) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) yield* walk(p);
        else if (/\.tsx?$/.test(entry)) yield p;
    }
}

describe('hermetic environment', () => {
    it('pins the process time zone to UTC on import', () => {
        expect(process.env['TZ']).toBe('UTC');
        expect(new Date(Date.UTC(2026, 0, 1)).getTimezoneOffset()).toBe(0);
    });

    it('recognises SOURCE_DATE_EPOCH and the reserved PDFNATIVE_REACT_ prefix, and nothing unrelated', () => {
        expect(isOperatorKnob('SOURCE_DATE_EPOCH')).toBe(true);
        expect(isOperatorKnob('PDFNATIVE_REACT_FUTURE_KNOB')).toBe(true);
        for (const name of ['PATH', 'TZ', 'NODE_OPTIONS', 'GATE', 'GATE_REQUIRE_ARTIFACTS', 'VERAPDF_HOME', 'JAVACMD', 'PDFNATIVE', 'PDFNATIVE_MCP_OUTPUT_DIR', 'XPDFNATIVE_REACT_X']) {
            expect(isOperatorKnob(name), name).toBe(false);
        }
    });

    it('scrubs the knobs in place, reports them, and leaves the rest of the environment alone', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: '/usr/bin',
            TZ: 'UTC',
            SOURCE_DATE_EPOCH: '1767225600',
            PDFNATIVE_REACT_X: '1',
            VERAPDF_HOME: '/opt/verapdf',
        };
        const removed = scrubEnv(env).sort();
        expect(removed).toEqual(['PDFNATIVE_REACT_X', 'SOURCE_DATE_EPOCH']);
        expect(env).toEqual({ PATH: '/usr/bin', TZ: 'UTC', VERAPDF_HOME: '/opt/verapdf' });
        expect(scrubEnv(env)).toEqual([]);
    });

    it('left no operator knob in this process after the import', () => {
        expect(Object.keys(process.env).filter(isOperatorKnob)).toEqual([]);
    });
});

describe('the library reads no environment variable', () => {
    it('src/ never touches process.env — pins are explicit props or setDefaultCreationDate()', () => {
        const offenders: string[] = [];
        for (const file of walk(join(ROOT, 'src'))) {
            const text = readFileSync(file, 'utf8');
            // `process.versions.node` (doctor) is a runtime fact, not configuration.
            if (/process\.env\b/.test(text)) offenders.push(file.slice(ROOT.length + 1).replace(/\\/g, '/'));
        }
        expect(offenders).toEqual([]);
    });
});
