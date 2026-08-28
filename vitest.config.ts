import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'jsdom',
        // Use worker threads: the package drives a second React reconciler, and
        // the default forks pool is markedly slower (and flakier) for that work.
        pool: 'threads',
        include: ['tests/**/*.test.{ts,tsx}'],
        setupFiles: ['tests/setup.ts'],
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
            // Raised for 1.2.0 (measured: 95.0 / 90.0 / 97.8 / 95.9) — the
            // gap to the measured value is head-room for legitimate churn,
            // not an invitation to regress.
            thresholds: {
                statements: 90,
                branches: 84,
                functions: 92,
                lines: 90,
            },
        },
    },
});
