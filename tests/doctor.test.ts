/**
 * `doctor()` grades the engine newest-first through three capability probes.
 *
 * The probes are engine exports that first ship in 1.8.0, 1.7.0 and 1.6.0.
 * Under a bundler or CJS interop an older engine yields an `undefined` export
 * rather than a link error, so each grade is simulated by mocking the bridge
 * with the newer probes removed — and the report must never throw.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type Bridge = typeof import('../src/core-bridge/index.js');

async function doctorWith(overrides: Partial<Record<keyof Bridge, unknown>>) {
    vi.resetModules();
    vi.doMock('../src/core-bridge/index.js', async () => {
        const actual = await vi.importActual<Bridge>('../src/core-bridge/index.js');
        return { ...actual, ...overrides };
    });
    const { doctor } = await import('../src/doctor.js');
    return doctor();
}

afterEach(() => {
    vi.doUnmock('../src/core-bridge/index.js');
    vi.resetModules();
});

describe('doctor — engine grading', () => {
    it('reports >= 1.8.0 when the 1.8.0 probe is present', async () => {
        const report = await doctorWith({});
        expect(report.checks.find((c) => c.name === 'pdfnative')).toMatchObject({
            status: 'ok',
            value: '>= 1.8.0',
        });
        expect(report.ok).toBe(true);
    });

    it('grades a 1.7.x engine down and names the required floor', async () => {
        const report = await doctorWith({ setDefaultCreationDate: undefined });
        const engine = report.checks.find((c) => c.name === 'pdfnative');
        expect(engine?.status).toBe('error');
        expect(engine?.value).toContain('1.7.x');
        expect(engine?.value).toContain('>= 1.8.0');
        expect(report.ok).toBe(false);
    });

    it('grades a 1.6.x engine down', async () => {
        const report = await doctorWith({ setDefaultCreationDate: undefined, validatePrintOptions: undefined });
        expect(report.checks.find((c) => c.name === 'pdfnative')?.value).toContain('1.6.x');
    });

    it('reports an engine older than 1.6.0, still without throwing', async () => {
        const report = await doctorWith({
            setDefaultCreationDate: undefined,
            validatePrintOptions: undefined,
            estimateChartHeight: undefined,
        });
        expect(report.checks.find((c) => c.name === 'pdfnative')?.value).toBe('missing or older than 1.6.0');
        expect(report.ok).toBe(false);
    });
});
