/**
 * Re-export of the shared Draft 2020-12 subset validator (scripts/lib is the
 * one implementation; the schema-superset, colour and typography suites use it
 * through this path, tests/tools/json-schema-lite.test.ts pins it directly).
 */
export { validate, type Json } from '../../scripts/lib/json-schema-lite.js';
