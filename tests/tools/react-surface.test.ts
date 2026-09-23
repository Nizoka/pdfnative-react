// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    blockIds,
    blockKinds,
    changelogCompareLinks,
    changelogHeadings,
    checkChangelogLadder,
    clientComponentNames,
    componentAliases,
    componentNames,
    computeDerived,
    contractErrorRows,
    docSpecFields,
    enginePin,
    errorCodeTokens,
    errorCodes,
    lintCodeTokens,
    lintRuleTable,
    lintingDocRules,
    pinFloor,
    sampleIndexLinks,
    sampleSourceFiles,
    schemaSubjects,
} from '../../scripts/lib/react-surface.js';

// v1.3.0 — the parsers scripts/verify-docs.ts reads the authoring surface
// with. Each is a pure function over text, pinned here on inline fixtures
// and, at the end, on the real tree (the counts the manifest quotes).

const ROOT = resolve(import.meta.dirname, '..', '..');

const REGISTRY = [
    'export const BLOCK_REGISTRY = [',
    "    {",
    "        id: 'heading',",
    "        kinds: ['h1', 'h2', 'h3'],",
    "    },",
    "    { id: 'paragraph', kinds: ['p'] },",
    '] as const satisfies readonly X[];',
    '',
    'export const DOC_SPEC_FIELDS = [',
    "    'title',",
    "    'blocks',",
    '    // 1.3.0',
    "    'pdfx',",
    '] as const satisfies readonly (keyof DocSpec)[];',
    '',
    'export const COMPONENT_REGISTRY = [',
    "    { name: 'Document', tag: 'document', summary: 'x' },",
    "    {",
    "        name: 'Paragraph',",
    "        tag: 'paragraph',",
    "        aliases: ['Text'],",
    "    },",
    '] as const satisfies readonly ComponentDescriptorShape[];',
    '',
    'export const CLIENT_COMPONENT_REGISTRY = [',
    "    { name: 'PDFViewer', summary: 'x' },",
    '] as const satisfies readonly Y[];',
    '',
    'export const LINT_RULES = {',
    '    L_EMPTY_DOCUMENT: {',
    "        severity: 'error',",
    "        description: 'x',",
    '    },',
    '    L_IMAGE_ALT: {',
    "        severity: 'warning',",
    "        description: 'y',",
    '    },',
    '    L_CHART_ALT: {',
    "        severity: 'info',",
    "        description: 'z',",
    '    },',
    '} as const satisfies Record<string, Z>;',
].join('\n');

describe('react-surface: registry parsers', () => {
    it('reads the lint rules with their severity, in order', () => {
        expect([...lintRuleTable(REGISTRY)]).toEqual([['L_EMPTY_DOCUMENT', 'error'], ['L_IMAGE_ALT', 'warning'], ['L_CHART_ALT', 'info']]);
        expect(lintRuleTable('export const OTHER = 1;').size).toBe(0);
    });

    it('reads components, aliases and client components', () => {
        expect(componentNames(REGISTRY)).toEqual(['Document', 'Paragraph']);
        expect(componentAliases(REGISTRY)).toEqual(['Text']);
        expect(clientComponentNames(REGISTRY)).toEqual(['PDFViewer']);
    });

    it('reads block ids, block tags and DocSpec fields', () => {
        expect(blockIds(REGISTRY)).toEqual(['heading', 'paragraph']);
        expect(blockKinds(REGISTRY)).toEqual(['h1', 'h2', 'h3', 'p']);
        expect(docSpecFields(REGISTRY)).toEqual(['title', 'blocks', 'pdfx']);
    });

    it('reads the ErrorCode table and the schema subjects', () => {
        expect(errorCodes("export const ErrorCode = {\n    STRUCTURE: 'E_STRUCTURE',\n    INPUT: 'E_INPUT',\n} as const;\nconst other = 'E_NOPE';")).toEqual(['E_STRUCTURE', 'E_INPUT']);
        expect(errorCodes('nothing')).toEqual([]);
        expect(schemaSubjects("export const SCHEMA_SUBJECTS = [\n    'doc-spec',\n    'list',\n] as const;")).toEqual(['doc-spec', 'list']);
    });

    it('reads the engine pin of a package.json field and its floor', () => {
        const pkg = '{ "peerDependencies": { "pdfnative": "^1.8.0" }, "devDependencies": { "pdfnative": "~1.8.2" } }';
        expect(enginePin(pkg, 'peerDependencies')).toBe('^1.8.0');
        expect(enginePin(pkg, 'devDependencies')).toBe('~1.8.2');
        expect(enginePin(pkg, 'dependencies')).toBeNull();
        expect(enginePin('not json', 'peerDependencies')).toBeNull();
        expect(pinFloor('^1.8.0')).toBe('1.8.0');
        expect(pinFloor('1.8.0')).toBe('1.8.0');
        expect(pinFloor('>=1.8.0 <2')).toBeNull();
        expect(pinFloor(null)).toBeNull();
    });
});

describe('react-surface: documentation parsers', () => {
    it('reads docs/LINTING.md rows by section', () => {
        const doc = '## Rules\n\n### Errors — these clear `ok`\n\n| Code | Rule |\n|---|---|\n| `L_A` | x |\n\n### Warnings\n\n| `L_B` | y |\n\n### Info\n\n| `L_C` | z |\n\n## Options\n\n| `L_D` | not a rule row |\n';
        expect([...lintingDocRules(doc)]).toEqual([['L_A', 'error'], ['L_B', 'warning'], ['L_C', 'info']]);
    });

    it('reads the §6 error table of the agent contract, and nothing outside it', () => {
        const doc = '## 5. Tiers\n\n| `E_NOPE` | not here |\n\n## 6. Errors\n\n| Code | Meaning |\n|---|---|\n| `E_STRUCTURE` | a |\n| `E_INPUT` | b |\n| `E_INPUT` | dup |\n\n## 7. Rendering\n\n| `E_LATER` | no |\n';
        expect(contractErrorRows(doc)).toEqual(['E_STRUCTURE', 'E_INPUT']);
        expect(contractErrorRows('no section')).toEqual([]);
    });

    it('collects backticked E_ and L_ tokens once each', () => {
        expect(errorCodeTokens('`E_INPUT` and `E_INPUT` and `E_ENV`, not E_BARE')).toEqual(['E_INPUT', 'E_ENV']);
        expect(lintCodeTokens('`L_A` `L_B2` `L_A`')).toEqual(['L_A', 'L_B2']);
    });

    it('reads the sample index links, deduplicated, ignoring fragments and non-samples', () => {
        expect(sampleIndexLinks('[a](text/a.tsx) [b](agent/b.ts) [a](text/a.tsx) [doc](../docs/X.md) [x](x.tsx#frag)')).toEqual(['text/a.tsx', 'agent/b.ts']);
    });

    it('reads the changelog ladder and reports a missing rung', () => {
        const changelog = '## [Unreleased]\n\n## [1.3.0] — x\n\n## [1.2.0] — y\n\n[Unreleased]: https://x/compare/v1.3.0...HEAD\n[1.3.0]: https://x/compare/v1.2.0...v1.3.0\n[1.2.0]: https://x/releases/tag/v1.2.0\n';
        expect(changelogHeadings(changelog).map((h) => h.label)).toEqual(['Unreleased', '1.3.0', '1.2.0']);
        expect(changelogCompareLinks(changelog).map((l) => [l.label, l.from, l.to])).toEqual([['Unreleased', 'v1.3.0', 'HEAD'], ['1.3.0', 'v1.2.0', 'v1.3.0'], ['1.2.0', null, 'v1.2.0']]);
        expect(checkChangelogLadder(changelog)).toEqual([]);
        expect(checkChangelogLadder(changelog.replace('[1.2.0]: https://x/releases/tag/v1.2.0\n', ''))).toEqual([expect.objectContaining({ message: expect.stringContaining('[1.2.0] has no link definition') })]);
        expect(checkChangelogLadder(changelog.replace('v1.2.0...v1.3.0', 'v1.1.0...v1.3.0'))).toEqual([expect.objectContaining({ message: expect.stringContaining('must compare v1.2.0...v1.3.0') })]);
        expect(checkChangelogLadder(changelog.replace('v1.3.0...HEAD', 'v1.2.0...HEAD'))).toEqual([expect.objectContaining({ message: expect.stringContaining('[Unreleased] must compare v1.3.0...HEAD') })]);
    });
});

describe('react-surface: the real tree', () => {
    it('reads the registry the manifest is derived from', () => {
        const registry = readFileSync(resolve(ROOT, 'src/registry.ts'), 'utf8');
        expect(componentNames(registry)).toContain('Document');
        expect(componentAliases(registry)).toEqual(['Text', 'Toc']);
        expect(clientComponentNames(registry)).toEqual(['PDFViewer', 'PDFDownloadLink', 'BlobProvider']);
        expect(blockKinds(registry)).toContain('qr');
        expect(docSpecFields(registry).slice(-4)).toEqual(['pdfx', 'outputIntent', 'typography', 'creationDate']);
        expect(lintRuleTable(registry).get('L_PDFX_NO_FONTS')).toBe('error');
    });

    it('computes the derived counts the manifest quotes', () => {
        const derived = computeDerived(ROOT);
        expect(derived.components).toBe(19);
        expect(derived.clientComponents).toBe(3);
        expect(derived.blocks).toBe(14);
        expect(derived.specFields).toBe(18);
        expect(derived.lintRules).toBe(37);
        expect(derived.errorCodes).toBe(6);
        expect(derived.schemaSubjects).toBe(7);
        expect(derived.corpusFiles).toBe(16);
        expect(derived.pdfaSamples).toBe(13);
        expect(derived.pdfxSamples).toBe(3);
        expect(derived.samples).toBe(38);
        expect(derived.sampleFiles).toBe(sampleSourceFiles(ROOT).length);
        expect(derived.testFiles).toBeGreaterThan(40);
    });
});
