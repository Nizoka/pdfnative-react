/**
 * The recommended agent loop, end to end.
 *
 * Run with: npx tsx samples/agent/agent-loop.ts
 * Writes `agent-loop.pdf` on success.
 *
 * This is the whole autonomous-usage contract in one file:
 *
 *   1. doctor()          — will this environment work at all?
 *   2. capabilityManifest() — what can I do here?
 *   3. schema('doc-spec')   — what grammar do I emit?
 *   4. validateSpec()    — is the JSON I produced well-formed?      (dry run 1)
 *   5. compileSpec()     — does it map onto the document model?     (dry run 2)
 *   6. lintSpec()        — is it accessible and engine-legal?       (dry run 3)
 *   7. renderSpecTo*()   — only now, produce bytes.
 *
 * Every step returns plain data. Nothing here reaches the network, writes to
 * GitHub, or emits telemetry — see aiGovernancePolicy().
 */

import {
    aiGovernancePolicy,
    capabilityManifest,
    compileSpec,
    doctor,
    lintSpec,
    renderSpecToFile,
    schema,
    toErrorEnvelope,
    validateSpec,
} from '../../src/index.js';
import type { DocSpec } from '../../src/index.js';

// ── 1. Pre-flight ────────────────────────────────────────────────────────────

const health = doctor();
console.log('doctor:', health.ok ? 'ok' : 'PROBLEMS');
for (const check of health.checks) {
    console.log(`  ${check.status.padEnd(5)} ${check.name.padEnd(16)} ${check.value}`);
}
if (!health.ok) {
    console.error('Environment is not usable; stopping before doing any work.');
    process.exit(1);
}

// ── 2. Discovery ─────────────────────────────────────────────────────────────

const manifest = capabilityManifest();
console.log(`\n${manifest.name} ${manifest.version} — ${String(manifest.specBlocks.length)} block kinds`);
console.log('  contract:', JSON.stringify(manifest.contract));
console.log('  entry points:', manifest.entrypoints.map((e) => e.name).join(', '));

// ── 3. Grammar ───────────────────────────────────────────────────────────────

console.log('\nschema subjects:', manifest.schemaSubjects.join(', '));
console.log('doc-spec $id:', schema('doc-spec')['$id']);

// ── 4. Validate what we generated (dry run, tier 1) ──────────────────────────

/** Pretend this arrived as JSON from a model. */
const generated: unknown = {
    title: 'Q4 revenue review',
    footer: { right: 'Page {page} of {pages}' },
    blocks: [
        ['h1', 'Q4 revenue review'],
        ['p', 'Revenue grew 24% year over year, led by the Direct channel.'],
        [
            'chart',
            {
                chartType: 'bar',
                series: [{ label: '2026', values: [15_400, 21_200, 29_800, 38_600] }],
                categories: ['Q1', 'Q2', 'Q3', 'Q4'],
                title: 'Revenue by quarter',
                altText: 'Revenue rises each quarter from 15.4k to 38.6k.',
            },
        ],
        ['table', { h: ['Channel', 'Share'], r: [['Direct', '46%'], ['Partners', '27%']] }],
    ],
};

const validation = validateSpec(generated);
console.log('\nvalidateSpec:', validation.ok ? 'ok' : 'INVALID');
for (const e of validation.errors) console.error(`  error ${e.code} at ${e.path}: ${e.message}`);
for (const w of validation.warnings) console.warn(`  warn  ${w.code} at ${w.path}: ${w.message}`);
if (!validation.ok) process.exit(1);

const spec = generated as DocSpec;

// ── 5 & 6. Compile and lint (dry runs, tiers 2 and 3) ────────────────────────

try {
    const model = compileSpec(spec);
    console.log(`compileSpec: ok — ${String(model.blocks.length)} blocks`);
} catch (err) {
    // Any failure serializes to the ecosystem's standard envelope.
    console.error('compileSpec:', JSON.stringify(toErrorEnvelope(err)));
    process.exit(1);
}

const lint = lintSpec(spec);
console.log(
    `lintSpec: ${lint.ok ? 'ok' : 'BLOCKED'} — ` +
        `${String(lint.counts.error)} error(s), ${String(lint.counts.warning)} warning(s), ` +
        `${String(lint.counts.info)} info`,
);
for (const f of lint.findings) console.log(`  ${f.severity} ${f.code}: ${f.message}`);
if (!lint.ok) {
    console.error('Blocking lint findings; fix the spec rather than rendering it.');
    process.exit(1);
}

// ── 7. Render ────────────────────────────────────────────────────────────────

await renderSpecToFile(spec, 'agent-loop.pdf');
console.log('\nWrote agent-loop.pdf');

// ── Governance reminder ──────────────────────────────────────────────────────

const policy = aiGovernancePolicy();
console.log(
    `\nGovernance: agent role is "${policy.humanInTheLoop.roleOfAgent}". ` +
        `Autonomous GitHub writes allowed: ${String(policy.policy.autonomousGithubWritesAllowed)}.`,
);
