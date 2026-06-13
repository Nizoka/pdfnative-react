/**
 * Agent schema sample — print the versioned DocSpec JSON Schema.
 *
 * Run with: npx tsx samples/agent/schema.ts
 *
 * Agents can fetch this schema to self-validate a `DocSpec` before rendering.
 * The `$id` embeds the package version so contract drift is detectable.
 */

import { docSpecSchema } from '../../src/index.js';

const schema = docSpecSchema();
console.log(`$id: ${String(schema.$id)}`);
console.log(JSON.stringify(schema, null, 2));
