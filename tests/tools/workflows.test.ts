// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Workflow, supply-chain and contributor invariants ─────────────────
//
// None of this is visible to the type checker or to the test suite proper:
// a floating action tag, a checkout that keeps the job token, a release job
// that quietly skips veraPDF, an npm client that drifts between two publishes.
// Each is locked here as a plain-text assertion on the files that carry it.
// Ported from pdfnative-mcp's tests/tools/workflows.test.ts (1.7.0, itself from
// pdfnative-cli 1.5.0 and pdfnative 1.8.0), including the `os` matrix job.

const ROOT = process.cwd();
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const workflowFiles = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml')).sort();
// Every tracked text blob is LF (verify:docs rule eol-lf), but a working copy
// may still be CRLF on Windows; normalise so the regexes below see one line ending.
const readWorkflow = (f: string): string => readFileSync(join(WORKFLOWS, f), 'utf8').replace(/\r\n/g, '\n');
const readText = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
/** Escape every regular-expression metacharacter, backslash included, of a literal. */
const escapeRegExp = (s: string): string => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const COMPOSITE_ACTIONS = ['.github/actions/setup-verapdf/action.yml'];

const HARDEN_RUNNER = 'step-security/harden-runner@';

/** Every `- name:`/`- uses:` step block of every job, in order, keyed by job id. */
function jobSteps(text: string): Map<string, string[]> {
    const jobs = new Map<string, string[]>();
    const jobsAt = text.search(/^jobs:\s*$/m);
    if (jobsAt < 0) return jobs;
    let job: string | null = null;
    let steps: string[] | null = null;
    for (const line of text.slice(jobsAt).split('\n').slice(1)) {
        const jobHead = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
        if (jobHead) { job = jobHead[1]; steps = null; continue; }
        if (/^    steps:\s*$/.test(line) && job) { steps = []; jobs.set(job, steps); continue; }
        if (steps === null) continue;
        if (/^      - /.test(line)) steps.push(line);
        else if (/^ {8,}\S/.test(line) && steps.length > 0) steps[steps.length - 1] += `\n${line}`;
    }
    return jobs;
}

// ── Actions: pinned, hardened, credential-free ───────────────────────

describe('every workflow and composite action', () => {
    const allFiles = [
        ...workflowFiles.map((f) => ({ label: f, text: readWorkflow(f) })),
        ...COMPOSITE_ACTIONS.map((p) => ({ label: p, text: readText(...p.split('/')) })),
    ];

    it('is the expected set of workflows', () => {
        expect(workflowFiles).toEqual([
            'audit.yml', 'ci.yml', 'codeql.yml', 'dependency-review.yml', 'docs.yml',
            'publish.yml', 'sample-regression.yml', 'scorecard.yml', 'verapdf.yml',
        ]);
    });

    it('pins every action to a 40-hex commit SHA with a version comment', () => {
        for (const { label, text } of allFiles) {
            const uses = [...text.matchAll(/^\s*(?:- )?uses:\s*(\S+)[^\n]*$/gm)];
            expect(uses.length, `${label} declares no action`).toBeGreaterThan(0);
            for (const m of uses) {
                const ref = m[1];
                if (ref.startsWith('./')) continue; // local composite action
                expect(ref, `${label}: ${ref}`).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
                expect(m[0], `${label}: ${ref} lacks a "# vX.Y.Z" comment`).toMatch(/#\s*v\d+\.\d+\.\d+\s*$/);
            }
        }
    });

    it('pins each action to ONE SHA across the tree (no version drift between workflows)', () => {
        const pins = new Map<string, Set<string>>();
        for (const { text } of allFiles) {
            for (const m of text.matchAll(/uses:\s*([^@\s]+)@([0-9a-f]{40})/g)) {
                // github/codeql-action/{init,autobuild,analyze,upload-sarif} share one release.
                const action = m[1].startsWith('github/codeql-action/') ? 'github/codeql-action' : m[1];
                const set = pins.get(action) ?? new Set<string>();
                set.add(m[2]);
                pins.set(action, set);
            }
        }
        for (const [action, shas] of pins) expect([...shas], action).toHaveLength(1);
    });

    it('every actions/checkout step disables persist-credentials', () => {
        for (const { label, text } of allFiles) {
            const re = /uses: actions\/checkout@[^\n]*\n((?:[ \t]+[^\n]*\n)*)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const block = m[1].split('\n').filter((l) => l.trim() !== '' && !/^\s+- /.test(l));
                expect(block.some((l) => /persist-credentials:\s*false/.test(l)), `${label}: checkout keeps credentials`).toBe(true);
            }
        }
    });
});

describe('every workflow job', () => {
    it('starts with harden-runner in audit mode', () => {
        for (const f of workflowFiles) {
            const jobs = jobSteps(readWorkflow(f));
            expect(jobs.size, `${f}: no job with steps`).toBeGreaterThan(0);
            for (const [job, steps] of jobs) {
                expect(steps[0], `${f} › ${job}: first step`).toContain(HARDEN_RUNNER);
                expect(steps[0], `${f} › ${job}: egress policy`).toMatch(/egress-policy:\s*audit/);
            }
        }
    });

    it('installs dependencies with --ignore-scripts', () => {
        for (const f of workflowFiles) {
            for (const m of readWorkflow(f).matchAll(/run: npm ci\b[^\n]*/g)) {
                expect(m[0], `${f}`).toContain('npm ci --ignore-scripts');
            }
        }
    });

    it('declares permissions, a timeout and (except publish) a cancelling concurrency group', () => {
        for (const f of workflowFiles) {
            const text = readWorkflow(f);
            expect(text, `${f}: permissions`).toMatch(/^permissions:/m);
            expect(text, `${f}: timeout`).toMatch(/timeout-minutes:\s*\d+/);
            if (f === 'publish.yml') continue;
            if (['audit.yml', 'dependency-review.yml'].includes(f)) continue; // single short job, no cancel needed
            expect(text, `${f}: concurrency`).toMatch(/concurrency:\s*\n\s*group:[^\n]+\n\s*cancel-in-progress:\s*true/);
        }
    });
});

// ── The gate is the only definition of green ─────────────────────────

describe('ci.yml', () => {
    const ci = readWorkflow('ci.yml');

    it('keeps the job id and matrix the ruleset requires (ci (22), ci (24))', () => {
        expect(ci).toMatch(/^  ci:\s*$/m);
        expect(ci).toMatch(/node-version:\s*\[22, 24\]/);
        const ruleset = JSON.parse(readText('.github', 'rulesets', 'main.json')) as {
            rules: Array<{ type: string; parameters?: { required_status_checks?: Array<{ context: string }> } }>;
        };
        const contexts = ruleset.rules.find((r) => r.type === 'required_status_checks')?.parameters?.required_status_checks?.map((c) => c.context) ?? [];
        expect(contexts).toEqual(['ci (22)', 'ci (24)', 'os (windows-latest)', 'os (macos-latest)', 'sample-regression']);
    });

    it('runs the gate with --require-all and audits outside it', () => {
        expect(ci).toMatch(/run: npx tsx scripts\/gate\.ts --ci --require-all/);
        expect(ci).toMatch(/run: npm audit --audit-level=high/);
        expect(ci).toMatch(/if: failure\(\)[\s\S]*upload-artifact[\s\S]*test-output\/\.gate\//);
    });

    it('lists no gate step by hand', () => {
        // The `ci` job; the `os` job is held to the same rule in the next describe.
        const gated = (jobSteps(ci).get('ci') ?? []).join('\n');
        expect(gated).toContain('scripts/gate.ts');
        for (const step of ['typecheck:all', 'test:coverage', 'validate:pdfa', 'validate:pdfx', 'verify:samples', 'verify:docs', 'npm run build', 'npm run lint', 'npx esbuild', 'npx --yes esbuild']) {
            expect(gated, step).not.toMatch(new RegExp(`run: (npm run )?${escapeRegExp(step)}\\s*$`, 'm'));
            expect(gated, step).not.toContain(`run: ${step}`);
        }
    });
});

describe('ci.yml os matrix job (Windows and macOS)', () => {
    const ci = readWorkflow('ci.yml');
    const steps = jobSteps(ci).get('os') ?? [];

    it('runs the same gate on windows-latest and macos-latest from the pinned Node line, as required checks', () => {
        expect(ci).toMatch(/^  os:\s*\n\s*runs-on:\s*\$\{\{ matrix\.os \}\}/m);
        expect(ci).toMatch(/os:\s*\[windows-latest, macos-latest\]/);
        expect(steps.some((s) => /node-version-file:\s*\.nvmrc/.test(s)), 'setup-node reads .nvmrc').toBe(true);
        const index = (needle: string): number => steps.findIndex((s) => s.includes(needle));
        expect(index('run: npm ci --ignore-scripts')).toBeGreaterThanOrEqual(0);
        expect(index('run: npx tsx scripts/gate.ts --ci --require-all')).toBeGreaterThan(index('run: npm ci --ignore-scripts'));
        expect(steps.some((s) => /if: failure\(\)[\s\S]*upload-artifact[\s\S]*test-output\/\.gate\//.test(s)), 'gate logs uploaded on failure').toBe(true);
        expect(steps.join('\n')).not.toMatch(/run: npm (test|run build)\s*$/m); // the gate, never a hand-written subset
        const ruleset = readText('.github', 'rulesets', 'main.json');
        expect(ruleset).toContain('"os (windows-latest)"');
        expect(ruleset).toContain('"os (macos-latest)"');
    });

    it('skips harden-runner on macOS only (the action supports Linux, and Windows in audit mode) and says so', () => {
        expect(steps[0]).toContain(HARDEN_RUNNER);
        expect(steps[0]).toMatch(/if: runner\.os != 'macOS'/);
        expect(ci).toMatch(/harden-runner supports Windows runners in audit mode only/);
        expect(ci).toMatch(/does not support\s+# macOS at all/);
    });
});

describe('publish.yml', () => {
    const publish = readWorkflow('publish.yml');
    const jobs = jobSteps(publish);

    it('mints an OIDC token and never reads an NPM_TOKEN secret', () => {
        expect(publish).toMatch(/^\s*id-token:\s*write/m);
        expect(publish).not.toMatch(/secrets\.NPM_TOKEN/);
    });

    it('publishes from the npm-publish environment, one release at a time', () => {
        expect(publish).toMatch(/^\s*environment:\s*npm-publish\s*$/m);
        expect(publish).toMatch(/concurrency:\s*\n\s*group:\s*publish\s*\n\s*cancel-in-progress:\s*false/);
    });

    it('pins the npm client to one exact 11.x release, at least 11.5.1, before publishing', () => {
        const pins = [...publish.matchAll(/npm install -g npm@(\S+)/g)].map((m) => m[1]);
        expect(pins).toHaveLength(1);
        expect(pins[0]).toMatch(/^\d+\.\d+\.\d+$/);
        const [major, minor, patch] = pins[0].split('.').map(Number);
        expect(major === 11 && (minor > 5 || (minor === 5 && patch >= 1))).toBe(true);
        expect(publish).toContain(`test "$(npm --version)" = "${pins[0]}"`);
        expect(publish.indexOf('npm install -g npm@')).toBeLessThan(publish.indexOf('run: npm publish'));
    });

    it('builds on the .nvmrc Node line and publishes with provenance', () => {
        expect(publish).toMatch(/node-version-file:\s*\.nvmrc/);
        expect(publish).not.toMatch(/node-version:\s*'>=/);
        expect(publish).toMatch(/run: npm publish --provenance --access public\s*$/m);
        expect(publish).toMatch(/run: npm pack --dry-run/);
    });

    it('verifies the tag against package.json', () => {
        expect(publish).toMatch(/does not match package\.json version/);
    });

    it('runs the publish gate with --require-all after veraPDF, then the consumer smoke test, and lists no gate step by hand', () => {
        const steps = jobs.get('publish') ?? [];
        const index = (needle: string | RegExp): number => steps.findIndex((s) => (typeof needle === 'string' ? s.includes(needle) : needle.test(s)));
        const verapdf = index('./.github/actions/setup-verapdf');
        const gate = index('run: npx tsx scripts/gate.ts --publish --require-all');
        const pack = index('run: npm pack --dry-run');
        const smoke = index('Consumer resolution smoke test');
        const pub = index(/run: npm publish/);
        expect([verapdf, gate, pack, smoke, pub].every((i) => i >= 0)).toBe(true);
        expect(verapdf).toBeLessThan(gate);
        expect(gate).toBeLessThan(pack);
        expect(pack).toBeLessThan(smoke);
        expect(smoke).toBeLessThan(pub);
        for (const hand of ['npm run validate:pdfa', 'npm run corpus:pdfa', 'npm run verify:samples', 'npm run test:coverage', 'npm run typecheck:all', 'npm run lint']) {
            expect(publish, hand).not.toContain(`run: ${hand}`);
        }
    });

    it('has an attest job with exactly three permissions that attests the tarball and the SBOM', () => {
        const attest = /^  attest:\s*\n([\s\S]*?)(?=^  [a-z-]+:\s*$|(?![\s\S]))/m.exec(publish);
        expect(attest).not.toBeNull();
        const body = attest![1];
        expect(body).toMatch(/needs:\s*publish/);
        const perms = /permissions:\s*\n((?:\s{6}[a-z-]+:\s*\w+\s*\n)+)/.exec(body);
        expect(perms).not.toBeNull();
        const granted = perms![1].trim().split('\n').map((l) => l.trim()).sort();
        expect(granted).toEqual(['attestations: write', 'contents: write', 'id-token: write']);
        expect(body).toMatch(/npm sbom --sbom-format cyclonedx --omit dev --package-lock-only/);
        expect(body).not.toMatch(/cyclonedx-npm/);
        expect(body).toMatch(/uses: actions\/attest-build-provenance@[0-9a-f]{40}/);
        expect(body).toMatch(/pdfnative-react-\$\{VERSION\}\.tgz/);
        expect(body).toMatch(/gh release view "v\$\{VERSION\}"[\s\S]*gh release upload "v\$\{VERSION\}"[^\n]*--clobber/);
        expect(body).not.toMatch(/gh release create/);
    });

    it('lists the endpoints for the future block policy', () => {
        for (const host of ['api.github.com', 'registry.npmjs.org', 'software.verapdf.org', 'api.adoptium.net', 'fulcio.sigstore.dev', 'rekor.sigstore.dev', 'tuf-repo-cdn.sigstore.dev']) {
            expect(publish).toContain(host);
        }
    });
});

describe('package.json publish settings', () => {
    const pkg = JSON.parse(readText('package.json')) as {
        publishConfig?: Record<string, unknown>;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        peerDependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        packageManager?: string;
    };

    it('declares public access with provenance', () => {
        expect(pkg.publishConfig).toEqual({ access: 'public', provenance: true });
    });

    it('keeps exactly one runtime dependency, with the engine and React as peers', () => {
        expect(Object.keys(pkg.dependencies)).toEqual(['react-reconciler']);
        expect(Object.keys(pkg.peerDependencies).sort()).toEqual(['pdfnative', 'react']);
        // The engine we test against is the engine we declare.
        expect(pkg.devDependencies['pdfnative']).toBe(pkg.peerDependencies['pdfnative']);
    });

    it('does not rely on lifecycle scripts that .npmrc disables', () => {
        // ignore-scripts=true: `prepare` would never run, so the build is a gate step.
        expect(pkg.scripts['prepare']).toBeUndefined();
        expect(pkg.scripts['prepublishOnly']).toBe('npm run build');
    });

    it('pins the package manager and exposes the opt-in git hooks', () => {
        expect(pkg.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);
        expect(pkg.scripts['hooks:install']).toBe('node scripts/install-git-hooks.mjs');
        expect(pkg.scripts['hooks:uninstall']).toBe('node scripts/install-git-hooks.mjs --uninstall');
        expect(existsSync(join(ROOT, '.githooks', 'pre-commit'))).toBe(true);
        expect(existsSync(join(ROOT, '.githooks', 'pre-push'))).toBe(true);
    });
});

// ── veraPDF: pinned and checksummed ──────────────────────────────────

describe('setup-verapdf composite action', () => {
    const action = readText('.github', 'actions', 'setup-verapdf', 'action.yml');

    it('checks the installer against a committed SHA-256 before installing it', () => {
        const version = /default:\s*'(\d+\.\d+\.\d+)'/.exec(action)?.[1];
        expect(version).toBeDefined();
        expect(action).toMatch(/sha256sum -c/);
        const checksum = readText('.github', 'checksums', `verapdf-greenfield-${version}-installer.zip.sha256`);
        expect(checksum).toMatch(new RegExp(`^[0-9a-f]{64}  verapdf-greenfield-${escapeRegExp(version!)}-installer\\.zip\\n$`));
    });

    it('is what verapdf.yml and publish.yml use — the URL and SHA live in one place', () => {
        expect(readWorkflow('verapdf.yml')).toContain('uses: ./.github/actions/setup-verapdf');
        expect(readWorkflow('publish.yml')).toContain('uses: ./.github/actions/setup-verapdf');
        for (const f of ['verapdf.yml', 'publish.yml']) expect(readWorkflow(f), f).not.toMatch(/software\.verapdf\.org\/rel\/[\d.]+\/verapdf/);
    });

    it('CONTRIBUTING documents the same veraPDF version', () => {
        const version = /default:\s*'(\d+\.\d+\.\d+)'/.exec(action)?.[1];
        expect(readText('CONTRIBUTING.md')).toContain(`verapdf-greenfield-${version}`);
    });
});

// ── Sample regression: a required check with no paths filter ─────────

describe('sample-regression.yml', () => {
    const wf = readWorkflow('sample-regression.yml');

    it('runs on every push and pull request, with no paths filter, deciding the scope inside', () => {
        expect(wf).toMatch(/^on:\s*\n\s*push:\s*\n\s*branches:[^\n]*\n\s*pull_request:/m);
        expect(wf).not.toMatch(/^\s*paths(-ignore)?:/m);
        expect(wf).toMatch(/package-lock\\\.json/);
        expect(wf).toMatch(/samples\//);
    });

    it('builds the package before generating and verifying', () => {
        const steps = jobSteps(wf).get('sample-regression') ?? [];
        const index = (needle: string): number => steps.findIndex((s) => s.includes(needle));
        expect(index('run: npm run build')).toBeGreaterThan(index('run: npm ci --ignore-scripts'));
        expect(index('run: npm run test:generate')).toBeGreaterThan(index('run: npm run build'));
        expect(index('run: npx tsx scripts/verify-samples.ts')).toBeGreaterThan(index('run: npm run test:generate'));
    });
});

// ── Dependency hygiene ───────────────────────────────────────────────

describe('dependency review and audit', () => {
    it('reviews every pull request for high vulnerabilities and licences', () => {
        const review = readWorkflow('dependency-review.yml');
        expect(review).toMatch(/^on:\s*\n\s*pull_request:/m);
        expect(review).toMatch(/uses: actions\/dependency-review-action@[0-9a-f]{40}/);
        expect(review).toMatch(/fail-on-severity:\s*high/);
        expect(review).toMatch(/allow-licenses:\s*MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC0-1.0, Unlicense/);
        expect(review).toMatch(/comment-summary-in-pr:\s*on-failure/);
    });

    it('audits the lockfile weekly', () => {
        const audit = readWorkflow('audit.yml');
        expect(audit).toMatch(/schedule:\s*\n\s*- cron:/);
        expect(audit).toMatch(/workflow_dispatch:/);
        expect(audit).toMatch(/run: npm ci --ignore-scripts/);
        expect(audit).toMatch(/run: npm audit --audit-level=high/);
    });

    it('.npmrc, .nvmrc and .node-version carry the contributor defaults', () => {
        expect(readText('.npmrc')).toBe('ignore-scripts=true\nfund=false\naudit-level=high\n');
        expect(readText('.node-version')).toBe('22\n');
        expect(readText('.nvmrc')).toBe('22\n');
    });

    it('protects release tags with a ruleset the maintainer creates tags under', () => {
        const tags = JSON.parse(readText('.github', 'rulesets', 'tags.json')) as {
            target: string; conditions: { ref_name: { include: string[] } }; rules: Array<{ type: string }>;
        };
        expect(tags.target).toBe('tag');
        expect(tags.conditions.ref_name.include).toEqual(['refs/tags/v*']);
        expect(tags.rules.map((r) => r.type).sort()).toEqual(['deletion', 'non_fast_forward', 'update']);
    });
});

// ── Contributor checklist parity ─────────────────────────────────────

describe('pull request template', () => {
    it('lists the gate and the same items as CONTRIBUTING.md, word for word', () => {
        const template = readText('.github', 'pull_request_template.md');
        const contributing = readText('CONTRIBUTING.md');
        const section = /## Pull Request Checklist\s*\n([\s\S]*?)\n## /.exec(contributing);
        expect(section).not.toBeNull();
        const items = section![1].split('\n').filter((l) => l.startsWith('- [ ]'));
        expect(items.length).toBeGreaterThan(5);
        // Links are rewritten to reach CONTRIBUTING.md from .github/; the wording is identical.
        const normalise = (s: string): string => s.replace(/\]\((?:\.\.\/CONTRIBUTING\.md)?#/g, '](#');
        for (const item of items) expect(normalise(template), item.slice(0, 60)).toContain(normalise(item));
        const templateItems = template.split('\n').filter((l) => l.startsWith('- [ ]'));
        expect(templateItems.map(normalise).sort()).toEqual(items.map(normalise).sort());
        expect(template).toMatch(/`npm run gate` passes/);
        for (const mention of ['ROADMAP.md', 'release-notes/vX.Y.Z.md', 'rebaseline', 'AGENT_RULES.md']) {
            expect(template).toContain(mention);
        }
    });
});
