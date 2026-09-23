// @vitest-environment node
// Contract of scripts/gate.ts: the STEPS table is the one place the quality
// gate is defined, so these tests hold it to the shape CI, CONTRIBUTING and
// the agent files rely on. No step is executed here; the pure judge
// (`probeDist`) is fed hostile input directly.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIST_FILES, STEPS, parseArgs, probeDist, selectSteps } from '../../scripts/gate.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    exports: Record<string, { import: { types: string; default: string }; require: { types: string; default: string } } | string>;
};

describe('gate: step table', () => {
    it('has unique ids', () => {
        const ids = STEPS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every npm-script step names a script that exists in package.json', () => {
        for (const s of STEPS) {
            if (s.npmScript !== undefined) expect(pkg.scripts, s.id).toHaveProperty(s.npmScript);
        }
    });

    it('every step is either an npm script or an inline check, never both', () => {
        for (const s of STEPS) {
            expect(Boolean(s.npmScript) !== Boolean(s.inline), s.id).toBe(true);
        }
    });

    it('the fast profile is exactly typecheck:all, lint, test and verify:docs', () => {
        const fast = STEPS.filter((s) => s.profiles.includes('fast')).map((s) => s.id);
        expect(fast).toEqual(['typecheck:all', 'lint', 'test', 'verify:docs']);
    });

    it('the ci profile runs everything except validate:pdfa; publish runs everything', () => {
        const ci = STEPS.filter((s) => s.profiles.includes('ci')).map((s) => s.id);
        const publish = STEPS.filter((s) => s.profiles.includes('publish')).map((s) => s.id);
        expect(ci).not.toContain('validate:pdfa');
        expect(ci).not.toContain('test'); // coverage variant instead
        expect(publish).toEqual(STEPS.filter((s) => s.id !== 'test').map((s) => s.id));
    });

    it('the only skippable step is validate:pdfa (veraPDF is external); validate:pdfx never skips', () => {
        const skippable = STEPS.filter((s) => s.skipWhen !== undefined).map((s) => s.id);
        expect(skippable).toEqual(['validate:pdfa']);
    });

    it('builds before every step that drives dist/ — the coverage run included', () => {
        const order = STEPS.map((s) => s.id);
        const build = order.indexOf('build');
        for (const id of ['dist-check', 'dist-probe', 'bundle-smoke', 'pack-check', 'test:generate', 'test:coverage', 'corpus:pdfa', 'validate:pdfx', 'validate:pdfa']) {
            expect(order.indexOf(id), id).toBeGreaterThan(build);
        }
        expect(order.indexOf('corpus:pdfa')).toBeLessThan(order.indexOf('validate:pdfx'));
        expect(order.indexOf('corpus:pdfa')).toBeLessThan(order.indexOf('validate:pdfa'));
        expect(order.indexOf('test:generate')).toBeLessThan(order.indexOf('verify:samples'));
        expect(order.indexOf('dist-probe')).toBe(order.indexOf('dist-check') + 1);
        expect(order.indexOf('bundle-smoke')).toBe(order.indexOf('dist-probe') + 1);
        expect(order.indexOf('pack-check')).toBe(order.indexOf('bundle-smoke') + 1);
    });

    it('generates the samples before the coverage run, so the regression suite runs on CI', () => {
        const order = STEPS.map((s) => s.id);
        expect(order.indexOf('test:generate')).toBeLessThan(order.indexOf('test:coverage'));
    });

    it('the fast profile runs the tests without a build; the coverage run requires the artifacts', () => {
        expect(STEPS.find((s) => s.id === 'test')?.env).toEqual({ GATE: '1' });
        expect(STEPS.find((s) => s.id === 'test:coverage')?.env).toEqual({ GATE: '1', GATE_REQUIRE_ARTIFACTS: '1' });
    });

    it('the dist checks, the bundle smoke and the pack check are inline steps of the ci and publish profiles', () => {
        for (const id of ['dist-check', 'dist-probe', 'bundle-smoke', 'pack-check']) {
            expect(STEPS.find((s) => s.id === id)?.inline, id).toBeTypeOf('function');
            expect(STEPS.find((s) => s.id === id)?.profiles, id).toEqual(['ci', 'publish']);
        }
    });

    it('dist-check covers every target of the exports map', () => {
        const targets = new Set<string>();
        for (const entry of Object.values(pkg.exports)) {
            if (typeof entry === 'string') continue;
            for (const condition of [entry.import, entry.require]) {
                targets.add(condition.types.replace(/^\.\//, ''));
                targets.add(condition.default.replace(/^\.\//, ''));
            }
        }
        expect(targets.size).toBe(8);
        for (const t of targets) expect(DIST_FILES as readonly string[], t).toContain(t);
    });
});

describe('gate: dist probe', () => {
    const CLIENT = "'use client';\nexport const x = 1;";
    const INDEX = "import('node:fs/promises');\nexport const y = 2;";

    it('passes the eight artefacts and their maps, client-marked and server-safe', () => {
        expect(probeDist([
            { path: 'dist/index.js', text: INDEX },
            { path: 'dist/index.cjs', text: INDEX },
            { path: 'dist/client.js', text: CLIENT },
            { path: 'dist/client.cjs', text: CLIENT },
            { path: 'dist/index.d.ts', text: '' },
            { path: 'dist/client.d.cts', text: '' },
            { path: 'dist/index.js.map', text: '' },
        ])).toEqual([]);
    });

    it('fails a client bundle without the directive and an index bundle with it', () => {
        expect(probeDist([{ path: 'dist\\client.js', text: 'export const x = 1;' }])).toEqual([expect.stringMatching(/dist\/client\.js: the 'use client' directive is missing/)]);
        expect(probeDist([{ path: 'dist/index.cjs', text: "'use client';\nimport('node:fs/promises');" }])).toEqual([expect.stringMatching(/dist\/index\.cjs: carries a 'use client' directive/)]);
    });

    it('fails on console.log, a bare fs/promises import, and a stray directory under dist/', () => {
        expect(probeDist([{ path: 'dist/index.js', text: `${INDEX}\nconsole.log ("debug")` }])).toEqual([expect.stringMatching(/console\.log\(\) in emitted JavaScript/)]);
        expect(probeDist([{ path: 'dist/index.js', text: "import('fs/promises');" }])).toEqual([expect.stringMatching(/lost its node: prefix/)]);
        expect(probeDist([{ path: 'dist/tests/a.test.js', text: '' }, { path: 'dist/samples/x.js', text: '' }])).toHaveLength(2);
    });

    it('ignores console.log in a declaration file', () => {
        expect(probeDist([{ path: 'dist/index.d.ts', text: '/** console.log(x) */' }])).toEqual([]);
    });
});

describe('gate: argument parsing and step selection', () => {
    it('defaults to the ci profile', () => {
        const opts = parseArgs([]);
        expect('error' in opts).toBe(false);
        if (!('error' in opts)) expect(opts.profile).toBe('ci');
    });

    it('rejects two profiles, unknown steps and unknown flags', () => {
        expect(parseArgs(['--fast', '--ci'])).toHaveProperty('error');
        expect(parseArgs(['--only', 'nope'])).toHaveProperty('error');
        expect(parseArgs(['--only'])).toHaveProperty('error');
        expect(parseArgs(['--bogus'])).toHaveProperty('error');
    });

    it('--only selects one step regardless of profile', () => {
        const opts = parseArgs(['--fast', '--only', 'validate:pdfa']);
        if ('error' in opts) throw new Error(opts.error);
        expect(selectSteps(opts).map((s) => s.id)).toEqual(['validate:pdfa']);
    });

    it('--from resumes the profile at the given step', () => {
        const opts = parseArgs(['--ci', '--from', 'build']);
        if ('error' in opts) throw new Error(opts.error);
        const ids = selectSteps(opts).map((s) => s.id);
        expect(ids[0]).toBe('build');
        expect(ids).not.toContain('lint');
    });

    it('--from a step outside the profile resumes at its table position', () => {
        const opts = parseArgs(['--fast', '--from', 'build']);
        if ('error' in opts) throw new Error(opts.error);
        expect(selectSteps(opts).map((s) => s.id)).toEqual(['verify:docs']);
        const fromTest = parseArgs(['--fast', '--from', 'test']);
        if ('error' in fromTest) throw new Error(fromTest.error);
        expect(selectSteps(fromTest).map((s) => s.id)).toEqual(['test', 'verify:docs']);
    });

    it('--require-all and --json are recognised', () => {
        const opts = parseArgs(['--publish', '--require-all', '--json']);
        if ('error' in opts) throw new Error(opts.error);
        expect(opts.requireAll).toBe(true);
        expect(opts.json).toBe(true);
        expect(opts.profile).toBe('publish');
    });
});

describe('gate: wiring', () => {
    it('CI and publish run the gate with --require-all', () => {
        const ci = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
        expect(ci).toMatch(/scripts\/gate\.ts --ci --require-all/);
        const publish = readFileSync(resolve(ROOT, '.github/workflows/publish.yml'), 'utf8');
        expect(publish).toMatch(/scripts\/gate\.ts --publish --require-all/);
    });

    it('the pre-push hook runs the fast profile', () => {
        const hook = readFileSync(resolve(ROOT, '.githooks/pre-push'), 'utf8');
        expect(hook).toMatch(/npm run gate:fast/);
    });

    it('package.json routes gate and gate:fast to the script, and publishing through the build only', () => {
        expect(pkg.scripts['gate']).toMatch(/scripts\/gate\.ts/);
        expect(pkg.scripts['gate:fast']).toMatch(/scripts\/gate\.ts --fast/);
        expect(pkg.scripts['prepublishOnly']).toBe('npm run build');
        expect(pkg.scripts).not.toHaveProperty('prepare');
    });

    it('typecheck:all covers src, tests, samples, scripts and the 1.2.0 compatibility snapshot', () => {
        for (const part of ['typecheck', 'typecheck:tests', 'typecheck:samples', 'typecheck:scripts', 'typecheck:compat']) {
            expect(pkg.scripts['typecheck:all']).toContain(`npm run ${part}`);
        }
    });
});
