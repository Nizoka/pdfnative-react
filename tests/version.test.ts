import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { capabilityManifest, schemaId, version } from '../src/index.js';

describe('version', () => {
    it('stays in sync with package.json', async () => {
        const pkgPath = join(process.cwd(), 'package.json');
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version: string };
        expect(version).toBe(pkg.version);
    });

    it('stays in sync with CITATION.cff', async () => {
        const cff = await readFile(join(process.cwd(), 'CITATION.cff'), 'utf8');
        const match = /^version:\s*(.+)$/m.exec(cff);
        expect(match?.[1].trim()).toBe(version);
    });

    it('drives the versioned schema $id', () => {
        expect(schemaId('doc-spec')).toBe(
            `https://pdfnative.dev/schema/react/${version}/doc-spec.schema.json`,
        );
    });

    it('is what the capability manifest reports', () => {
        expect(capabilityManifest().version).toBe(version);
    });
});

describe('engine contract', () => {
    it('declares pdfnative as a peer at ^1.7.0, never a dependency', async () => {
        const pkg = JSON.parse(
            await readFile(join(process.cwd(), 'package.json'), 'utf8'),
        ) as {
            peerDependencies: Record<string, string>;
            dependencies: Record<string, string>;
            engines: { node: string };
        };

        expect(pkg.peerDependencies['pdfnative']).toBe('^1.7.0');
        expect(pkg.dependencies).not.toHaveProperty('pdfnative');
        // The single runtime dependency, per golden rule 1.
        expect(Object.keys(pkg.dependencies)).toEqual(['react-reconciler']);
        // Inherited from the engine, which requires Node >= 22 as of 1.6.0.
        expect(pkg.engines.node).toBe('>=22');
    });

    it('ships llms.txt so agents can read the manifest from the tarball', async () => {
        const pkg = JSON.parse(
            await readFile(join(process.cwd(), 'package.json'), 'utf8'),
        ) as { files: string[] };
        expect(pkg.files).toContain('llms.txt');
    });
});
