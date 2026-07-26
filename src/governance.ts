/**
 * AI-governance contract, shipped as runtime capability.
 *
 * Until 1.1.0 the human-in-the-loop policy existed only as repository files and
 * a dev-only script — so an agent that installed the package from npm could not
 * read the rules it was expected to follow. These exports close that gap: the
 * policy, the protocol text and the draft validator now travel with the
 * package, exactly as `pdfnative govern rules|policy|verify-issue` does for the
 * CLI.
 *
 * **The one rule:** nothing here — nothing anywhere in this package — writes to
 * GitHub or makes an outbound network call. {@link validateIssueDraft} is a
 * pure string function. An agent's authority ends at producing a local draft
 * plus a compliance report; a human reviews and submits it under their own
 * identity.
 *
 * @see `.github/AGENT_RULES.md` — the agent-facing protocol
 * @see `.github/ai-governance.json` — the repository's machine-readable twin
 * @see `docs/AI_GOVERNANCE.md` — the narrative walk-through
 *
 * @packageDocumentation
 */

import { ErrorCode, type ErrorCodeValue } from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Validation
//
// The regex tables below are deliberately duplicated in
// `scripts/verify-issue.mjs`, which must stay zero-dependency and runnable with
// no build step (CI and `tests/governance.test.ts` shell out to it directly, in
// a checkout that has never been compiled). `tests/governance.test.ts` parses
// that script's source and asserts both tables are byte-identical to these, so
// the duplication cannot silently drift.
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that indicate an external runtime dependency is being proposed. */
const DEPENDENCY_PATTERNS: readonly RegExp[] = [
    /\bnpm\s+(install|i|add)\s+(?!--)[a-z@]/i,
    /\b(yarn|pnpm|bun)\s+add\s+/i,
    /\bpnpm\s+install\s+[a-z@]/i,
    /add\s+[`"']?[\w@/-]+[`"']?\s+to\s+(the\s+)?(runtime\s+)?dependencies\b/i,
    // Matches a `"dependencies": {` block whose first content is a quoted key —
    // what an actual dependency addition looks like.
    //
    // The previous form was `\{[^}]*[\w-]+[^}]*\}`. Because `[\w-]` is a subset
    // of `[^}]`, the engine had ambiguous ways to split the input and degraded
    // to quadratic backtracking: on `"dependencies":{` followed by n hyphens and
    // no closing brace, it took 3.5 ms at n=100, 225 ms at n=800, and over two
    // minutes at n=2000 (CodeQL js/polynomial-redos). `validateIssueDraft` is a
    // public export that takes untrusted markdown, so that was reachable.
    //
    // This form has one unbounded quantifier with a deterministic follow, so it
    // is linear — and it is stricter: an empty `"dependencies": {}` shown in
    // prose no longer trips the policy check.
    /"dependencies"\s*:\s*\{\s*"/i,
];

/** Required issue fields (advisory — surfaced as warnings when missing). */
const REQUIRED_FIELDS: readonly { readonly key: string; readonly re: RegExp }[] = [
    { key: 'minimal_reproduction', re: /repro|reproduc/i },
    { key: 'environment', re: /environment|version|node|os\b/i },
    { key: 'expected_behavior', re: /expected/i },
];

/** The outcome of validating a draft against the governance policy. */
export interface GovernanceValidation {
    /** `true` when no blocking policy violation was found. */
    readonly ok: boolean;
    /** Blocking violations. A human must resolve these before submission. */
    readonly errors: readonly string[];
    /** Non-blocking advisories, e.g. a missing recommended field. */
    readonly warnings: readonly string[];
    /** The error code to report when `ok` is `false`. */
    readonly code?: ErrorCodeValue;
}

/**
 * Validate the markdown of a draft issue or pull request against the policy.
 *
 * Pure: no filesystem, no network, no exceptions.
 *
 * @param markdown - Raw markdown of the draft.
 *
 * @example
 * ```ts
 * const result = validateIssueDraft(draft);
 * if (!result.ok) throw new PdfReactError(result.errors.join(' '), result.code);
 * ```
 */
export function validateIssueDraft(markdown: string): GovernanceValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const re of DEPENDENCY_PATTERNS) {
        if (re.test(markdown)) {
            errors.push(
                'Proposing an external runtime dependency violates the minimal-dependency policy.',
            );
            break;
        }
    }

    if (!/```[\s\S]*?```/.test(markdown)) {
        errors.push(
            'No reproduction code block found — include a minimal repro inside a fenced ``` block.',
        );
    }

    for (const field of REQUIRED_FIELDS) {
        if (!field.re.test(markdown)) {
            warnings.push(`Recommended field appears to be missing: ${field.key}.`);
        }
    }

    const ok = errors.length === 0;
    return ok ? { ok, errors, warnings } : { ok, errors, warnings, code: ErrorCode.POLICY };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy
// ─────────────────────────────────────────────────────────────────────────────

/** The machine-readable governance policy. Mirrors `.github/ai-governance.json`. */
export interface AiGovernancePolicy {
    readonly version: string;
    readonly appliesTo: readonly string[];
    readonly policy: {
        readonly automaticIssueReporting: false;
        readonly runtimeDependenciesAllowed: false;
        readonly humanInTheLoopMandatory: true;
        readonly autonomousGithubWritesAllowed: false;
        readonly outboundNetworkAllowed: false;
        readonly telemetryAllowed: false;
        readonly requiredIssueFields: readonly string[];
    };
    readonly humanInTheLoop: {
        readonly roleOfAgent: 'draftsman';
        readonly gate: string;
        readonly identityIntegrity: string;
        readonly draftLocation: string;
    };
    readonly preIssueChecklist: readonly string[];
    readonly complianceReportFields: readonly string[];
    readonly verification: {
        readonly command: string;
        readonly api: string;
        readonly blocksSubmissionOnFailure: true;
    };
}

/**
 * The governance policy this package enforces, as plain JSON.
 *
 * An agent should read this before proposing any change, and must present a
 * compliance report covering {@link AiGovernancePolicy.complianceReportFields}
 * alongside every draft.
 */
export function aiGovernancePolicy(): AiGovernancePolicy {
    return {
        version: '1.1.0',
        appliesTo: ['pdfnative', 'pdfnative-cli', 'pdfnative-mcp', 'pdfnative-react'],
        policy: {
            automaticIssueReporting: false,
            runtimeDependenciesAllowed: false,
            humanInTheLoopMandatory: true,
            autonomousGithubWritesAllowed: false,
            outboundNetworkAllowed: false,
            telemetryAllowed: false,
            requiredIssueFields: ['minimal_reproduction', 'environment', 'expected_behavior'],
        },
        humanInTheLoop: {
            roleOfAgent: 'draftsman',
            gate:
                'A human MUST explicitly review, sign off on, and trigger any GitHub issue, '
                + "comment, PR, or release. The agent's authority ends at producing a local "
                + 'draft plus a compliance report. pdfnative-react contains NO code path that '
                + 'can write to GitHub or make any outbound network call.',
            identityIntegrity:
                "Any issue or PR is published under the human user's GitHub identity. The "
                + 'agent MUST remind the user of their shared responsibility for the content '
                + 'before submission.',
            draftLocation: '.github/drafts/',
        },
        preIssueChecklist: [
            'no_duplicate_open_or_closed_issue',
            'no_new_runtime_dependency',
            'local_minimal_reproduction_executed',
            'expected_vs_actual_documented',
            'environment_captured',
        ],
        complianceReportFields: [
            'no_new_runtime_dependency_confirmed',
            'reproduction_command',
            'reproduction_result',
            'duplicate_search_performed',
            'affected_packages',
            'identity_reminder_shown',
        ],
        verification: {
            command: 'npm run verify:issue -- .github/drafts/<draft>.md',
            api: 'validateIssueDraft(markdown)',
            blocksSubmissionOnFailure: true,
        },
    };
}

/**
 * The agent-facing protocol, as text.
 *
 * Mirrors `.github/AGENT_RULES.md` so an agent working against an installed
 * package — with no repository checkout — can still read the rules.
 */
export function agentRulesText(): string {
    return `# Rules for AI agents — pdfnative-react

You are a DRAFTSMAN, not a submitter. Your authority ends at a local draft
plus a compliance report. A human reviews and submits, under their own
GitHub identity.

## Mandatory before proposing anything

1. NO new runtime dependency. The only one is react-reconciler; pdfnative and
   react are peers. A proposal that adds one is rejected by policy.
2. NO duplicates. Search open AND closed issues first.
3. REPRODUCE locally. Include a minimal, runnable repro in a fenced code block.
4. KNOW the architecture. Read AGENTS.md and docs/KNOWLEDGE_BASE.md. Respect
   the eight golden rules — in particular: runtime pdfnative imports go only
   through src/core-bridge, there is no CSS layout model, and every authoring
   capability must reach BOTH the JSX props and the DocSpec grammar + schema.
5. AUTHORING ONLY. Byte-level post-processing (merge/split, annotations,
   signing, crypto, font compilation) belongs to the engine. See docs/RECIPES.md.
6. HUMAN IN THE LOOP. Never open, comment on, or merge anything autonomously.

## Workflow

    investigate -> reproduce -> draft into .github/drafts/
        -> validate (npm run verify:issue, or validateIssueDraft())
        -> present a compliance report
        -> ***HUMAN REVIEWS AND SUBMITS***   <- CRITICAL ETHICAL GATE

## What agents must NOT do

- Open, edit, comment on, or close issues or pull requests.
- Push branches, create releases, or publish to npm.
- Add a runtime dependency, or vendor code to avoid one.
- Make any outbound network call, or emit telemetry.
- Submit anything under a human's identity without their explicit sign-off.
`;
}
