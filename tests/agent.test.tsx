/**
 * The agent surface: error taxonomy, capability manifest, pre-flight and
 * structural validation.
 *
 * The manifest assertions are the load-bearing ones — they check that every
 * name the manifest advertises is a real export of the public barrel, which is
 * what stops the manifest from drifting into fiction.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as barrel from '../src/index.js';
import {
    Document,
    ErrorCode,
    PdfReactError,
    PdfStructureError,
    capabilityManifest,
    compileDocument,
    doctor,
    toErrorEnvelope,
    validateSpec,
} from '../src/index.js';
import { PdfStructureError as PdfStructureErrorFromSerialize } from '../src/reconciler/serialize.js';

describe('error taxonomy', () => {
    it('exposes every stable code', () => {
        expect(Object.values(ErrorCode)).toEqual([
            'E_STRUCTURE',
            'E_INPUT',
            'E_UNSUPPORTED',
            'E_ENV',
            'E_POLICY',
            'E_RUNTIME',
        ]);
    });

    it('PdfStructureError carries E_STRUCTURE and stays an Error', () => {
        const err = new PdfStructureError('bad tree');
        expect(err.code).toBe(ErrorCode.STRUCTURE);
        expect(err).toBeInstanceOf(PdfReactError);
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('PdfStructureError');
        expect(err.message).toBe('bad tree');
    });

    it('is the same class object on the legacy import path', () => {
        // Moving the class to src/errors.ts must not break `instanceof` for
        // anyone importing it from its original definition site.
        expect(PdfStructureErrorFromSerialize).toBe(PdfStructureError);
        expect(new PdfStructureErrorFromSerialize('x')).toBeInstanceOf(PdfStructureError);
    });

    it('serializes to the ecosystem error envelope', () => {
        expect(new PdfStructureError('nope').toJSON()).toEqual({
            ok: false,
            error: { code: 'E_STRUCTURE', message: 'nope' },
        });
    });

    it('wraps arbitrary thrown values into the same envelope', () => {
        expect(toErrorEnvelope(new Error('boom'))).toEqual({
            ok: false,
            error: { code: 'E_RUNTIME', message: 'boom' },
        });
        expect(toErrorEnvelope('plain string')).toEqual({
            ok: false,
            error: { code: 'E_RUNTIME', message: 'plain string' },
        });
    });

    it('is what a real structural failure throws', () => {
        try {
            compileDocument(<Document />);
            compileDocument('not a document');
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(PdfStructureError);
            expect(toErrorEnvelope(err).error.code).toBe('E_STRUCTURE');
        }
    });
});

describe('capabilityManifest', () => {
    const manifest = capabilityManifest();

    it('identifies itself and pins the contract', () => {
        expect(manifest.kind).toBe('capability-manifest');
        expect(manifest.name).toBe('pdfnative-react');
        expect(manifest.version).toBe(barrel.version);
        expect(manifest.contract.authoringOnly).toBe(true);
        expect(manifest.contract.layoutModel).toBe('block-flow');
        expect(manifest.contract.engine).toBe('^1.6.0');
        expect(manifest.contract.network).toBe('none');
    });

    it('advertises only entry points that really exist in the barrel', () => {
        for (const entry of manifest.entrypoints) {
            expect(barrel, `entrypoint ${entry.name}`).toHaveProperty(entry.name);
            expect(typeof (barrel as Record<string, unknown>)[entry.name]).toBe('function');
        }
    });

    it('advertises EVERY callable the barrel exports — the direction that matters', () => {
        // A manifest that claims to describe "everything this package can do"
        // while omitting part of the API is worse than none, because an agent
        // trusts it. This is the reverse of the check above.
        const named = new Set([
            ...manifest.entrypoints.map((e) => e.name),
            ...manifest.components.flatMap((c) => [c.name, ...(c.aliases ?? [])]),
            ...manifest.clientComponents.map((c) => c.name),
            ...manifest.errorClasses,
        ]);

        const exported = Object.entries(barrel)
            .filter(([, value]) => typeof value === 'function')
            .map(([name]) => name);

        const undocumented = exported.filter((name) => !named.has(name));
        expect(undocumented, `undocumented exports: ${undocumented.join(', ')}`).toEqual([]);
    });

    it('lists the client components and error classes it claims', () => {
        expect(manifest.clientComponents.map((c) => c.name)).toEqual([
            'PDFViewer',
            'PDFDownloadLink',
            'BlobProvider',
        ]);
        expect(manifest.errorClasses).toEqual(['PdfReactError', 'PdfStructureError']);
    });

    it('names both import specifiers, so an agent can discover the client subpath', () => {
        // Without this the manifest describes components it gives no way to
        // import: `PDFViewer` is not on the root barrel's documented RSC path.
        expect(manifest.contract.entry).toBe('pdfnative-react');
        expect(manifest.contract.clientEntry).toBe('pdfnative-react/client');
        expect(manifest.contract.reactServerCondition).toBe('unsupported');
        for (const c of manifest.clientComponents) {
            expect(c.importFrom).toBe('pdfnative-react/client');
        }
    });

    it('advertises a client entry that matches the package exports map', async () => {
        const pkg = JSON.parse(
            await readFile(join(process.cwd(), 'package.json'), 'utf8'),
        ) as { exports: Record<string, unknown> };

        const subpath = manifest.contract.clientEntry.replace('pdfnative-react', '.');
        expect(Object.keys(pkg.exports)).toContain(subpath);
    });

    it('advertises only components that really exist in the barrel', () => {
        for (const component of manifest.components) {
            expect(barrel, `component ${component.name}`).toHaveProperty(component.name);
            for (const alias of component.aliases ?? []) {
                expect(barrel, `alias ${alias}`).toHaveProperty(alias);
            }
        }
    });

    it('describes the whole DocSpec grammar, chart included', () => {
        const kinds = manifest.specBlocks.flatMap((b) => b.kinds);
        expect(kinds).toContain('chart');
        expect(kinds).toContain('h1');
        expect(kinds).toContain('field');
        expect(manifest.specBlocks.every((b) => b.tuple.startsWith('['))).toBe(true);
    });

    it('carries the error codes and lint rules an agent branches on', () => {
        expect(manifest.errorCodes).toEqual(Object.values(ErrorCode));
        expect(manifest.lintRules.map((r) => r.code)).toEqual([...barrel.LINT_RULE_CODES]);
    });

    it('points at its own versioned schema', () => {
        expect(manifest.schemaId).toBe(
            `https://pdfnative.dev/schema/react/${barrel.version}/manifest.schema.json`,
        );
    });

    it('is JSON-serializable', () => {
        expect(() => JSON.stringify(manifest)).not.toThrow();
    });
});

describe('doctor', () => {
    const report = doctor();

    it('never throws and reports a stable check set', () => {
        expect(report.checks.map((c) => c.name)).toEqual([
            'pdfnative-react',
            'node',
            'react',
            'pdfnative',
            'web-crypto',
            'fetch-api',
            'blob',
        ]);
    });

    it('passes in this environment', () => {
        const failures = report.checks.filter((c) => c.status === 'error');
        expect(failures, JSON.stringify(failures)).toEqual([]);
        expect(report.ok).toBe(true);
    });

    it('detects the 1.6.0 engine through a capability probe', () => {
        const engine = report.checks.find((c) => c.name === 'pdfnative');
        expect(engine?.status).toBe('ok');
        expect(engine?.value).toBe('>= 1.6.0');
    });

    it('reports the installed package version', () => {
        expect(report.checks[0].value).toBe(barrel.version);
    });

    it('gives every check a non-empty detail', () => {
        for (const c of report.checks) expect(c.detail.length).toBeGreaterThan(0);
    });
});

describe('validateSpec', () => {
    it('accepts a well-formed spec', () => {
        const result = validateSpec({
            title: 'Invoice',
            blocks: [
                ['h1', 'Invoice'],
                ['p', 'Thanks.', { align: 'right' }],
                ['chart', { chartType: 'bar', series: [{ label: 'A', values: [1] }] }],
            ],
        });
        expect(result).toEqual({ ok: true, errors: [], warnings: [] });
    });

    it('rejects a non-object', () => {
        const result = validateSpec('nope');
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe('V_NOT_OBJECT');
    });

    it('requires blocks to be an array', () => {
        const result = validateSpec({ title: 'x' });
        expect(result.errors.map((e) => e.code)).toEqual(['V_BLOCKS']);
        expect(result.errors[0].path).toBe('blocks');
    });

    it('rejects an unknown block kind and lists the valid ones', () => {
        const result = validateSpec({ blocks: [['h4', 'nope']] });
        expect(result.errors[0].code).toBe('V_UNKNOWN_KIND');
        expect(result.errors[0].path).toBe('blocks[0][0]');
        expect(result.errors[0].message).toContain('chart');
    });

    it('enforces tuple arity from the registry', () => {
        const result = validateSpec({ blocks: [['link', 'text']] });
        expect(result.errors[0].code).toBe('V_ARITY');
        expect(result.errors[0].message).toContain('3 elements');
    });

    it('enforces payload types', () => {
        const result = validateSpec({ blocks: [['p', 42]] });
        expect(result.errors[0].code).toBe('V_PAYLOAD_TYPE');
        expect(result.errors[0].path).toBe('blocks[0][1]');
        expect(result.errors[0].message).toContain('a string');
    });

    it('rejects a non-object options element', () => {
        const result = validateSpec({ blocks: [['p', 'text', 'oops']] });
        expect(result.errors[0].code).toBe('V_OPTS_TYPE');
        expect(result.errors[0].path).toBe('blocks[0][2]');
    });

    it('recurses into page groups with an accurate path', () => {
        const result = validateSpec({ blocks: [['page', [['h1', 'ok'], ['nope', 'x']]]] });
        expect(result.errors[0].code).toBe('V_UNKNOWN_KIND');
        expect(result.errors[0].path).toBe('blocks[0][1][1][0]');
    });

    it('warns — but does not fail — on an unknown top-level field', () => {
        const result = validateSpec({ blocks: [], somethingNew: true });
        expect(result.ok).toBe(true);
        expect(result.warnings[0].code).toBe('V_UNKNOWN_FIELD');
        expect(result.warnings[0].path).toBe('somethingNew');
    });

    it('accepts every layout-sugar field as known', () => {
        const result = validateSpec({
            watermark: 'DRAFT',
            header: { center: 'x' },
            footer: { right: 'y' },
            attachments: [],
            tagged: 'pdfa2b',
            blocks: [],
        });
        expect(result.warnings).toEqual([]);
    });

    it('never throws on hostile input', () => {
        for (const input of [null, undefined, 0, [], { blocks: [null, 1, [], ['br', 'x']] }]) {
            expect(() => validateSpec(input)).not.toThrow();
        }
    });

    it('bounds page nesting instead of exhausting the call stack', () => {
        // validateSpec is the gate for untrusted input. Before the depth bound, a
        // ~44 kB payload took the process down with a RangeError — while the
        // JSDoc promised it never throws, so callers write `if (!ok)`, not
        // try/catch.
        let spec: { blocks: unknown[] } = { blocks: [['p', 'leaf']] };
        for (let i = 0; i < 5000; i += 1) spec = { blocks: [['page', spec.blocks]] };

        let result: ReturnType<typeof validateSpec> | undefined;
        expect(() => {
            result = validateSpec(spec);
        }).not.toThrow();

        expect(result?.ok).toBe(false);
        expect(result?.errors.some((e) => e.code === 'V_TOO_DEEP')).toBe(true);
    });

    it('accepts legitimate nesting well below the bound', () => {
        let spec: { blocks: unknown[] } = { blocks: [['p', 'leaf']] };
        for (let i = 0; i < 5; i += 1) spec = { blocks: [['page', spec.blocks]] };
        expect(validateSpec(spec).ok).toBe(true);
    });

    it('rejects Object.prototype keys as schema subjects', () => {
        // schema() is the one API designed to be called with a model-generated
        // string. A plain-object lookup resolves 'toString' through the
        // prototype chain and returns something that is not a schema at all.
        for (const key of ['toString', 'constructor', 'valueOf', '__proto__', 'hasOwnProperty']) {
            expect(() => barrel.schema(key as never), key).toThrowError(
                /Unknown schema subject/,
            );
        }
    });

    it('does not hand out a live reference to the lint registry', () => {
        const before = barrel.LINT_RULES.L_IMAGE_ALT.severity;
        const doc = barrel.schema('lint-report') as {
            $defs: { rules: { const: Record<string, { severity: string }> } };
        };
        doc.$defs.rules.const['L_IMAGE_ALT'].severity = 'error';
        expect(barrel.LINT_RULES.L_IMAGE_ALT.severity).toBe(before);
    });
});
