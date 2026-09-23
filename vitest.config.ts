import { defineConfig } from 'vitest/config';

/**
 * Reporters are chosen for token-cheap output: `dot` prints one character
 * per test instead of one line per file, and `github-actions` adds inline
 * annotations on CI only. When `scripts/gate.ts` drives the run (GATE=1) a
 * JSON report is written as well, which is where the gate reads the test
 * count from; nothing else needs the file, so it is not produced otherwise.
 */
const reporters: Array<'dot' | 'github-actions' | ['json', { outputFile: string }]> = ['dot'];
if (process.env.GITHUB_ACTIONS) reporters.push('github-actions');
if (process.env.GATE === '1') reporters.push(['json', { outputFile: 'test-output/.gate/vitest.json' }]);

export default defineConfig({
    test: {
        globals: false,
        // The renderer's own suites need a DOM (hooks, viewer, Testing
        // Library); the tooling and regression suites under tests/tools and
        // tests/regression declare `@vitest-environment node` at their top.
        environment: 'jsdom',
        include: ['tests/**/*.test.{ts,tsx}'],
        setupFiles: ['tests/setup.ts'],
        reporters,
        // pdfnative >= 1.8 writes every date in UTC, but tests also format
        // instants themselves (expected strings, the sample creation date).
        // Pinning the zone makes the suite machine-independent;
        // scripts/helpers/hermetic.ts does the same for the sample generator.
        env: { TZ: 'UTC' },
        // Process isolation: a test that leaks a global, a timer, the
        // process-wide creation-date pin, a hyphenation provider or a
        // registered font cannot influence the next file's outcome. (1.2.0
        // ran on `threads` for speed; the 1.3.0 suites mutate process state
        // deliberately, and the `os` CI job proves `forks` on three OSes.)
        pool: 'forks',
        // Determinism: the same ordering on every machine, so a failure seen
        // in CI reproduces locally without a seed.
        sequence: { shuffle: false },
        // Real PDF/X-4 and PDF/UA renders embed a full Noto Sans subset; under
        // v8 coverage instrumentation on a Windows runner that needs headroom.
        testTimeout: 30_000,
        hookTimeout: 60_000,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/index.ts',
                'src/**/*.d.ts',
                // Thin react-reconciler adapter: most members are framework-
                // required no-ops (suspense, hydration, transition surface)
                // that React invokes internally and cannot be unit-tested
                // meaningfully. Its real logic is covered via compile/render.
                'src/reconciler/host-config.ts',
            ],
            // `text-summary` is four lines instead of one per source file;
            // `json-summary` is what scripts/gate.ts reads the percentage
            // from; `html` stays for local drill-down.
            reporter: ['text-summary', 'json-summary', 'html'],
            // Raised for 1.2.0 (measured: 95.0 / 90.0 / 97.8 / 95.9) — the
            // gap to the measured value is head-room for legitimate churn,
            // not an invitation to regress. Never lower these; raise them
            // when a release lifts coverage.
            thresholds: {
                statements: 90,
                branches: 84,
                functions: 92,
                lines: 90,
            },
        },
    },
});
