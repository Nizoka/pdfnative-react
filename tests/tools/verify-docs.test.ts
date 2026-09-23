// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import {
    MANIFEST_REL,
    OFFLINE_RULES,
    isSuppressed,
    lineOf,
    semverLess,
    verifyDocs,
    workflowJobs,
    type Problem,
} from '../../scripts/verify-docs.js';

// v1.3.0 — the documentation verifier. The helpers are unit-tested; the
// verifier itself runs twice: once against the real tree (the same run the
// gate's `verify:docs` step performs — zero errors is the release
// condition) and once against a sandbox copy that was corrupted on purpose,
// to prove the rules fire.

const ROOT = resolve(import.meta.dirname, '..', '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-output', '.audit', 'samples-output']);

describe('verify-docs — helpers', () => {
    it('computes 1-based line numbers from offsets', () => {
        expect(lineOf('a\nb\nc', 0)).toBe(1);
        expect(lineOf('a\nb\nc', 2)).toBe(2);
        expect(lineOf('a\nb\nc', 4)).toBe(3);
    });

    it('honours an allow marker on the line or the line above, for that rule only', () => {
        const lines = ['<!-- verify-docs:allow stale-token -->', '11 lint rules', 'x', 'y <!-- verify-docs:allow count-tokens -->'];
        expect(isSuppressed(lines, 2, 'stale-token')).toBe(true);
        expect(isSuppressed(lines, 2, 'count-tokens')).toBe(false);
        expect(isSuppressed(lines, 4, 'count-tokens')).toBe(true);
        expect(isSuppressed(lines, 3, 'stale-token')).toBe(false);
    });

    it('orders plain semver triples', () => {
        expect(semverLess('1.2.0', '1.3.0')).toBe(true);
        expect(semverLess('1.3.0', '1.2.9')).toBe(false);
        expect(semverLess('1.3.0', '1.3.0')).toBe(false);
        expect(semverLess('1.10.0', '1.9.0')).toBe(false);
    });

    it('reads job ids, display names and matrix values from workflows', () => {
        const ci = 'name: CI\non: push\njobs:\n  ci:\n    name: ci\n    strategy:\n      matrix:\n        node-version: [22, 24]\n    steps: []\n  os:\n    runs-on: ${{ matrix.os }}\n    strategy:\n      matrix:\n        os: [windows-latest, macos-latest]\n';
        const { jobs, matrixValues } = workflowJobs([ci, 'jobs:\n  sample-regression:\n    steps: []\n']);
        expect([...jobs].sort()).toEqual(['ci', 'os', 'sample-regression']);
        expect([...matrixValues.get('ci')!]).toEqual(['22', '24']);
        expect([...matrixValues.get('os')!]).toEqual(['windows-latest', 'macos-latest']);
    });
});

describe('verify-docs — the real tree', () => {
    it('declares the rule list the report prints', () => {
        for (const rule of ['registry-parity', 'lint-rule-parity', 'error-code-parity', 'sample-index-parity', 'engine-version-token', 'peer-pin-parity', 'changelog-ladder', 'agent-config-parity', 'prose-language']) {
            expect(OFFLINE_RULES).toContain(rule);
        }
        expect(new Set(OFFLINE_RULES).size).toBe(OFFLINE_RULES.length);
        expect(OFFLINE_RULES).toHaveLength(27);
        expect(MANIFEST_REL).toBe('docs/assets/ecosystem.json');
    });

    it('passes every offline rule (the gate condition)', async () => {
        const { problems, files } = await verifyDocs(ROOT);
        const errors = problems.filter((p) => p.severity === 'error').map((p) => `${p.file}:${p.line} [${p.rule}] ${p.message}`);
        expect(files).toBeGreaterThan(10);
        expect(errors).toEqual([]);
    }, 60_000);
});

describe('verify-docs — a corrupted sandbox', () => {
    let sandbox = '';
    let problems: Problem[] = [];

    beforeAll(async () => {
        sandbox = mkdtempSync(join(tmpdir(), 'pdfnative-react-verify-docs-'));
        cpSync(ROOT, sandbox, {
            recursive: true,
            filter: (src) => !SKIP.has(basename(src)),
        });
        const edit = (rel: string, fn: (text: string) => string): void => {
            const p = join(sandbox, rel);
            writeFileSync(p, fn(readFileSync(p, 'utf8')));
        };
        edit(MANIFEST_REL, (text) => {
            const manifest = JSON.parse(text) as {
                derived: Record<string, unknown>;
                declared: Record<string, unknown>;
                packages: Record<string, { version: string }>;
            };
            manifest.derived['lintRules'] = 99;
            manifest.derived['typoKey'] = 1;
            manifest.declared['pdfaSamples'] = 1;
            manifest.packages['pdfnative-react'].version = '9.9.9';
            return JSON.stringify(manifest, null, 2);
        });
        edit('README.md', (text) => `${text}\n\nStale: pdfnative-react v0.0.1 has 11 lint rules and \`<Grid>\` with \`E_TIMEOUT\` and \`L_NOPE\`; peer pdfnative \`^1.7.0\`. A 3-sample baseline over 4 corpus files.\n\nBroken anchors: [same](#no-such-heading), [cross](docs/KNOWLEDGE_BASE.md#nope-either).\n\n[allowed](#also-missing) <!-- verify-docs:allow anchor-parity -->\n\nPlanned: \`<Flex>\` <!-- verify-docs:allow registry-parity -->\n\n[gone](docs/NOT_THERE.md)\n`);
        // A documented code the source never carries, and a code with its row removed.
        edit('docs/AGENT_CONTRACT.md', (text) => text
            .replace(/^\| `E_POLICY` \|.*\n/m, '')
            .replace(/^(\| `E_INPUT` \|.*\n)/m, '$1| `E_INVENTED` | never |\n'));
        // A lint rule moved to the wrong section, and one row removed.
        edit('docs/LINTING.md', (text) => text.replace(/^\| `L_IMAGE_ALT` \|.*\n/m, '').replace(/^\| `L_CHART_ALT` \|/m, '| `L_CHART_ALT` |'));
        // A rung of the compare-link ladder goes missing.
        edit('CHANGELOG.md', (text) => text.replace(/^\[1\.2\.0\]:.*\r?\n/m, ''));
        // A second runtime dependency, and a dev pin that drifts from the peer.
        edit('package.json', (text) => text.replace('"react-reconciler":', '"left-pad": "^1.3.0",\n    "react-reconciler":').replace(/"devDependencies": \{([\s\S]*?)"pdfnative": "[^"]+"/, '"devDependencies": {$1"pdfnative": "^1.7.0"'));
        // A sample nobody indexes.
        writeFileSync(join(sandbox, 'samples', 'text', 'orphan.tsx'), 'export {};\n');
        // A governance source that does not exist.
        edit('.github/ai-governance.json', (text) => text.replace('"ROADMAP.md"', '"ROADMAP_GONE.md"'));
        // The guard loses its PowerShell matcher.
        edit('.claude/settings.json', (text) => text.replace('"matcher": "PowerShell"', '"matcher": "Pwsh"'));
        // A rule edited by hand.
        edit('.claude/rules/testing.md', (text) => `${text}\n- Edited by hand.\n`);
        problems = (await verifyDocs(sandbox)).problems;
    }, 120_000);

    afterAll(() => {
        if (sandbox) rmSync(sandbox, { recursive: true, force: true });
    });

    const messages = (rule: string): string[] => problems.filter((p) => p.rule === rule && p.severity === 'error').map((p) => `${p.file}:${p.line} ${p.message}`);

    it('fails derived-counts and manifest-shape on the corrupted manifest and the second dependency', () => {
        expect(messages('derived-counts')).toEqual(expect.arrayContaining([expect.stringContaining('derived.lintRules says 99'), expect.stringContaining('declared.pdfaSamples says 1')]));
        expect(messages('manifest-shape')).toEqual(expect.arrayContaining([
            expect.stringContaining('derived.typoKey'),
            expect.stringContaining('package.json says'),
            expect.stringContaining('left-pad'),
            expect.stringMatching(/src\/version\.ts:1 says \d+\.\d+\.\d+ but the manifest says 9\.9\.9/),
        ]));
    });

    it('fails stale-token, version-token, count-tokens and engine-version-token on the appended README line', () => {
        expect(messages('stale-token')).toEqual(expect.arrayContaining([expect.stringMatching(/README\.md:\d+ "11 lint rules"/)]));
        expect(messages('version-token')).toEqual(expect.arrayContaining([expect.stringContaining('pdfnative-react v0.0.1')]));
        expect(messages('count-tokens')).toEqual(expect.arrayContaining([
            expect.stringContaining('"3-sample baseline"'),
            expect.stringContaining('"4 corpus files"'),
        ]));
        expect(messages('engine-version-token')).toEqual(expect.arrayContaining([expect.stringContaining('^1.7.0')]));
    });

    it('fails registry-parity on an invented component and honours the allow marker', () => {
        const found = messages('registry-parity');
        expect(found).toEqual(expect.arrayContaining([expect.stringMatching(/README\.md:\d+ `<Grid>` reads like a component/)]));
        expect(found.some((m) => m.includes('<Flex>'))).toBe(false);
    });

    it('fails lint-rule-parity on a missing row, a wrong section and an invented code', () => {
        expect(messages('lint-rule-parity')).toEqual(expect.arrayContaining([
            expect.stringContaining('has no row for `L_IMAGE_ALT`'),
            expect.stringMatching(/README\.md:\d+ `L_NOPE` is not a rule of LINT_RULES/),
        ]));
    });

    it('fails error-code-parity in both directions', () => {
        expect(messages('error-code-parity')).toEqual(expect.arrayContaining([
            expect.stringContaining('§6 has no row for E_POLICY'),
            expect.stringMatching(/AGENT_CONTRACT\.md:\d+ §6 documents `E_INVENTED`/),
            expect.stringMatching(/README\.md:\d+ `E_TIMEOUT` is not a code of ErrorCode/),
        ]));
    });

    it('fails sample-index-parity on the orphan sample and peer-pin-parity on the drifted dev pin', () => {
        expect(messages('sample-index-parity')).toEqual(expect.arrayContaining([
            expect.stringContaining('does not link samples/text/orphan.tsx'),
            expect.stringContaining('does not list samples/text/orphan.tsx'),
        ]));
        expect(messages('peer-pin-parity')).toEqual(expect.arrayContaining([expect.stringContaining('devDependencies.pdfnative is "^1.7.0"')]));
    });

    it('fails changelog-ladder on the missing rung', () => {
        expect(messages('changelog-ladder')).toEqual(expect.arrayContaining([expect.stringContaining('heading [1.2.0] has no link definition')]));
    });

    it('fails internal-links and anchor-parity, and honours the allow marker', () => {
        expect(messages('internal-links')).toEqual(expect.arrayContaining([expect.stringMatching(/README\.md:\d+ "docs\/NOT_THERE\.md" does not resolve/)]));
        const found = messages('anchor-parity');
        expect(found).toEqual(expect.arrayContaining([
            expect.stringMatching(/README\.md:\d+ "#no-such-heading" is not a heading anchor of README\.md/),
            expect.stringMatching(/README\.md:\d+ "#nope-either" is not a heading anchor of docs\/KNOWLEDGE_BASE\.md/),
        ]));
        expect(found.some((m) => m.includes('#also-missing'))).toBe(false);
    });

    it('fails governance-sources, agent-config-parity and claude-rules-sync on the agent layer', () => {
        expect(messages('governance-sources')).toEqual(expect.arrayContaining([expect.stringContaining('"ROADMAP_GONE.md", which does not exist')]));
        expect(messages('agent-config-parity')).toEqual(expect.arrayContaining([expect.stringContaining('no PowerShell matcher')]));
        expect(messages('claude-rules-sync')).toEqual(expect.arrayContaining([expect.stringMatching(/\.claude\/rules\/testing\.md:1 differs from its instruction file/)]));
    });

    it('never runs eol-lf outside a git checkout', () => {
        expect(problems.filter((p) => p.rule === 'eol-lf')).toEqual([]);
    });
});
