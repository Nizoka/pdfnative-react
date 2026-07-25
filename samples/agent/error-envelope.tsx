/**
 * The error taxonomy, and how to consume it.
 *
 * Run with: npx tsx samples/agent/error-envelope.ts
 * Prints envelopes; writes nothing.
 *
 * Every error carries a stable `code`. Branch on the code — messages are
 * reworded freely between releases, codes are not. `toJSON()` (and the
 * `toErrorEnvelope` helper, which accepts *any* thrown value) produces the same
 * envelope shape the CLI and MCP server emit:
 *
 *     { "ok": false, "error": { "code": "E_STRUCTURE", "message": "…" } }
 */

import React from 'react';
import {
    ErrorCode,
    Paragraph,
    PdfReactError,
    PdfStructureError,
    compileDocument,
    schema,
    toErrorEnvelope,
    validateSpec,
} from '../../src/index.js';

console.log('Stable codes:', Object.values(ErrorCode).join(', '));

/** Run a thunk and report it in the standard envelope. */
function attempt(label: string, thunk: () => unknown): void {
    try {
        thunk();
        console.log(`\n${label}\n  ${JSON.stringify({ ok: true })}`);
    } catch (err) {
        console.log(`\n${label}\n  ${JSON.stringify(toErrorEnvelope(err))}`);
    }
}

// E_STRUCTURE — the tree cannot be mapped onto the pdfnative model.
attempt('Root is not <Document>', () =>
    compileDocument(<Paragraph>I forgot the Document wrapper.</Paragraph>),
);

// E_STRUCTURE — a component used where a block was expected.
attempt('No <Document> in the tree at all', () => compileDocument('just a string'));

// E_INPUT — an unknown schema subject.
attempt('Unknown schema subject', () => schema('does-not-exist' as never));

// Non-PdfReactError throws are wrapped as E_RUNTIME, so a caller only ever
// handles one shape.
attempt('An unrelated failure', () => {
    throw new TypeError('something else went wrong');
});

// Branching on the code is the point.
try {
    compileDocument(<Paragraph>x</Paragraph>);
} catch (err) {
    if (err instanceof PdfReactError) {
        switch (err.code) {
            case ErrorCode.STRUCTURE:
                console.log('\nRecovery: wrap the tree in <Document> and retry.');
                break;
            case ErrorCode.ENV:
                console.log('\nRecovery: run doctor() and report the failing check.');
                break;
            default:
                console.log(`\nUnhandled code ${err.code}; escalate to a human.`);
        }
    }
    console.log('instanceof PdfStructureError:', err instanceof PdfStructureError);
}

// validateSpec never throws — malformed input becomes findings, so an agent can
// repair its own output instead of crashing.
const bad = validateSpec({ blocks: [['h9', 'nope'], ['p', 42], 'not a tuple'] });
console.log('\nvalidateSpec on malformed input:');
for (const e of bad.errors) console.log(`  ${e.code} at ${e.path}: ${e.message}`);
