/**
 * Capability discovery — register pdfnative-react as an agent tool set.
 *
 * Run with: npx tsx samples/agent/manifest.ts
 * Prints the manifest; writes nothing.
 *
 * One call describes everything the package can do, as plain JSON: components,
 * the full DocSpec grammar, callable entry points, error codes and lint rules.
 * Every field is derived from the same registries that build the JSON Schema,
 * so the manifest cannot describe capabilities that do not exist — a test
 * asserts every name resolves to a real export.
 */

import { capabilityManifest, schema } from '../../src/index.js';

const manifest = capabilityManifest();

// The whole thing, for piping into a tool-registration step:
//   npx tsx samples/agent/manifest.ts > manifest.json
if (process.argv.includes('--json')) {
    console.log(JSON.stringify(manifest, null, 2));
    process.exit(0);
}

console.log(`${manifest.name} ${manifest.version}`);
console.log(`schema: ${manifest.schemaId}\n`);

console.log('Contract');
for (const [key, value] of Object.entries(manifest.contract)) {
    console.log(`  ${key.padEnd(14)} ${String(value)}`);
}

console.log('\nDocSpec grammar');
for (const block of manifest.specBlocks) {
    console.log(`  ${block.tuple}`);
    console.log(`      ${block.summary}`);
    console.log(`      JSX: <${block.component}>`);
}

console.log('\nEntry points');
for (const entry of manifest.entrypoints) {
    const tags = [entry.kind, entry.nodeOnly === true ? 'node-only' : null]
        .filter((t) => t !== null)
        .join(', ');
    console.log(`  ${entry.name}${entry.signature}  [${tags}]`);
    console.log(`      ${entry.summary}`);
}

console.log('\nComponents');
console.log(
    '  ' +
        manifest.components
            .map((c) => (c.aliases === undefined ? c.name : `${c.name} (${c.aliases.join(', ')})`))
            .join(', '),
);

console.log('\nError codes');
console.log('  ' + manifest.errorCodes.join(', '));

console.log('\nLint rules');
for (const rule of manifest.lintRules) {
    console.log(`  ${rule.severity.padEnd(7)} ${rule.code.padEnd(20)} ${rule.description}`);
}

console.log('\nSchema subjects');
for (const subject of manifest.schemaSubjects) {
    console.log(`  ${subject.padEnd(16)} ${String(schema(subject)['title'])}`);
}
