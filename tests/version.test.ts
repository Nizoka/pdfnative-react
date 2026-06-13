import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { version } from '../src/index.js';

describe('version', () => {
    it('stays in sync with package.json', async () => {
        const pkgPath = join(process.cwd(), 'package.json');
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version: string };
        expect(version).toBe(pkg.version);
    });
});
