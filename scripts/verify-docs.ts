#!/usr/bin/env tsx
/**
 * pdfnative-react — documentation consistency verifier (ported from pdfnative-mcp 1.7.0 / pdfnative-cli 1.5.0 / pdfnative 1.8.0)
 * ==========================================================================================================================
 * Every version string, component count, lint-rule table, error-code list and
 * sample index quoted in the docs was hand-copied across a dozen files —
 * README, the agent contract, the knowledge base, llms.txt, AGENTS.md, the
 * Copilot instructions, LINTING.md, samples/README.md — and only a grep line
 * in AGENTS.md ("documentation drift gate") checked them, by hand.
 *
 * This script makes `docs/assets/ecosystem.json` the single source of truth
 * for every count and version, derives the counts it CAN derive from the
 * files the package is built from (`scripts/lib/react-surface.ts`), and fails
 * the build when any documentation file disagrees.
 *
 * Usage:
 *   npm run verify:docs                 # offline, hermetic — safe in CI
 *   npx tsx scripts/verify-docs.ts --online   # also compare against the npm registry
 *   npx tsx scripts/verify-docs.ts --json     # machine-readable, for CI annotations
 *   npx tsx scripts/verify-docs.ts --strict   # (--online) docs behind npm is an error
 *
 * (PowerShell swallows a bare `--`, so call the script directly when passing
 * flags.)
 *
 * Exit codes:
 *   0 — every rule passes.
 *   1 — at least one rule failed; each problem is printed as `path:line [rule] message`.
 *
 * The script never writes. It is safe to run against a dirty tree. A line
 * that legitimately quotes a superseded figure (historical prose) opts out
 * with `verify-docs:allow <rule>` on itself or on the line above.
 *
 * `verifyDocs(root)` is exported and covered by tests/tools/verify-docs.test.ts;
 * only `main()` prints and exits.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findNonEnglishProse } from './lib/prose-language.js';
import {
    INSTRUCTIONS_DIR,
    RULES_DIR,
    checkAgentConfigParity,
    checkClaudeRulesBudget,
    checkEol,
    checkNodeVersionPin,
    checkPrTemplateParity,
    checkSkillShape,
    checkTagRuleset,
    type Finding,
} from './lib/agent-config.js';
import { diffClaudeRules, readRuleFiles } from './build-claude-rules.js';
import {
    blockKinds,
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
    walk,
} from './lib/react-surface.js';
import { MODULE_SAMPLES, SAMPLE_PLAN } from './lib/sample-plan.js';
import { markdownAnchors, fragmentLinks } from './lib/markdown-anchors.js';

// ── Types ───────────────────────────────────────────────────────────

export interface Problem {
    readonly file: string;
    readonly line: number;
    readonly rule: string;
    readonly message: string;
    readonly severity: 'error' | 'warn';
}

export interface VerifyOptions {
    /** Also compare the manifest with the npm registry (network). */
    readonly online?: boolean;
    /** Under --online, docs behind npm is an error rather than a warning. */
    readonly strict?: boolean;
}

export interface VerifyResult {
    readonly problems: Problem[];
    readonly rules: readonly string[];
    /** Documentation files scanned. */
    readonly files: number;
    readonly verifiedOn: string | null;
}

interface PackageEntry {
    version: string;
    pinField: 'dependencies' | 'peerDependencies' | null;
    pin: string | null;
}

interface Assertion {
    id: string;
    canonical: string;
    match?: string;
    expect?: number;
    expectFrom?: string;
    forbid?: string;
    requireIn: string[];
}

interface Manifest {
    verifiedOn: string;
    packages: Record<string, PackageEntry>;
    declared: Record<string, unknown>;
    derived: Record<string, unknown>;
    assertions: Assertion[];
}

export const MANIFEST_REL = 'docs/assets/ecosystem.json';
export const SELF_PACKAGE = 'pdfnative-react';

/** Files whose `Verified on YYYY-MM-DD` stamp must equal the manifest's `verifiedOn`. */
export const STAMPED_FILES: readonly string[] = ['llms.txt', 'docs/KNOWLEDGE_BASE.md', 'docs/AGENT_CONTRACT.md'];

/** Every public component must be named, in backticks or as a tag, in each of these. */
export const COMPONENT_DOCS: readonly string[] = ['README.md', 'llms.txt'];

/** Every DocSpec block tag and every top-level DocSpec field must be named in each of these. */
export const SPEC_DOCS: readonly string[] = ['llms.txt', 'docs/AGENT_CONTRACT.md'];

/** Every lint rule code must be named in each of these (docs/LINTING.md is held row by row). */
export const LINT_DOCS: readonly string[] = ['llms.txt'];

export const OFFLINE_RULES = [
    'manifest-shape', // manifest fields are well-formed; the pdfnative pin and the package version agree with package.json; assertions' expectFrom agrees with declared/derived
    'derived-counts', // derived.* equals the source tree (components, blocks, spec fields, lint rules, error codes, schema subjects, tests, samples, corpus)
    'stale-token', // every assertion's counted noun matches its expect
    'canonical-present', // every assertion's canonical sentence appears where requireIn says
    'version-token', // "<package> vX.Y.Z" in prose equals the manifest version
    'count-tokens', // tests / files / samples / rules / coverage / "Current release" tokens equal the manifest
    'registry-parity', // every component of COMPONENT_REGISTRY is named in README and llms.txt; every DocSpec block tag and field in llms.txt and the agent contract; no doc names a component that does not exist
    'lint-rule-parity', // LINT_RULES == the rows of docs/LINTING.md, section by severity; llms.txt names every rule; no doc names an L_* code the registry lacks
    'error-code-parity', // ErrorCode == the §6 table of the agent contract; no doc names an E_* code the source lacks
    'sample-index-parity', // every file under samples/ is linked from samples/README.md and listed in the sample plan; every link resolves
    'engine-version-token', // every "^X.Y.Z" pin quoted next to pdfnative equals the manifest pin
    'peer-pin-parity', // peerDependencies.pdfnative == devDependencies.pdfnative == the manifest pin; src/manifest.ts and src/doctor.ts carry the same floor
    'changelog-ladder', // every CHANGELOG heading has its compare link, each comparing the previous tag with its own
    'claude-md-budget', // CLAUDE.md imports AGENTS.md; both ≤ 120 lines, Copilot file ≤ 16 KiB, no line > 240 chars
    'governance-sources', // ai-governance.json sources/on_demand exist; always-loaded sources < 16 KiB
    'node-pin-parity', // .nvmrc, .node-version, engines.node, the CI floor and every setup-node step agree; packageManager is npm@
    'ruleset-parity', // every required status check in rulesets/main.json names a real job; sample-regression required; tags.json protects refs/tags/v*
    'agent-config-parity', // settings.json parses; every CLAUDE.md "Never Read" glob is denied; HITL denies present for Bash and PowerShell; guard hook passes node --check
    'claude-rules-sync', // .claude/rules/ equals a fresh render of .github/instructions/ (npm run agents:rules)
    'claude-rules-budget', // CLAUDE.md + its @imports + unscoped rules ≤ 16 KiB; a scoped rule > 32 KiB warns
    'pr-template-parity', // every PR-template checklist item is verbatim in CONTRIBUTING.md; the template mentions npm run gate
    'eol-lf', // (git checkouts only) every tracked text blob is LF — an error since the 1.3.0 renormalisation (EOL_LF_MODE)
    'skills-shape', // every .claude/skills/*/SKILL.md names its directory, has a description, and its referenced files exist
    'internal-links', // every relative Markdown link resolves on disk
    'anchor-parity', // every `#fragment` a Markdown link (or a governance reference) targets is a heading anchor of its target
    'verified-on-parity', // every "Verified on" stamp equals manifest.verifiedOn
    'prose-language', // docs, samples README and release notes are English unless marked demo-language
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

/** Line number (1-based) of a character offset. */
export function lineOf(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text.charCodeAt(i) === 10) line++;
    }
    return line;
}

/**
 * Historical prose legitimately quotes superseded numbers ("1.0.0 shipped
 * with 19 rules"). Rewriting those would falsify the roadmap, so a line may
 * opt out with `verify-docs:allow <rule>` on itself or on the line
 * immediately above — a visible, greppable marker rather than a silent
 * exclusion list that nobody maintains.
 */
export function isSuppressed(lines: readonly string[], lineNo: number, rule: string): boolean {
    const marker = `verify-docs:allow ${rule}`;
    return (lines[lineNo - 1]?.includes(marker) ?? false) || (lines[lineNo - 2]?.includes(marker) ?? false);
}

/** True when semver a is strictly lower than b (plain x.y.z triples only). */
export function semverLess(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
    }
    return false;
}

/**
 * Job ids, display names and matrix values of every workflow under
 * `.github/workflows/`, for matching a ruleset's required status checks.
 */
export function workflowJobs(workflowTexts: readonly string[]): { jobs: Set<string>; matrixValues: Map<string, Set<string>> } {
    const jobs = new Set<string>();
    const matrixValues = new Map<string, Set<string>>();
    for (const text of workflowTexts) {
        const lines = text.replace(/\r\n/g, '\n').split('\n');
        let inJobs = false;
        let current: string | null = null;
        for (const line of lines) {
            if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
            if (!inJobs) continue;
            if (/^\S/.test(line)) { inJobs = false; continue; }
            const id = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
            if (id) {
                current = id[1];
                jobs.add(current);
                matrixValues.set(current, new Set());
                continue;
            }
            if (!current) continue;
            const jobName = /^ {4}name:\s*(.+?)\s*$/.exec(line);
            if (jobName) jobs.add(jobName[1].replace(/^["']|["']$/g, ''));
            const list = /^ {8}[A-Za-z0-9_-]+:\s*\[([^\]]*)\]\s*$/.exec(line);
            if (list) {
                for (const v of list[1].split(',')) matrixValues.get(current)!.add(v.trim().replace(/['"]/g, ''));
            }
        }
    }
    return { jobs, matrixValues };
}

// ── The verifier ────────────────────────────────────────────────────

export async function verifyDocs(root: string, options: VerifyOptions = {}): Promise<VerifyResult> {
    const problems: Problem[] = [];
    const fail = (file: string, line: number, rule: string, message: string): void => {
        problems.push({ file, line, rule, message, severity: 'error' });
    };
    const warn = (file: string, line: number, rule: string, message: string): void => {
        problems.push({ file, line, rule, message, severity: 'warn' });
    };
    const rel = (p: string): string => relative(root, p).replace(/\\/g, '/');
    const read = (p: string): string => readFileSync(p, 'utf8');
    const readOr = (p: string): string | null => (existsSync(join(root, p)) ? read(join(root, p)) : null);
    const report = (findings: readonly Finding[], rule: string): void => {
        for (const f of findings) (f.severity === 'error' ? fail : warn)(f.file, f.line, rule, f.message);
    };

    // ── Manifest ──────────────────────────────────────────────────
    const manifestPath = join(root, MANIFEST_REL);
    if (!existsSync(manifestPath)) {
        fail(MANIFEST_REL, 1, 'manifest-shape', 'missing — it is the single source of every count and version the docs quote');
        return { problems, rules: OFFLINE_RULES, files: 0, verifiedOn: null };
    }
    let manifest: Manifest;
    try {
        manifest = JSON.parse(read(manifestPath)) as Manifest;
    } catch (err) {
        fail(MANIFEST_REL, 1, 'manifest-shape', `not valid JSON — ${(err as Error).message}`);
        return { problems, rules: OFFLINE_RULES, files: 0, verifiedOn: null };
    }
    manifest.declared ??= {};
    manifest.derived ??= {};
    manifest.assertions ??= [];
    manifest.packages ??= {};

    const selfVersion = manifest.packages[SELF_PACKAGE]?.version ?? '';
    const coreVersion = manifest.packages['pdfnative']?.version ?? '';
    const declaredPin = manifest.packages['pdfnative']?.pin ?? null;

    // ── The documentation corpus ──────────────────────────────────
    const DOC_FILES: string[] = [
        ...['README.md', 'ROADMAP.md', 'AGENTS.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'llms.txt',
            '.github/copilot-instructions.md', '.github/AGENT_RULES.md', 'samples/README.md', 'scripts/README.md',
            'tests/regression/compat/README.md', `release-notes/v${selfVersion}.md`]
            .map((f) => join(root, f))
            .filter(existsSync),
        ...walk(join(root, 'docs'), (p) => p.endsWith('.md')),
        ...walk(join(root, '.github', 'instructions'), (p) => p.endsWith('.md')),
    ];
    const texts = new Map(DOC_FILES.map((f) => [f, read(f)] as const));

    // ── Rule: manifest-shape ──────────────────────────────────────
    const SEMVER = /^\d+\.\d+\.\d+$/;
    for (const [name, pkg] of Object.entries(manifest.packages)) {
        if (!SEMVER.test(pkg.version ?? '')) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `${name}.version "${pkg.version}" is not a plain semver triple`);
        }
        if (pkg.pinField !== null && pkg.pinField !== 'dependencies' && pkg.pinField !== 'peerDependencies') {
            fail(MANIFEST_REL, 1, 'manifest-shape', `${name}.pinField must be "dependencies", "peerDependencies" or null`);
        }
        if (pkg.pinField !== null && !pkg.pin) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `${name} declares pinField "${pkg.pinField}" but no pin`);
        }
    }
    const pkgJsonText = readOr('package.json');
    if (pkgJsonText !== null) {
        const pkgJson = JSON.parse(pkgJsonText) as { version?: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
        if (pkgJson.version !== selfVersion) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `packages.${SELF_PACKAGE}.version is ${selfVersion} but package.json says ${pkgJson.version} — run release:prepare`);
        }
        if (manifest.packages['pdfnative']?.pinField !== 'peerDependencies') {
            fail(MANIFEST_REL, 1, 'manifest-shape', 'packages.pdfnative.pinField must be "peerDependencies" — the engine is a peer of this package, never a dependency');
        }
        const pin = pkgJson.peerDependencies?.['pdfnative'];
        if (pin !== undefined && declaredPin !== pin) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `packages.pdfnative.pin is ${JSON.stringify(declaredPin)} but package.json pins pdfnative ${pin} as a peer`);
        }
        const floor = pinFloor(pin ?? null);
        if (floor !== null && floor !== coreVersion) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `packages.pdfnative.version is ${coreVersion} but the peer floor is ${floor} — the manifest names the engine the package is built on`);
        }
        // Exactly one runtime dependency: the governance invariant, held here as well as in tests/tools/workflows.test.ts.
        const deps = Object.keys(pkgJson.dependencies ?? {}).sort();
        if (deps.length !== 1 || deps[0] !== 'react-reconciler') {
            fail('package.json', 1, 'manifest-shape', `dependencies are [${deps.join(', ')}] — the runtime set is exactly [react-reconciler]; pdfnative and react are peers`);
        }
    }
    {
        // The version lock-step: src/version.ts carries the same triple.
        const versionTs = readOr('src/version.ts');
        const inSource = versionTs === null ? null : /export const version\s*=\s*['"](\d+\.\d+\.\d+)['"]/.exec(versionTs)?.[1] ?? null;
        if (inSource !== null && inSource !== selfVersion) {
            fail('src/version.ts', 1, 'manifest-shape', `says ${inSource} but the manifest says ${selfVersion} — the version moves in lock-step`);
        }
    }

    const manifestRef = (ref: string): number | undefined => {
        const m = /^(declared|derived)\.([A-Za-z_]\w*)$/.exec(ref);
        if (!m) return undefined;
        const value = (m[1] === 'declared' ? manifest.declared : manifest.derived)[m[2]];
        return typeof value === 'number' ? value : undefined;
    };
    const resolveCanonical = (canonical: string): string =>
        canonical.replace(/\{((?:declared|derived)\.\w+)\}/g, (whole, ref: string) => {
            const value = manifestRef(ref);
            return value === undefined ? whole : String(value);
        });

    for (const assertion of manifest.assertions) {
        if (assertion.expectFrom === undefined) continue;
        const resolved = manifestRef(assertion.expectFrom);
        if (resolved === undefined) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `assertion "${assertion.id}" has expectFrom "${assertion.expectFrom}", which is not a numeric declared.* or derived.* field`);
            continue;
        }
        if (assertion.expect !== undefined && assertion.expect !== resolved) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `assertion "${assertion.id}" says expect ${assertion.expect} but ${assertion.expectFrom} is ${resolved} — drop the literal, expectFrom is the source`);
        }
        const canonical = resolveCanonical(assertion.canonical);
        const lead = /^(\d[\d , ]*)/.exec(canonical);
        if (lead && !assertion.canonical.startsWith('{') && Number(lead[1].replace(/[\s ,]/g, '')) !== resolved) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `assertion "${assertion.id}" canonical "${assertion.canonical}" contradicts ${assertion.expectFrom} = ${resolved} — use a {${assertion.expectFrom}} placeholder`);
        }
        for (const placeholder of canonical.matchAll(/\{((?:declared|derived)\.\w+)\}/g)) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `assertion "${assertion.id}" canonical references {${placeholder[1]}}, which is not a numeric manifest field`);
        }
    }

    // ── Rule: derived-counts ──────────────────────────────────────
    const actual = computeDerived(root);
    /** Figures the tree can check but that live under `declared` (they are claims about conformance files, stated at release). */
    const DECLARED_BUT_CHECKED = new Set(['pdfaSamples', 'pdfxSamples']);
    const KNOWN_DERIVED = new Set([...Object.keys(actual).filter((k) => !DECLARED_BUT_CHECKED.has(k)), '$comment']);
    for (const key of Object.keys(manifest.derived)) {
        if (!KNOWN_DERIVED.has(key)) {
            fail(MANIFEST_REL, 1, 'manifest-shape', `derived.${key} is not computed by any rule — typo, or add it to scripts/lib/react-surface.ts computeDerived()`);
        }
    }
    for (const [key, value] of Object.entries(actual)) {
        const declaredHere = DECLARED_BUT_CHECKED.has(key);
        const table = declaredHere ? manifest.declared : manifest.derived;
        const section = declaredHere ? 'declared' : 'derived';
        const stated = table[key];
        if (stated === undefined) {
            fail(MANIFEST_REL, 1, 'derived-counts', `${section}.${key} is missing — the tree has ${value}`);
            continue;
        }
        if (stated !== value) {
            fail(MANIFEST_REL, 1, 'derived-counts', `${section}.${key} says ${String(stated)} but the tree has ${value} — update the manifest, not the docs`);
        }
    }
    {
        // The test count is whatever the last gate run recorded — only a
        // report newer than every test file is evidence.
        const vitestJson = join(root, 'test-output', '.gate', 'vitest.json');
        const newestTest = walk(join(root, 'tests'), (p) => /\.test\.tsx?$/.test(p)).reduce((max, p) => Math.max(max, statSync(p).mtimeMs), 0);
        if (existsSync(vitestJson) && statSync(vitestJson).mtimeMs >= newestTest) {
            let total: number | undefined;
            try {
                const r = JSON.parse(read(vitestJson)) as { numTotalTests?: number; numPassedTests?: number; numFailedTests?: number; numPendingTests?: number; numTodoTests?: number };
                total = typeof r.numTotalTests === 'number'
                    ? r.numTotalTests
                    : typeof r.numPassedTests === 'number'
                        ? r.numPassedTests + (r.numFailedTests ?? 0) + (r.numPendingTests ?? 0) + (r.numTodoTests ?? 0)
                        : undefined;
            } catch {
                total = undefined;
            }
            if (typeof total === 'number' && total > 0 && manifest.declared['tests'] !== total) {
                fail(MANIFEST_REL, 1, 'derived-counts', `declared.tests says ${String(manifest.declared['tests'])} but the last gate run counted ${total} tests — update the manifest (and every doc quoting it)`);
            }
        }
    }
    {
        // The coverage floor the docs quote is the one vitest enforces.
        const vitestConfig = readOr('vitest.config.ts');
        const floor = vitestConfig === null ? undefined : /\bstatements:\s*(\d+(?:\.\d+)?)/.exec(vitestConfig)?.[1];
        if (floor !== undefined && manifest.declared['coverageStatements'] !== Number(floor)) {
            fail(MANIFEST_REL, 1, 'derived-counts', `declared.coverageStatements says ${String(manifest.declared['coverageStatements'])} but vitest.config.ts enforces ${floor}`);
        }
    }

    // ── Rule: stale-token / canonical-present ─────────────────────
    for (const assertion of manifest.assertions) {
        const pattern = assertion.match ?? assertion.forbid;
        const expect = assertion.expectFrom !== undefined ? manifestRef(assertion.expectFrom) : assertion.expect;
        const canonical = resolveCanonical(assertion.canonical);
        if (pattern) {
            const re = new RegExp(pattern, 'g');
            const isEquality = assertion.match !== undefined && expect !== undefined;
            for (const file of DOC_FILES) {
                const text = texts.get(file)!;
                const lines = text.split(/\r?\n/);
                re.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = re.exec(text)) !== null) {
                    const line = lineOf(text, m.index);
                    if (isSuppressed(lines, line, 'stale-token')) continue;
                    if (isEquality) {
                        const found = Number(m[1].replace(/[\s  ,]/g, ''));
                        if (!Number.isFinite(found) || found === expect) continue;
                        fail(rel(file), line, 'stale-token', `"${m[0].trim()}" — the manifest says ${expect} (${assertion.id})`);
                    } else {
                        fail(rel(file), line, 'stale-token', `"${m[0].trim()}" contradicts the manifest — canonical value is "${canonical}"`);
                    }
                }
            }
        }
        for (const required of assertion.requireIn) {
            const full = join(root, required);
            if (!existsSync(full)) {
                fail(MANIFEST_REL, 1, 'canonical-present', `assertion "${assertion.id}" requires ${required}, which does not exist`);
                continue;
            }
            if (!read(full).includes(canonical)) {
                fail(required, 1, 'canonical-present', `must state the canonical value "${canonical}" (assertion "${assertion.id}")`);
            }
        }
    }

    // ── Rule: version-token ───────────────────────────────────────
    for (const [name, pkg] of Object.entries(manifest.packages)) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(
            `\\b${escaped}(?![\\w-])[^\\n'"\`/().]{0,60}?(?<![\\^~\\d.§])(?<![<>≥≤=]\\s{0,3})\\bv?(\\d+\\.\\d+\\.\\d+)\\b`,
            'g',
        );
        const structural = [
            new RegExp(`\\[\`${escaped}\`\\]\\([^)]*\\)\\s*\\|\\s*\\*{0,2}v?(\\d+\\.\\d+\\.\\d+)\\*{0,2}`, 'g'),
        ];
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            for (const pattern of [re, ...structural]) {
                pattern.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(text)) !== null) {
                    if (m[1] === pkg.version) continue;
                    const line = lineOf(text, m.index);
                    if (isSuppressed(lines, line, 'version-token') || isSuppressed(lines, line, 'stale-token')) continue;
                    fail(rel(file), line, 'version-token', `"${m[0].trim()}" — the manifest says ${name} is ${pkg.version}`);
                }
            }
        }
    }

    // ── Rule: count-tokens ────────────────────────────────────────
    {
        interface CountToken {
            readonly pattern: RegExp;
            readonly source: string;
            readonly mode: 'equal' | 'floor';
            readonly requireIn?: readonly string[];
        }
        const COUNT_TOKENS: readonly CountToken[] = [
            { pattern: /\b(\d{1,3}(?:[ , ]\d{3})*|\d+)\+?\s+tests\b/g, source: 'declared.tests', mode: 'equal', requireIn: ['AGENTS.md', 'README.md'] },
            { pattern: /\bacross\s+(\d+)\+?\s+(?:test\s+)?files\b/g, source: 'derived.testFiles', mode: 'equal' },
            { pattern: /\b(\d+)\+?\s+test files\b/g, source: 'derived.testFiles', mode: 'equal' },
            { pattern: /\b(\d+)\s+(?:public\s+)?components\b/g, source: 'derived.components', mode: 'equal' },
            { pattern: /\b(\d+)\s+client components\b/g, source: 'derived.clientComponents', mode: 'equal' },
            { pattern: /\b(\d+)\s+block (?:kinds|groups)\b/g, source: 'derived.blocks', mode: 'equal' },
            { pattern: /\b(\d+)\s+(?:top-level\s+)?DocSpec fields\b/g, source: 'derived.specFields', mode: 'equal' },
            { pattern: /\b(\d+)\s+lint rules\b/g, source: 'derived.lintRules', mode: 'equal' },
            { pattern: /\b(\d+)\s+(?:documented\s+|stable\s+)?error codes\b/g, source: 'derived.errorCodes', mode: 'equal' },
            { pattern: /\b(\d+)\s+schema subjects\b/g, source: 'derived.schemaSubjects', mode: 'equal' },
            { pattern: /\b(\d+)\s+(?:runnable\s+)?samples in the baseline\b/g, source: 'derived.samples', mode: 'equal' },
            { pattern: /\b(\d+)-sample (?:byte )?baseline\b/g, source: 'derived.samples', mode: 'equal' },
            { pattern: /\b(\d+)\s+(?:conformance\s+)?corpus files\b/g, source: 'derived.corpusFiles', mode: 'equal' },
            { pattern: /\b(\d+)-file (?:PDF\/A |conformance )?corpus\b/g, source: 'derived.corpusFiles', mode: 'equal' },
            { pattern: /\b(\d+)\s+chart types\b/g, source: 'declared.chartTypes', mode: 'equal' },
            { pattern: /\b(\d+)\s+diagnostic codes\b/g, source: 'declared.diagnosticCodes', mode: 'equal' },
            { pattern: /(\d+(?:\.\d+)?)\s?%\+?\s+statement coverage\b/g, source: 'declared.coverageStatements', mode: 'floor' },
            { pattern: /(\d+(?:\.\d+)?)\s?%\+?\s+statements\b/g, source: 'declared.coverageStatements', mode: 'floor' },
            // "27 Unicode scripts", "27 script codes", "27-script" — never the
            // trailing "0" of "1.3.0 scripts" or a parenthesised grouping such
            // as "Indic (9 scripts)".
            { pattern: /\b(\d+)\s+Unicode scripts\b/g, source: 'declared.unicodeScripts', mode: 'equal' },
            { pattern: /(?<![\d.])\b(\d+)\s+script codes?\b/g, source: 'declared.unicodeScripts', mode: 'equal' },
            { pattern: /(?<![\d.(])\b(\d+)-scripts?\b/gi, source: 'declared.unicodeScripts', mode: 'equal' },
        ];
        for (const token of COUNT_TOKENS) {
            const expected = manifestRef(token.source);
            if (expected === undefined) {
                fail(MANIFEST_REL, 1, 'manifest-shape', `${token.source} is missing — count-tokens needs it to police "${token.pattern.source}"`);
                continue;
            }
            const seenIn = new Set<string>();
            for (const file of DOC_FILES) {
                const text = texts.get(file)!;
                const lines = text.split(/\r?\n/);
                token.pattern.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = token.pattern.exec(text)) !== null) {
                    seenIn.add(rel(file));
                    const found = Number(m[1].replace(/[\s ,]/g, ''));
                    if (!Number.isFinite(found)) continue;
                    const measured = manifest.declared['coverageMeasured'];
                    if (token.mode === 'floor' && m[1].includes('.') && typeof measured === 'number') {
                        if (Math.abs(found - measured) > 0.001) {
                            const line = lineOf(text, m.index);
                            if (isSuppressed(lines, line, 'count-tokens') || isSuppressed(lines, line, 'stale-token')) continue;
                            fail(rel(file), line, 'count-tokens', `"${m[0].trim()}" — the manifest says the measured figure is ${measured} % (declared.coverageMeasured)`);
                        }
                        continue;
                    }
                    const ok = token.mode === 'equal' ? found === expected : Math.floor(found) <= expected;
                    if (ok) continue;
                    const line = lineOf(text, m.index);
                    if (isSuppressed(lines, line, 'count-tokens') || isSuppressed(lines, line, 'stale-token')) continue;
                    const verdict = token.mode === 'equal'
                        ? `the manifest says ${expected} (${token.source})`
                        : `the manifest floor is ${expected} % (${token.source}) — a doc may not claim more coverage than is enforced`;
                    fail(rel(file), line, 'count-tokens', `"${m[0].trim()}" — ${verdict}`);
                }
            }
            for (const required of token.requireIn ?? []) {
                if (!existsSync(join(root, required))) {
                    fail(required, 1, 'count-tokens', `missing — it must state the ${token.source} count`);
                } else if (!seenIn.has(required)) {
                    fail(required, 1, 'count-tokens', `never states the ${token.source} count ("${expected} tests") — it is the figure agents quote`);
                }
            }
        }
        // "Current release: X.Y.Z" / "Current version: X.Y.Z" — prose that names
        // the package version without the package name beside it.
        const CURRENT_VERSION = /Current (?:release|version):\s*\**v?(\d+\.\d+\.\d+)/g;
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            CURRENT_VERSION.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = CURRENT_VERSION.exec(text)) !== null) {
                if (m[1] === selfVersion) continue;
                const line = lineOf(text, m.index);
                if (isSuppressed(lines, line, 'count-tokens') || isSuppressed(lines, line, 'version-token')) continue;
                fail(rel(file), line, 'count-tokens', `"${m[0].trim()}" — the manifest says ${SELF_PACKAGE} is ${selfVersion}`);
            }
        }
    }

    // ── Rule: registry-parity ─────────────────────────────────────
    const registryText = readOr('src/registry.ts') ?? '';
    {
        const components = componentNames(registryText);
        const aliases = componentAliases(registryText);
        const clients = clientComponentNames(registryText);
        if (components.length === 0) fail('src/registry.ts', 1, 'registry-parity', 'COMPONENT_REGISTRY resolves to no component — scripts/lib/react-surface.ts can no longer read it');
        // Markdown names a component in backticks or as a tag; llms.txt is plain
        // text, where a bare word at a word boundary is the claim.
        const plain = (doc: string): boolean => doc.endsWith('.txt');
        const named = (doc: string, text: string, name: string): boolean =>
            text.includes(`\`${name}\``) || text.includes(`<${name}>`) || text.includes(`<${name} `) || text.includes(`\`<${name}`)
            || (plain(doc) && new RegExp(`\\b${name}\\b`).test(text));
        for (const doc of COMPONENT_DOCS) {
            const text = readOr(doc);
            if (text === null) {
                fail(doc, 1, 'registry-parity', 'missing — it must name every component');
                continue;
            }
            const absent = [...components, ...clients].filter((c) => !named(doc, text, c));
            if (absent.length > 0) fail(doc, 1, 'registry-parity', `does not name ${absent.map((c) => `\`${c}\``).join(', ')} — every component of the registry is part of the contract`);
        }
        const kinds = blockKinds(registryText);
        const fields = docSpecFields(registryText);
        for (const doc of SPEC_DOCS) {
            const text = readOr(doc);
            if (text === null) continue;
            const absentKinds = kinds.filter((k) => !new RegExp(`['\`]${k}['\`]`).test(text));
            if (absentKinds.length > 0) fail(doc, 1, 'registry-parity', `does not name the DocSpec block tag${absentKinds.length > 1 ? 's' : ''} ${absentKinds.map((k) => `'${k}'`).join(', ')}`);
            const absentFields = fields.filter((f) => !new RegExp(plain(doc) ? `\\b${f}\\b` : `\`${f}\`|\\b${f}[:?]`).test(text));
            if (absentFields.length > 0) fail(doc, 1, 'registry-parity', `does not name the DocSpec field${absentFields.length > 1 ? 's' : ''} ${absentFields.map((f) => `\`${f}\``).join(', ')}`);
        }
        // An inline-code tag in prose that is not a component: a renamed or invented one.
        // Fenced code is skipped (a sample may define its own `<InvoiceDocument>`), as are
        // React's own names and the generic placeholders the docs use.
        const known = new Set([...components, ...aliases, ...clients]);
        const CANDIDATE = /`<([A-Z][A-Za-z]+)(?=[\s>/`])/g;
        const NOT_OURS = new Set(['View', 'StyleSheet', 'Suspense', 'Fragment', 'Provider', 'Consumer', 'ErrorBoundary', 'App', 'Component', 'Tag', 'Name']);
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            const seen = new Set<string>();
            let fenced = false;
            lines.forEach((lineText, i) => {
                if (/^\s*(```|~~~)/.test(lineText)) { fenced = !fenced; return; }
                if (fenced) return;
                CANDIDATE.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = CANDIDATE.exec(lineText)) !== null) {
                    const tag = m[1];
                    if (known.has(tag) || NOT_OURS.has(tag) || seen.has(tag)) continue;
                    seen.add(tag);
                    if (isSuppressed(lines, i + 1, 'registry-parity')) continue;
                    fail(rel(file), i + 1, 'registry-parity', `\`<${tag}>\` reads like a component but COMPONENT_REGISTRY has none — a planned component is marked \`verify-docs:allow registry-parity\``);
                }
            });
        }
    }

    // ── Rule: lint-rule-parity ────────────────────────────────────
    {
        const rules = lintRuleTable(registryText);
        const linting = readOr('docs/LINTING.md');
        if (linting === null) {
            fail('docs/LINTING.md', 1, 'lint-rule-parity', 'missing — it documents every lint rule');
        } else {
            const rows = lintingDocRules(linting);
            const lintingLines = linting.split(/\r?\n/);
            for (const [code, severity] of rules) {
                const documented = rows.get(code);
                if (documented === undefined) fail('docs/LINTING.md', 1, 'lint-rule-parity', `has no row for \`${code}\` (${severity}) — every rule of LINT_RULES is documented`);
                else if (documented !== severity) {
                    const at = lintingLines.findIndex((l) => l.startsWith('|') && l.includes(`\`${code}\``));
                    fail('docs/LINTING.md', at === -1 ? 1 : at + 1, 'lint-rule-parity', `lists \`${code}\` under ${documented}s but the registry says ${severity}`);
                }
            }
            for (const code of rows.keys()) {
                if (rules.has(code)) continue;
                const at = lintingLines.findIndex((l) => l.startsWith('|') && l.includes(`\`${code}\``));
                fail('docs/LINTING.md', at === -1 ? 1 : at + 1, 'lint-rule-parity', `documents \`${code}\`, which LINT_RULES does not carry — remove the row or add the rule`);
            }
        }
        for (const doc of LINT_DOCS) {
            const text = readOr(doc);
            if (text === null) continue;
            const absent = [...rules.keys()].filter((c) => !new RegExp(`\\b${c}\\b`).test(text));
            if (absent.length > 0) fail(doc, 1, 'lint-rule-parity', `does not name ${absent.map((c) => `\`${c}\``).join(', ')} — every lint rule is part of the contract`);
        }
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            for (const token of lintCodeTokens(text)) {
                if (rules.has(token)) continue;
                const line = lineOf(text, text.indexOf(`\`${token}\``));
                if (isSuppressed(lines, line, 'lint-rule-parity')) continue;
                fail(rel(file), line, 'lint-rule-parity', `\`${token}\` is not a rule of LINT_RULES — a planned rule is marked \`verify-docs:allow lint-rule-parity\``);
            }
        }
    }

    // ── Rule: error-code-parity ───────────────────────────────────
    {
        const codes = errorCodes(readOr('src/errors.ts') ?? '');
        const codeSet = new Set(codes);
        if (codes.length === 0) fail('src/errors.ts', 1, 'error-code-parity', 'the ErrorCode table resolves to no code — scripts/lib/react-surface.ts can no longer read it');
        const contract = readOr('docs/AGENT_CONTRACT.md');
        if (contract === null) {
            fail('docs/AGENT_CONTRACT.md', 1, 'error-code-parity', 'missing — its §6 documents every error code');
        } else {
            const rows = contractErrorRows(contract);
            if (rows.length === 0) fail('docs/AGENT_CONTRACT.md', 1, 'error-code-parity', 'has no "## 6." error table');
            const absent = codes.filter((c) => !rows.includes(c));
            if (absent.length > 0) fail('docs/AGENT_CONTRACT.md', 1, 'error-code-parity', `§6 has no row for ${absent.join(', ')} — every code the package throws is part of the contract`);
            const contractLines = contract.split(/\r?\n/);
            for (const row of rows) {
                if (codeSet.has(row)) continue;
                const at = contractLines.findIndex((l) => l.startsWith('|') && l.includes(`\`${row}\``));
                fail('docs/AGENT_CONTRACT.md', at === -1 ? 1 : at + 1, 'error-code-parity', `§6 documents \`${row}\`, which ErrorCode does not carry — remove the row or add the code`);
            }
        }
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            for (const token of errorCodeTokens(text)) {
                if (codeSet.has(token)) continue;
                const line = lineOf(text, text.indexOf(`\`${token}\``));
                if (isSuppressed(lines, line, 'error-code-parity')) continue;
                fail(rel(file), line, 'error-code-parity', `\`${token}\` is not a code of ErrorCode — a planned code is marked \`verify-docs:allow error-code-parity\``);
            }
        }
    }

    // ── Rule: sample-index-parity ─────────────────────────────────
    {
        const index = readOr('samples/README.md');
        if (index === null) {
            fail('samples/README.md', 1, 'sample-index-parity', 'missing — it indexes every sample');
        } else {
            const links = sampleIndexLinks(index);
            const linked = new Set(links.map((l) => `samples/${l}`));
            const onDisk = sampleSourceFiles(root);
            const planned = new Set([...SAMPLE_PLAN.map((e) => e.source), ...MODULE_SAMPLES]);
            const indexLines = index.split(/\r?\n/);
            for (const file of onDisk) {
                if (!linked.has(file)) fail('samples/README.md', 1, 'sample-index-parity', `does not link ${file} — every sample is indexed`);
                if (!planned.has(file)) fail('scripts/lib/sample-plan.ts', 1, 'sample-index-parity', `does not list ${file} — every sample is generated (SAMPLE_PLAN) or declared a module (MODULE_SAMPLES)`);
            }
            for (const link of links) {
                if (!existsSync(join(root, 'samples', link))) {
                    const at = indexLines.findIndex((l) => l.includes(`](${link})`));
                    fail('samples/README.md', at === -1 ? 1 : at + 1, 'sample-index-parity', `links ${link}, which does not exist`);
                }
            }
            for (const source of planned) {
                if (!existsSync(join(root, source))) fail('scripts/lib/sample-plan.ts', 1, 'sample-index-parity', `lists ${source}, which does not exist`);
            }
        }
    }

    // ── Rule: engine-version-token ────────────────────────────────
    if (declaredPin !== null) {
        // `pdfnative` the engine — never `pdfnative-react@^1.2.0` or `pdfnative-cli`.
        const PIN = /\bpdfnative(?![\w-])[^\n`]{0,40}?`?(\^\d+\.\d+\.\d+)`?/g;
        for (const file of DOC_FILES) {
            const text = texts.get(file)!;
            const lines = text.split(/\r?\n/);
            PIN.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = PIN.exec(text)) !== null) {
                if (m[1] === declaredPin) continue;
                const line = lineOf(text, m.index);
                if (isSuppressed(lines, line, 'engine-version-token') || isSuppressed(lines, line, 'version-token')) continue;
                fail(rel(file), line, 'engine-version-token', `"${m[0].trim()}" — the manifest pins pdfnative ${declaredPin}`);
            }
        }
    }

    // ── Rule: peer-pin-parity ─────────────────────────────────────
    if (pkgJsonText !== null && declaredPin !== null) {
        const peer = enginePin(pkgJsonText, 'peerDependencies');
        const dev = enginePin(pkgJsonText, 'devDependencies');
        if (dev !== peer) fail('package.json', 1, 'peer-pin-parity', `devDependencies.pdfnative is ${JSON.stringify(dev)} but peerDependencies.pdfnative is ${JSON.stringify(peer)} — the engine tested against is the engine declared`);
        const floor = pinFloor(peer);
        const manifestTs = readOr('src/manifest.ts');
        const inManifest = manifestTs === null ? null : /engine:\s*'([^']+)'/.exec(manifestTs)?.[1] ?? null;
        if (inManifest !== null && inManifest !== peer) fail('src/manifest.ts', 1, 'peer-pin-parity', `contract.engine is '${inManifest}' but package.json pins the peer at ${peer ?? '?'}`);
        const doctorTs = readOr('src/doctor.ts');
        const inDoctor = doctorTs === null ? null : /REQUIRED_ENGINE\s*=\s*'(\d+\.\d+\.\d+)'/.exec(doctorTs)?.[1] ?? null;
        if (inDoctor !== null && floor !== null && inDoctor !== floor) fail('src/doctor.ts', 1, 'peer-pin-parity', `REQUIRED_ENGINE is ${inDoctor} but the peer floor is ${floor}`);
    }

    // ── Rule: changelog-ladder ────────────────────────────────────
    {
        const changelog = readOr('CHANGELOG.md');
        if (changelog === null) {
            fail('CHANGELOG.md', 1, 'changelog-ladder', 'missing');
        } else {
            for (const f of checkChangelogLadder(changelog)) fail('CHANGELOG.md', f.line, 'changelog-ladder', f.message);
            if (selfVersion !== '' && !new RegExp(`^## \\[${selfVersion.replace(/\./g, '\\.')}\\]`, 'm').test(changelog)) {
                fail('CHANGELOG.md', 1, 'changelog-ladder', `has no "## [${selfVersion}]" entry — release-notes/v${selfVersion}.md is mirrored into it`);
            }
            if (selfVersion !== '' && !existsSync(join(root, 'release-notes', `v${selfVersion}.md`))) {
                fail(`release-notes/v${selfVersion}.md`, 1, 'changelog-ladder', 'missing — a release note is mandatory for every version');
            }
        }
    }

    // ── Rule: claude-md-budget ────────────────────────────────────
    {
        const MAX_LINE = 240;
        const budgets: Array<{ file: string; maxLines?: number; maxBytes?: number; firstLine?: string }> = [
            { file: 'CLAUDE.md', maxLines: 120, firstLine: '@AGENTS.md' },
            { file: 'AGENTS.md', maxLines: 120 },
            { file: '.github/copilot-instructions.md', maxBytes: 16384 },
        ];
        for (const budget of budgets) {
            const text = readOr(budget.file);
            if (text === null) {
                fail(budget.file, 1, 'claude-md-budget', 'missing — every agent entry file must exist');
                continue;
            }
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
            if (budget.maxLines !== undefined && lineCount > budget.maxLines) {
                fail(budget.file, 1, 'claude-md-budget', `${lineCount} lines — the budget is ${budget.maxLines}; move detail to .github/instructions/ or docs/`);
            }
            const bytes = Buffer.byteLength(text, 'utf8');
            if (budget.maxBytes !== undefined && bytes > budget.maxBytes) {
                fail(budget.file, 1, 'claude-md-budget', `${bytes} bytes — the budget is ${budget.maxBytes}; move detail to .github/instructions/`);
            }
            lines.forEach((line, i) => {
                if (line.length > MAX_LINE) fail(budget.file, i + 1, 'claude-md-budget', `line is ${line.length} characters — the limit is ${MAX_LINE}`);
            });
            if (budget.firstLine !== undefined) {
                const first = lines.find((l) => l.trim() !== '')?.trim();
                if (first !== budget.firstLine) {
                    fail(budget.file, 1, 'claude-md-budget', `first non-empty line is "${first ?? ''}" — it must be "${budget.firstLine}" so Claude Code loads AGENTS.md instead of a fork of it`);
                }
            }
        }
    }

    // ── Rule: governance-sources ──────────────────────────────────
    {
        const text = readOr('.github/ai-governance.json');
        const MAX_SOURCES_BYTES = 16 * 1024;
        if (text === null) {
            fail('.github/ai-governance.json', 1, 'governance-sources', 'missing — agents read it as the machine-readable policy');
        } else {
            let policy: { capability_manifest?: { sources?: unknown; on_demand?: unknown } } = {};
            try {
                policy = JSON.parse(text) as typeof policy;
            } catch (err) {
                fail('.github/ai-governance.json', 1, 'governance-sources', `not valid JSON — ${(err as Error).message}`);
            }
            const asPaths = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
            let total = 0;
            for (const [list, entries] of [['sources', asPaths(policy.capability_manifest?.sources)], ['on_demand', asPaths(policy.capability_manifest?.on_demand)]] as const) {
                for (const p of entries) {
                    const full = join(root, p);
                    if (!existsSync(full)) {
                        fail('.github/ai-governance.json', 1, 'governance-sources', `capability_manifest.${list} names "${p}", which does not exist`);
                    } else if (list === 'sources' && statSync(full).isFile()) {
                        total += statSync(full).size;
                    }
                }
            }
            if (total >= MAX_SOURCES_BYTES) {
                fail('.github/ai-governance.json', 1, 'governance-sources', `capability_manifest.sources total ${total} bytes — the always-loaded set must stay under ${MAX_SOURCES_BYTES}; move a file to on_demand`);
            }
        }
    }

    // ── Rule: node-pin-parity ─────────────────────────────────────
    {
        const nvmrc = readOr('.nvmrc');
        let pinnedMajor: number | null = null;
        if (nvmrc === null) {
            fail('.nvmrc', 1, 'node-pin-parity', 'missing — every workflow reads its Node version from it');
        } else {
            const m = /^v?(\d+)/.exec(nvmrc.trim());
            if (!m) fail('.nvmrc', 1, 'node-pin-parity', `"${nvmrc.trim()}" is not a Node version`);
            else pinnedMajor = Number(m[1]);
        }
        if (pkgJsonText !== null) {
            const pkg = JSON.parse(pkgJsonText) as { engines?: { node?: string }; packageManager?: string };
            const enginesMajor = /(\d+)/.exec(pkg.engines?.node ?? '')?.[1];
            if (enginesMajor === undefined) {
                fail('package.json', 1, 'node-pin-parity', 'engines.node is missing or names no major version');
            } else if (pinnedMajor !== null && Number(enginesMajor) !== pinnedMajor) {
                fail('package.json', 1, 'node-pin-parity', `engines.node "${pkg.engines?.node}" but .nvmrc pins ${pinnedMajor} — the two majors must agree`);
            }
            if (typeof pkg.packageManager !== 'string' || !pkg.packageManager.startsWith('npm@')) {
                fail('package.json', 1, 'node-pin-parity', `packageManager must be present and start with "npm@" (found ${JSON.stringify(pkg.packageManager ?? null)})`);
            }
        }
        const WORKFLOWS = join(root, '.github', 'workflows');
        if (existsSync(WORKFLOWS)) {
            for (const name of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
                const relPath = `.github/workflows/${name}`;
                const text = read(join(WORKFLOWS, name));
                const uses = [...text.matchAll(/uses:\s*actions\/setup-node@/g)];
                if (uses.length === 0) continue;
                const withFile = [...text.matchAll(/node-version-file:\s*\.nvmrc\b/g)].length;
                if (withFile >= uses.length) continue;
                const matrix = /node-version:\s*\$\{\{\s*matrix\.node-version\s*\}\}/.test(text) && /node-version:\s*\[([^\]]*)\]/.exec(text);
                if (name === 'ci.yml' && matrix) {
                    const majors = matrix[1].split(',').map((s) => Number(s.trim().replace(/['"]/g, '')));
                    if (pinnedMajor !== null && !majors.includes(pinnedMajor)) {
                        fail(relPath, lineOf(text, matrix.index), 'node-pin-parity', `matrix [${matrix[1].trim()}] does not include the .nvmrc major ${pinnedMajor}`);
                    }
                    // The os job of ci.yml reads .nvmrc; the matrix job is the only exception.
                    if (uses.length - withFile > 1) fail(relPath, lineOf(text, uses[0].index), 'node-pin-parity', 'only the matrix job may set node-version directly — the os job reads `node-version-file: .nvmrc`');
                    continue;
                }
                fail(relPath, lineOf(text, uses[0].index), 'node-pin-parity', 'actions/setup-node must read `node-version-file: .nvmrc` (only ci.yml may span a matrix)');
            }
        }
        const engines = pkgJsonText === null ? null : ((JSON.parse(pkgJsonText) as { engines?: { node?: string } }).engines?.node ?? null);
        const ciMatrix = /node-version:\s*\[([^\]]*)\]/.exec(readOr('.github/workflows/ci.yml') ?? '')?.[1]
            .split(',').map((s) => Number(s.trim().replace(/['"]/g, ''))).filter((n) => Number.isFinite(n)) ?? [];
        report(checkNodeVersionPin({ nodeVersion: readOr('.node-version'), enginesNode: engines, ciMatrix }), 'node-pin-parity');
    }

    // ── Rule: ruleset-parity ──────────────────────────────────────
    {
        const text = readOr('.github/rulesets/main.json');
        if (text !== null) {
            let ruleset: { rules?: Array<{ type?: string; parameters?: { required_status_checks?: Array<{ context?: string }> } }> } = {};
            let parsed = true;
            try {
                ruleset = JSON.parse(text) as typeof ruleset;
            } catch (err) {
                parsed = false;
                fail('.github/rulesets/main.json', 1, 'ruleset-parity', `not valid JSON — ${(err as Error).message}`);
            }
            if (parsed) {
                const WORKFLOWS = join(root, '.github', 'workflows');
                const workflowTexts = existsSync(WORKFLOWS) ? readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)).map((f) => read(join(WORKFLOWS, f))) : [];
                const { jobs, matrixValues } = workflowJobs(workflowTexts);
                const contexts: string[] = [];
                for (const rule of ruleset.rules ?? []) {
                    if (rule.type !== 'required_status_checks') continue;
                    for (const check of rule.parameters?.required_status_checks ?? []) {
                        if (typeof check.context === 'string') contexts.push(check.context);
                    }
                }
                for (const context of contexts) {
                    if (jobs.has(context)) continue;
                    const m = /^(.+?)\s*\((.+)\)$/.exec(context);
                    if (m && jobs.has(m[1]) && m[2].split(',').every((v) => matrixValues.get(m[1])?.has(v.trim()))) continue;
                    fail('.github/rulesets/main.json', 1, 'ruleset-parity', `required status check "${context}" names no job in .github/workflows/ — every PR to main would block on it`);
                }
                if (!contexts.includes('sample-regression')) {
                    fail('.github/rulesets/main.json', 1, 'ruleset-parity', '"sample-regression" is not a required status check — the byte baseline must block merges');
                }
            }
        }
        report(checkTagRuleset(readOr('.github/rulesets/tags.json')), 'ruleset-parity');
    }

    // ── Rules: agent-config-parity, claude-rules-sync, claude-rules-budget,
    //           pr-template-parity, eol-lf, skills-shape ──────────────
    {
        const claudeMd = readOr('CLAUDE.md') ?? '';
        const hookPath = join(root, '.claude', 'hooks', 'guard.mjs');
        const hookExists = existsSync(hookPath);
        const hookCheck = hookExists ? spawnSync(process.execPath, ['--check', hookPath], { encoding: 'utf8', windowsHide: true }) : null;
        report(
            checkAgentConfigParity({
                settingsText: readOr('.claude/settings.json'),
                claudeMd,
                hook: { exists: hookExists, checkStatus: hookCheck?.status ?? null, checkStderr: hookCheck?.stderr ?? '' },
            }),
            'agent-config-parity',
        );

        const diff = diffClaudeRules(root);
        for (const bad of diff.invalid) fail(`${INSTRUCTIONS_DIR}/${bad.source}`, 1, 'claude-rules-sync', `${bad.error} — the generator refuses it`);
        for (const f of diff.missing) fail(`${RULES_DIR}/${f}`, 1, 'claude-rules-sync', 'missing — run `npm run agents:rules`');
        for (const f of diff.stale) fail(`${RULES_DIR}/${f}`, 1, 'claude-rules-sync', 'differs from its instruction file — edit the .github/instructions/ source, then run `npm run agents:rules`');
        for (const f of diff.extra) fail(`${RULES_DIR}/${f}`, 1, 'claude-rules-sync', 'has no instruction source — delete it, or add the .github/instructions/<area>.instructions.md it should come from');

        report(checkClaudeRulesBudget({ claudeMd, resolveImport: (name) => readOr(name), rules: readRuleFiles(root) }), 'claude-rules-budget');
        report(checkPrTemplateParity(readOr('.github/pull_request_template.md'), readOr('CONTRIBUTING.md') ?? ''), 'pr-template-parity');

        // eol-lf — git checkouts only (the test sandbox is a plain directory).
        const gitOut = (...args: string[]): string | null => {
            const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
            return r.status === 0 ? r.stdout : null;
        };
        const top = gitOut('rev-parse', '--show-toplevel')?.trim().replace(/\\/g, '/');
        if (top !== undefined && top.toLowerCase() === resolve(root).replace(/\\/g, '/').toLowerCase()) {
            report(checkEol(gitOut('ls-files', '--eol') ?? ''), 'eol-lf');
        }

        const skillsDir = join(root, '.claude', 'skills');
        if (existsSync(skillsDir)) {
            for (const dir of readdirSync(skillsDir).sort()) {
                if (!statSync(join(skillsDir, dir)).isDirectory()) continue;
                report(
                    checkSkillShape({
                        dir,
                        text: readOr(`.claude/skills/${dir}/SKILL.md`),
                        existsInSkill: (name) => existsSync(join(skillsDir, dir, name)),
                        existsInRepo: (p) => existsSync(join(root, p)),
                    }),
                    'skills-shape',
                );
            }
        }
    }

    // ── Rule: internal-links ──────────────────────────────────────
    {
        const MD_LINK = /\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g;
        const linked = [
            ...DOC_FILES.filter((f) => f.endsWith('.md')),
            ...['CHANGELOG.md', '.github/pull_request_template.md'].map((p) => join(root, p)).filter(existsSync),
        ];
        for (const file of linked) {
            const text = texts.get(file) ?? read(file);
            const lines = text.split(/\r?\n/);
            MD_LINK.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = MD_LINK.exec(text)) !== null) {
                const href = m[1];
                if (/^(https?:|mailto:|data:|\/\/)/.test(href) || href.includes('${') || href.includes('<')) continue;
                if (existsSync(resolve(dirname(file), href))) continue;
                const line = lineOf(text, m.index);
                if (isSuppressed(lines, line, 'internal-links')) continue;
                fail(rel(file), line, 'internal-links', `"${href}" does not resolve on disk`);
            }
        }
    }

    // ── Rule: anchor-parity ───────────────────────────────────────
    // Shipped release notes (release-notes/v*.md below the current version)
    // and shipped PR drafts are frozen history: their links were right
    // against the tree of their day and are never rewritten. The current
    // note, the current PR draft and the templates are live documents.
    {
        const corpus = new Set([
            ...DOC_FILES.filter((f) => f.endsWith('.md')),
            ...['CHANGELOG.md', '.github/pull_request_template.md', 'release-notes/TEMPLATE.md', 'release-notes/PR_TEMPLATE.md',
                '.github/drafts/TEMPLATE.md', `release-notes/draft/PR-v${selfVersion}.md`]
                .map((p) => join(root, p)).filter(existsSync),
        ]);
        const anchorCache = new Map<string, ReadonlySet<string>>();
        const anchorsOf = (file: string): ReadonlySet<string> => {
            let set = anchorCache.get(file);
            if (set === undefined) {
                set = markdownAnchors(texts.get(file) ?? read(file));
                anchorCache.set(file, set);
            }
            return set;
        };
        const check = (from: string, line: number, target: string, fragment: string, lines: readonly string[]): void => {
            // A missing file is internal-links' finding; a non-Markdown target has no heading anchors to check.
            if (!existsSync(target) || !target.endsWith('.md')) return;
            if (isSuppressed(lines, line, 'anchor-parity')) return;
            if (!anchorsOf(target).has(fragment.toLowerCase())) {
                fail(rel(from), line, 'anchor-parity', `"#${fragment}" is not a heading anchor of ${rel(target)}`);
            }
        };
        for (const file of corpus) {
            const text = texts.get(file) ?? read(file);
            const lines = text.split(/\r?\n/);
            for (const link of fragmentLinks(text)) {
                const target = link.path === '' ? file : resolve(dirname(file), link.path);
                check(file, lineOf(text, link.index), target, link.fragment, lines);
            }
        }
        // The governance policy's `references.*` are read by agents as links: same rule.
        const policyText = readOr('.github/ai-governance.json');
        if (policyText !== null) {
            try {
                const policy = JSON.parse(policyText) as { references?: Record<string, unknown> };
                const policyLines = policyText.split(/\r?\n/);
                for (const [key, value] of Object.entries(policy.references ?? {})) {
                    if (typeof value !== 'string' || !value.includes('#')) continue;
                    const [path, fragment] = value.split('#', 2) as [string, string];
                    const at = policyText.indexOf(value);
                    const line = at >= 0 ? lineOf(policyText, at) : 1;
                    const target = join(root, path);
                    if (!existsSync(target)) {
                        fail('.github/ai-governance.json', line, 'anchor-parity', `references.${key} names "${path}", which does not exist`);
                        continue;
                    }
                    check(join(root, '.github', 'ai-governance.json'), line, target, fragment, policyLines);
                }
            } catch {
                // governance-sources reports invalid JSON.
            }
        }
    }

    // ── Rule: verified-on-parity ──────────────────────────────────
    for (const relPath of STAMPED_FILES) {
        const text = readOr(relPath);
        if (text === null) continue; // parity rules elsewhere report missing files
        const m = /(?:"verifiedOn"\s*:\s*"|Verified on )(\d{4}-\d{2}-\d{2})/.exec(text);
        if (!m) {
            fail(relPath, 1, 'verified-on-parity', `carries no "Verified on" stamp (manifest says ${manifest.verifiedOn})`);
        } else if (m[1] !== manifest.verifiedOn) {
            fail(relPath, lineOf(text, m.index), 'verified-on-parity', `stamped ${m[1]} but the manifest was verified on ${manifest.verifiedOn}`);
        }
    }

    // ── Rule: prose-language ──────────────────────────────────────
    {
        const releaseNotes = walk(join(root, 'release-notes'), (p) => p.endsWith('.md'));
        for (const file of [...new Set([...DOC_FILES, ...releaseNotes])]) {
            const text = texts.get(file) ?? read(file);
            for (const finding of findNonEnglishProse(text, file, { suppress: 'verify-docs:allow prose-language' })) {
                fail(rel(file), finding.line, 'prose-language',
                    `${finding.reason}: "${finding.snippet}" — write it in English, or mark demonstrated content with \`demo-language: <tag> (reason)\` on or above the line`);
            }
        }
    }

    // ── Rule: npm-drift (--online only) ───────────────────────────
    if (options.online) {
        for (const [name, pkg] of Object.entries(manifest.packages)) {
            try {
                const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
                if (!res.ok) {
                    warn(MANIFEST_REL, 1, 'npm-drift', `registry returned ${res.status} for ${name}`);
                    continue;
                }
                const data = (await res.json()) as Record<string, Record<string, string> | string>;
                const published = data['version'] as string;
                if (published !== pkg.version) {
                    const docsBehind = semverLess(pkg.version, published);
                    const reportFn = options.strict && docsBehind ? fail : warn;
                    reportFn(MANIFEST_REL, 1, 'npm-drift', `${name} is ${published} on npm but the manifest says ${pkg.version}`);
                }
                if (pkg.pinField) {
                    const field = data[pkg.pinField] as Record<string, string> | undefined;
                    const actualPin = field?.['pdfnative'];
                    if (actualPin && actualPin !== pkg.pin) {
                        const reportFn = options.strict ? fail : warn;
                        reportFn(MANIFEST_REL, 1, 'npm-drift', `${name} pins pdfnative ${actualPin} but the manifest says ${pkg.pin}`);
                    }
                }
            } catch (err) {
                warn(MANIFEST_REL, 1, 'npm-drift', `could not reach the registry for ${name}: ${(err as Error).message}`);
            }
        }
    }

    return { problems, rules: OFFLINE_RULES, files: DOC_FILES.length, verifiedOn: manifest.verifiedOn ?? null };
}

// ── CLI ─────────────────────────────────────────────────────────────

async function main(): Promise<number> {
    const root = resolve(import.meta.dirname, '..');
    const online = process.argv.includes('--online');
    const strict = process.argv.includes('--strict');
    const jsonOut = process.argv.includes('--json');
    const { problems, rules, files, verifiedOn } = await verifyDocs(root, { online, strict });
    const errors = problems.filter((p) => p.severity === 'error');
    const warnings = problems.filter((p) => p.severity === 'warn');

    if (jsonOut) {
        console.log(JSON.stringify(problems, null, 2));
        return errors.length > 0 ? 1 : 0;
    }
    if (errors.length === 0) {
        const perRule = new Map<string, number>();
        for (const w of warnings) perRule.set(w.rule, (perRule.get(w.rule) ?? 0) + 1);
        const suffix = warnings.length === 0
            ? ''
            : ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'}: ${[...perRule.entries()].map(([r, n]) => `${r} ×${n}`).join(', ')})`;
        console.log(`verify-docs: ${rules.length} rules passed across ${files} files${suffix}.`);
        console.log(`             source of truth: ${MANIFEST_REL} (verified ${verifiedOn ?? '?'})`);
        return 0;
    }
    // On failure, list the errors only: warnings (a scoped rule over budget, npm drift under
    // --online) would bury them. They stay in --json and in the summary count.
    const byFile = new Map<string, Problem[]>();
    for (const p of errors) {
        if (!byFile.has(p.file)) byFile.set(p.file, []);
        byFile.get(p.file)!.push(p);
    }
    for (const [file, list] of [...byFile.entries()].sort()) {
        console.log(`\n${file}`);
        for (const p of list.sort((a, b) => a.line - b.line)) {
            console.log(`  ${p.severity === 'error' ? '✗' : '!'} ${String(p.line).padStart(5)}  [${p.rule}]  ${p.message}`);
        }
    }
    const ruleSet = new Set(errors.map((p) => p.rule));
    console.log(
        `\nverify-docs: ${errors.length} problem${errors.length === 1 ? '' : 's'} in ${byFile.size} file${byFile.size === 1 ? '' : 's'} (${ruleSet.size} rule${ruleSet.size === 1 ? '' : 's'})` +
            (warnings.length > 0 ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''),
    );
    console.log(`             fix the docs, or update ${MANIFEST_REL} if the manifest is what is wrong.`);
    return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    process.exit(await main());
}
