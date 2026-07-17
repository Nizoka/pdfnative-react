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
