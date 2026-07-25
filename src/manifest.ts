/**
 * Machine-readable capability manifest.
 *
 * One call tells an autonomous agent everything this package can do: which
 * components exist, which `DocSpec` tuples are valid, which entry points to
 * call, which error codes to branch on, and which lint rules can fire. It is
 * the discovery primitive — fetch it once, register pdfnative-react as a tool
 * set, then work from the schemas.
 *
 * Every field is **derived** from `./registry.js`, `./errors.js` and
 * `./spec/schema.js` rather than restated here, so the manifest cannot drift
 * from the implementation. A test additionally asserts that every name it
 * advertises resolves to a real export of the public barrel.
 *
 * @packageDocumentation
 */

import {
    BLOCK_REGISTRY,
    CLIENT_COMPONENT_REGISTRY,
    COMPONENT_REGISTRY,
    LINT_RULES,
    type LintRuleCode,
} from './registry.js';
import { ErrorCode, type ErrorCodeValue } from './errors.js';
import { SCHEMA_SUBJECTS, schemaId, type SchemaSubject } from './spec/schema.js';
import { version } from './version.js';

/** A component entry in the manifest. */
export interface ManifestComponent {
    readonly name: string;
    /** Host tag emitted, or `null` for the one composite (`<Section>`). */
    readonly tag: string | null;
    readonly summary: string;
    readonly aliases?: readonly string[];
}

/** A `DocSpec` block entry in the manifest. */
export interface ManifestBlock {
    /** Every tuple kind this entry covers. */
    readonly kinds: readonly string[];
    /** The tuple form, as written in a spec. */
    readonly tuple: string;
    readonly summary: string;
    /** The equivalent JSX component. */
    readonly component: string;
}

/** A callable entry point in the manifest. */
export interface ManifestEntrypoint {
    readonly name: string;
    readonly signature: string;
    readonly summary: string;
    /** `'sync'`, `'async'`, or `'stream'` for the generator-returning ones. */
    readonly kind: 'sync' | 'async' | 'stream';
    /** `true` when the function only runs under Node.js. */
    readonly nodeOnly?: boolean;
}

/** A lint rule entry in the manifest. */
export interface ManifestLintRule {
    readonly code: LintRuleCode;
    readonly severity: string;
    readonly description: string;
}

/** The full capability manifest. */
export interface CapabilityManifest {
    readonly kind: 'capability-manifest';
    readonly name: 'pdfnative-react';
    readonly version: string;
    /** `$id` of the manifest's own schema, so the shape is self-describing. */
    readonly schemaId: string;
    /** The invariants a caller can rely on. */
    readonly contract: {
        /** This package authors documents; it never post-processes PDF bytes. */
        readonly authoringOnly: true;
        /** Declarative block flow — there is no CSS/flexbox model and no `<View>`. */
        readonly layoutModel: 'block-flow';
        readonly react: string;
        readonly engine: string;
        readonly node: string;
        /** Where side effects can occur — nowhere, by design. */
        readonly sideEffects: 'none';
        /** Outbound network calls and telemetry are never made. */
        readonly network: 'none';
    };
    readonly components: readonly ManifestComponent[];
    /** Preview/download components. Client-side; they consume a document rather than describing one. */
    readonly clientComponents: readonly { readonly name: string; readonly summary: string }[];
    /** Error classes exported for `instanceof` checks. */
    readonly errorClasses: readonly string[];
    readonly specBlocks: readonly ManifestBlock[];
    readonly entrypoints: readonly ManifestEntrypoint[];
    readonly errorCodes: readonly ErrorCodeValue[];
    readonly lintRules: readonly ManifestLintRule[];
    readonly schemaSubjects: readonly SchemaSubject[];
}

/**
 * The callable surface — **every** exported function, not a curated subset.
 *
 * `tests/agent.test.tsx` locks it in *both* directions: every name here must be
 * a real export of `src/index.ts`, and every exported function of the barrel
 * must appear here. The second direction is the one that matters — a manifest
 * that claims to describe "everything this package can do" while omitting a
 * third of the API is worse than no manifest, because an agent trusts it.
 */
const ENTRYPOINTS: readonly ManifestEntrypoint[] = [
    {
        name: 'renderToBytes',
        signature: '(node, options?) => Uint8Array',
        summary: 'Render to raw PDF bytes. Works in Node and the browser.',
        kind: 'sync',
    },
    {
        name: 'renderToBlob',
        signature: '(node, options?) => Blob',
        summary: 'Render to an application/pdf Blob for download or preview.',
        kind: 'sync',
    },
    {
        name: 'renderToStream',
        signature: '(node, options?) => AsyncGenerator<Uint8Array>',
        summary: 'Page-by-page byte stream with constant memory.',
        kind: 'stream',
    },
    {
        name: 'renderToResponse',
        signature: '(node, options?) => Promise<Response>',
        summary:
            'Render straight to a web-standard Response — Next.js route handlers, '
            + 'Remix, Hono, Workers. Streams by default.',
        kind: 'async',
    },
    {
        name: 'renderToFile',
        signature: '(node, path, options?) => Promise<void>',
        summary: 'Render and write to a file.',
        kind: 'async',
        nodeOnly: true,
    },
    {
        name: 'renderToFileStream',
        signature: '(node, path, options?) => Promise<StreamToFileResult>',
        summary: 'Stream to a file with constant memory, preserving outline and page labels.',
        kind: 'async',
        nodeOnly: true,
    },
    {
        name: 'compileDocument',
        signature: '(node) => DocumentParams',
        summary: 'Compile the tree to the pdfnative model without rendering (dry-run tier 2).',
        kind: 'sync',
    },
    {
        name: 'inspectDocument',
        signature: '(node, options?) => LayoutInspection',
        summary: 'Report pagination and per-block geometry without rendering (dry-run tier 4).',
        kind: 'sync',
    },
    {
        name: 'lintDocument',
        signature: '(node, options?) => LintReport',
        summary:
            'Accessibility and layout findings, including engine constraints that would '
            + 'otherwise throw at render time (dry-run tier 3).',
        kind: 'sync',
    },
    {
        name: 'validateSpec',
        signature: '(spec: unknown) => SpecValidation',
        summary:
            'Structurally validate an untrusted DocSpec with no JSON-Schema engine '
            + '(dry-run tier 1).',
        kind: 'sync',
    },
    {
        name: 'compileSpec',
        signature: '(spec) => DocumentParams',
        summary: 'Compile a DocSpec to the pdfnative model.',
        kind: 'sync',
    },
    {
        name: 'specToElement',
        signature: '(spec) => ReactElement',
        summary: 'Turn a DocSpec into a <Document> tree for embedding in JSX.',
        kind: 'sync',
    },
    {
        name: 'renderSpecToBytes',
        signature: '(spec, options?) => Uint8Array',
        summary: 'Render a DocSpec to raw PDF bytes.',
        kind: 'sync',
    },
    {
        name: 'renderSpecToResponse',
        signature: '(spec, options?) => Promise<Response>',
        summary: 'Render a DocSpec straight to a web-standard Response.',
        kind: 'async',
    },
    {
        name: 'lintSpec',
        signature: '(spec, options?) => LintReport',
        summary: 'Lint a DocSpec. Identical rules to lintDocument.',
        kind: 'sync',
    },
    {
        name: 'inspectSpec',
        signature: '(spec, options?) => LayoutInspection',
        summary: 'Report how a DocSpec paginates, without rendering.',
        kind: 'sync',
    },
    {
        name: 'schema',
        signature: '(subject?) => JsonSchema',
        summary: 'Emit a versioned Draft 2020-12 schema. Start with schema("list").',
        kind: 'sync',
    },
    {
        name: 'capabilityManifest',
        signature: '() => CapabilityManifest',
        summary: 'This document — everything the package can do.',
        kind: 'sync',
    },
    {
        name: 'doctor',
        signature: '() => DoctorReport',
        summary: 'Environment pre-flight. Never throws. Call this first in a new environment.',
        kind: 'sync',
    },
    {
        name: 'resolveFonts',
        signature: '(map) => Promise<FontEntry[]>',
        summary: 'Register and load font modules in one step.',
        kind: 'async',
    },
    {
        name: 'renderSpecToBlob',
        signature: '(spec, options?) => Blob',
        summary: 'Render a DocSpec to an application/pdf Blob.',
        kind: 'sync',
    },
    {
        name: 'renderSpecToStream',
        signature: '(spec, options?) => AsyncGenerator<Uint8Array>',
        summary: 'Render a DocSpec to a constant-memory byte stream.',
        kind: 'stream',
    },
    {
        name: 'renderSpecToFile',
        signature: '(spec, path, options?) => Promise<void>',
        summary: 'Render a DocSpec and write it to a file.',
        kind: 'async',
        nodeOnly: true,
    },
    {
        name: 'renderSpecToFileStream',
        signature: '(spec, path, options?) => Promise<StreamToFileResult>',
        summary: 'Stream a DocSpec to a file with constant memory.',
        kind: 'async',
        nodeOnly: true,
    },
    {
        name: 'schemaId',
        signature: '(subject?) => string',
        summary: 'The versioned $id for a schema subject. Compare to detect contract drift.',
        kind: 'sync',
    },
    {
        name: 'docSpecSchema',
        signature: '() => JsonSchema',
        summary: 'Backward-compatible alias for schema("doc-spec").',
        kind: 'sync',
    },
    {
        name: 'docSpecSchemaId',
        signature: '() => string',
        summary: 'Backward-compatible alias for schemaId("doc-spec").',
        kind: 'sync',
    },
    {
        name: 'toErrorEnvelope',
        signature: '(err: unknown) => ErrorEnvelope',
        summary:
            'Normalise any thrown value to { ok: false, error: { code, message } }, so a '
            + 'caller only ever handles one shape.',
        kind: 'sync',
    },
    {
        name: 'fromUrl',
        signature: '(url, init?) => Promise<Uint8Array>',
        summary: 'Fetch image bytes for <Image>.',
        kind: 'async',
    },
    {
        name: 'fromBase64',
        signature: '(payload) => Uint8Array',
        summary: 'Decode base64 or a data: URI into image bytes for <Image>.',
        kind: 'sync',
    },
    {
        name: 'registerFont',
        signature: '(lang, loader) => void',
        summary: 'Register a single font-data loader with the engine.',
        kind: 'sync',
    },
    {
        name: 'registerFonts',
        signature: '(map) => void',
        summary: 'Register several font-data loaders with the engine.',
        kind: 'sync',
    },
    {
        name: 'loadFontData',
        signature: '(lang) => Promise<FontData>',
        summary: 'Load a previously registered font.',
        kind: 'async',
    },
    {
        name: 'validateFontData',
        signature: '(data) => FontValidationResult',
        summary: 'Opt-in structural check on a custom font module before embedding it.',
        kind: 'sync',
    },
    {
        name: 'initNodeCompression',
        signature: '() => void',
        summary: 'Enable zlib compression under Node.',
        kind: 'sync',
    },
    {
        name: 'downloadBlob',
        signature: '(blob, fileName) => void',
        summary: 'Trigger a browser download. Browser only.',
        kind: 'sync',
    },
    {
        name: 'usePdf',
        signature: '(element, options?) => UsePdfResult',
        summary: 'React hook: live blob-URL preview. Client only.',
        kind: 'sync',
    },
    {
        name: 'usePdfStream',
        signature: '(element, options?) => UsePdfStreamResult',
        summary: 'React hook: stream factory. Client only.',
        kind: 'sync',
    },
    {
        name: 'validateIssueDraft',
        signature: '(markdown) => GovernanceValidation',
        summary: 'Gate an AI-authored issue/PR draft against the governance policy.',
        kind: 'sync',
    },
    {
        name: 'aiGovernancePolicy',
        signature: '() => AiGovernancePolicy',
        summary: 'The machine-readable human-in-the-loop policy this repo enforces.',
        kind: 'sync',
    },
    {
        name: 'agentRulesText',
        signature: '() => string',
        summary: 'The agent-facing protocol as text, for use without a repository checkout.',
        kind: 'sync',
    },
];

/**
 * Describe everything this package can do, as plain JSON.
 *
 * @example
 * ```ts
 * const m = capabilityManifest();
 * m.specBlocks.map((b) => b.tuple);   // the whole DocSpec grammar
 * m.entrypoints.filter((e) => !e.nodeOnly);
 * ```
 */
export function capabilityManifest(): CapabilityManifest {
    return {
        kind: 'capability-manifest',
        name: 'pdfnative-react',
        version,
        schemaId: schemaId('manifest'),
        contract: {
            authoringOnly: true,
            layoutModel: 'block-flow',
            react: '^19.0.0',
            engine: '^1.6.0',
            node: '>=22',
            sideEffects: 'none',
            network: 'none',
        },
        components: COMPONENT_REGISTRY.map((c) => ({
            name: c.name,
            tag: c.tag,
            summary: c.summary,
            ...('aliases' in c ? { aliases: c.aliases } : {}),
        })),
        clientComponents: CLIENT_COMPONENT_REGISTRY.map((c) => ({
            name: c.name,
            summary: c.summary,
        })),
        errorClasses: ['PdfReactError', 'PdfStructureError'],
        specBlocks: BLOCK_REGISTRY.map((b) => ({
            kinds: [...b.kinds],
            tuple: b.tuple,
            summary: b.summary,
            component: b.component,
        })),
        entrypoints: ENTRYPOINTS,
        errorCodes: Object.values(ErrorCode),
        lintRules: (Object.keys(LINT_RULES) as LintRuleCode[]).map((code) => ({
            code,
            severity: LINT_RULES[code].severity,
            description: LINT_RULES[code].description,
        })),
        schemaSubjects: [...SCHEMA_SUBJECTS],
    };
}
