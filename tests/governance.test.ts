/**
 * Tests for the AI-governance guardrail: the shipped `scripts/verify-issue.mjs`
 * CLI (exercised as a black box) and the repository's governance artifacts
 * (`.github/ai-governance.json`, `.github/AGENT_RULES.md`, `.github/drafts/`).
 *
 * The CLI is run via `execFileSync` (not imported) so the test needs no module
 * resolution for the `.mjs` guardrail. Paths are resolved from `process.cwd()`
 * to match the repo's other filesystem tests (jsdom breaks `import.meta.url`).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentRulesText, aiGovernancePolicy, validateIssueDraft } from '../src/index.js';

const ROOT = process.cwd();
const CLI = join(ROOT, 'scripts', 'verify-issue.mjs');

/** Run the shipped CLI verifier on a draft and return its exit code (0 = pass). */
async function runCli(draft: string): Promise<number> {
    const dir = await mkdtemp(join(tmpdir(), 'pdfnative-react-verify-'));
    const file = join(dir, 'draft.md');
    await writeFile(file, draft, 'utf8');
    try {
        execFileSync(process.execPath, [CLI, file], { stdio: 'pipe' });
        return 0;
    } catch (err) {
        return (err as { status?: number }).status ?? 1;
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

const GOOD_DRAFT = `# Something broke

## Reproduction
\`\`\`tsx
renderToBytes(<Document><Paragraph>x</Paragraph></Document>);
\`\`\`
Environment: node v20, os windows.
Expected: a valid PDF.
`;

const DEPENDENCY_DRAFT = `# Add a dependency

Please run npm install left-pad to fix this.

\`\`\`
repro here
\`\`\`
Expected + environment + node.
`;

const NO_REPRO_DRAFT = `# No repro provided

Expected behavior described but no fenced code block. environment node.
`;

describe('verify-issue CLI', () => {
    it('passes a well-formed draft', async () => {
        expect(await runCli(GOOD_DRAFT)).toBe(0);
    });

    it('rejects a draft proposing a runtime dependency', async () => {
        expect(await runCli(DEPENDENCY_DRAFT)).toBe(1);
    });

    it('rejects a draft with no reproduction code block', async () => {
        expect(await runCli(NO_REPRO_DRAFT)).toBe(1);
    });

    it('passes (advisory only) when recommended fields are missing', async () => {
        expect(await runCli('# Title\n\n```\nrepro\n```\n')).toBe(0);
    });
});

describe('repo governance artifacts', () => {
    it('.github/ai-governance.json encodes the non-negotiable HITL policy', async () => {
        const raw = await readFile(join(ROOT, '.github', 'ai-governance.json'), 'utf8');
        const contract = JSON.parse(raw) as {
            policy: Record<string, unknown>;
            human_in_the_loop: Record<string, unknown>;
            applies_to: string[];
        };
        expect(contract.policy['automatic_issue_reporting']).toBe(false);
        expect(contract.policy['autonomous_github_writes_allowed']).toBe(false);
        expect(contract.policy['human_in_the_loop_mandatory']).toBe(true);
        expect(contract.policy['runtime_dependencies_allowed']).toBe(false);
        expect(contract.human_in_the_loop['role_of_agent']).toBe('draftsman');
        expect(contract.applies_to).toContain('pdfnative-react');
    });

    it('ships the AGENT_RULES.md protocol and a drafts staging area', async () => {
        const rules = await readFile(join(ROOT, '.github', 'AGENT_RULES.md'), 'utf8');
        expect(rules).toMatch(/draftsman/i);
        expect(rules).toMatch(/human-in-the-loop/i);
        const draftsReadme = await readFile(join(ROOT, '.github', 'drafts', 'README.md'), 'utf8');
        expect(draftsReadme).toMatch(/staging area/i);
    });
});

describe('governance as a runtime capability', () => {
    it('validateIssueDraft agrees with the CLI on a good draft', () => {
        expect(validateIssueDraft(GOOD_DRAFT)).toEqual({ ok: true, errors: [], warnings: [] });
    });

    it('flags a runtime-dependency proposal with E_POLICY', () => {
        const result = validateIssueDraft(DEPENDENCY_DRAFT);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('E_POLICY');
        expect(result.errors[0]).toMatch(/minimal-dependency policy/);
    });

    it('flags a missing reproduction block', () => {
        const result = validateIssueDraft(NO_REPRO_DRAFT);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => /reproduction code block/.test(e))).toBe(true);
    });

    it('surfaces missing recommended fields as warnings only', () => {
        const result = validateIssueDraft('# Title\n\n```\nrepro\n```\n');
        expect(result.ok).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('exposes the policy, matching .github/ai-governance.json', async () => {
        const policy = aiGovernancePolicy();
        const raw = await readFile(join(ROOT, '.github', 'ai-governance.json'), 'utf8');
        const file = JSON.parse(raw) as {
            policy: Record<string, boolean | string[]>;
            human_in_the_loop: Record<string, string>;
            pre_issue_checklist: string[];
            compliance_report: { required_fields: string[] };
            applies_to: string[];
        };

        expect(policy.policy.automaticIssueReporting).toBe(file.policy['automatic_issue_reporting']);
        expect(policy.policy.runtimeDependenciesAllowed).toBe(
            file.policy['runtime_dependencies_allowed'],
        );
        expect(policy.policy.humanInTheLoopMandatory).toBe(
            file.policy['human_in_the_loop_mandatory'],
        );
        expect(policy.policy.autonomousGithubWritesAllowed).toBe(
            file.policy['autonomous_github_writes_allowed'],
        );
        expect(policy.policy.outboundNetworkAllowed).toBe(file.policy['outbound_network_allowed']);
        expect(policy.policy.telemetryAllowed).toBe(file.policy['telemetry_allowed']);
        expect(policy.policy.requiredIssueFields).toEqual(file.policy['required_issue_fields']);
        expect(policy.humanInTheLoop.roleOfAgent).toBe(file.human_in_the_loop['role_of_agent']);
        expect(policy.humanInTheLoop.draftLocation).toBe(file.human_in_the_loop['draft_location']);
        expect(policy.preIssueChecklist).toEqual(file.pre_issue_checklist);
        expect(policy.complianceReportFields).toEqual(file.compliance_report.required_fields);
        expect(policy.appliesTo).toEqual(file.applies_to);
    });

    it('flags a JSON dependencies block, but not an empty one shown in prose', () => {
        const repro = '\n```\nrepro\n```\n';
        expect(validateIssueDraft(`"dependencies": { "left-pad": "^1.0.0" }${repro}`).ok).toBe(
            false,
        );
        expect(validateIssueDraft(`"dependencies":{"a":"1"}${repro}`).ok).toBe(false);
        // An empty block, or the word in prose, is not a proposal.
        expect(validateIssueDraft(`We ship "dependencies": {} — nothing else.${repro}`).ok).toBe(
            true,
        );
        expect(validateIssueDraft(`Our "dependencies" list is empty.${repro}`).ok).toBe(true);
    });

    it('stays linear on input crafted to backtrack (CodeQL js/polynomial-redos)', () => {
        // `validateIssueDraft` is a public export that takes untrusted markdown.
        // The original `"dependencies"\s*:\s*\{[^}]*[\w-]+[^}]*\}` had two
        // unbounded quantifiers around a subset class and went quadratic: 225 ms
        // at 800 hyphens, over two minutes at 2000. Anything near-instant here
        // means the ambiguity is gone; a regression would hang this test.
        const evil = `"dependencies":{${'-'.repeat(50_000)}`;
        const started = performance.now();
        expect(validateIssueDraft(evil).ok).toBe(false); // no repro block
        expect(performance.now() - started).toBeLessThan(1_000);
    });

    it('ships the agent protocol text', () => {
        const text = agentRulesText();
        expect(text).toMatch(/DRAFTSMAN/);
        expect(text).toMatch(/CRITICAL ETHICAL GATE/);
        expect(text).toMatch(/NO new runtime dependency/);
    });
});

/**
 * `scripts/verify-issue.mjs` must stay zero-dependency and runnable with no
 * build step (CI and the black-box tests above invoke it directly), so its
 * pattern tables are necessarily duplicated in `src/governance.ts`. This test
 * is what stops that duplication from drifting: it parses the script's source
 * and compares both tables literally.
 */
describe('verifier ↔ library parity', () => {
    it('uses byte-identical DEPENDENCY_PATTERNS and REQUIRED_FIELDS', async () => {
        const [script, library] = await Promise.all([
            readFile(CLI, 'utf8'),
            readFile(join(ROOT, 'src', 'governance.ts'), 'utf8'),
        ]);

        const table = (source: string, name: string): string => {
            const start = source.indexOf(`const ${name}`);
            expect(start, `${name} not found`).toBeGreaterThan(-1);
            // Anchor on `= [` so a TypeScript type annotation such as
            // `: readonly RegExp[] =` cannot be mistaken for the array literal.
            const open = source.indexOf('= [', start) + 2;
            const close = source.indexOf('];', open);
            expect(close, `${name} literal not closed`).toBeGreaterThan(open);
            return source
                .slice(open + 1, close)
                .split('\n')
                .map((line) => line.trim())
                // Compare the *patterns*, not the prose. Each file explains the
                // duplication in its own terms, and a comment rewrite must not
                // read as a policy divergence.
                .filter((line) => line.length > 0 && !line.startsWith('//'))
                .join('\n');
        };

        expect(table(library, 'DEPENDENCY_PATTERNS')).toBe(table(script, 'DEPENDENCY_PATTERNS'));
        expect(table(library, 'REQUIRED_FIELDS')).toBe(table(script, 'REQUIRED_FIELDS'));
    });
});
