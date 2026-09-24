import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffClaudeRules, main, readInstructionSources, readRuleFiles, writeClaudeRules } from '../../scripts/build-claude-rules.js';
import { bannerFor } from '../../scripts/lib/agent-config.js';

// v1.7.0 — the .claude/rules/ generator over a sandbox tree: generate,
// --check, orphan removal and the refusal of an unscoped source.

const INSTRUCTION = '---\ndescription: "Command rules"\napplyTo: "src/commands/**"\n---\n\n# Commands\n\n- One file per command.\n';

function sandbox(): string {
    const root = mkdtempSync(join(tmpdir(), 'pdfnative-mcp-rules-'));
    mkdirSync(join(root, '.github', 'instructions'), { recursive: true });
    writeFileSync(join(root, '.github', 'instructions', 'commands.instructions.md'), INSTRUCTION);
    return root;
}

const roots: string[] = [];
afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('build-claude-rules', () => {
    it('reads sources and rules, and reports a missing rule before generation', () => {
        const root = sandbox();
        roots.push(root);
        expect(Object.keys(readInstructionSources(root))).toEqual(['commands.instructions.md']);
        expect(readRuleFiles(root)).toEqual({});
        expect(diffClaudeRules(root).missing).toEqual(['commands.md']);
    });

    it('generates scoped rules with the banner, then --check is clean', () => {
        const root = sandbox();
        roots.push(root);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(main(['--check'], root)).toBe(1);
        expect(main([], root)).toBe(0);
        const rule = readFileSync(join(root, '.claude', 'rules', 'commands.md'), 'utf8');
        expect(rule.startsWith('---\npaths:\n  - "src/commands/**"\n---\n')).toBe(true);
        expect(rule).toContain(bannerFor('commands.instructions.md'));
        expect(main(['--check'], root)).toBe(0);
        expect(main(['--check', '--json'], root)).toBe(0);
    });

    it('removes an orphan rule and rewrites a hand-edited one', () => {
        const root = sandbox();
        roots.push(root);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(writeClaudeRules(root)).toBe(1);
        writeFileSync(join(root, '.claude', 'rules', 'orphan.md'), '---\npaths:\n  - "x"\n---\nstray\n');
        writeFileSync(join(root, '.claude', 'rules', 'commands.md'), 'edited by hand\n');
        expect(main(['--check'], root)).toBe(1);
        expect(main([], root)).toBe(0);
        expect(existsSync(join(root, '.claude', 'rules', 'orphan.md'))).toBe(false);
        expect(readFileSync(join(root, '.claude', 'rules', 'commands.md'), 'utf8')).toContain('# Commands');
    });

    it('refuses a source without applyTo and names it', () => {
        const root = sandbox();
        roots.push(root);
        writeFileSync(join(root, '.github', 'instructions', 'bad.instructions.md'), '---\ndescription: x\n---\nbody\n');
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        expect(main([], root)).toBe(1);
        expect(error.mock.calls.flat().join('\n')).toContain('bad.instructions.md');
        expect(main(['--json'], root)).toBe(1);
    });
});
