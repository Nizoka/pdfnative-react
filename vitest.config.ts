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
            thresholds: {
                statements: 85,
                branches: 80,
                functions: 85,
                lines: 85,
            },
        },
    },
});
