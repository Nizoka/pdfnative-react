/**
 * A deliberately small JSON Schema (Draft 2020-12 subset) validator.
 *
 * It exists for one job: holding the DocSpec fixtures to the package's own
 * schemas — the frozen 1.2.0 one and the current one — inside the test suite,
 * with no network and no new dependency. It is NOT a general-purpose
 * validator, and it is built so that this limitation cannot turn into a
 * silent pass: a keyword it does not implement is reported as a failure, so a
 * schema revision that starts relying on one makes the check go red instead
 * of vacuous.
 *
 * Ported from pdfnative-mcp's `scripts/lib/json-schema-lite.ts`, plus the
 * Draft 2020-12 keywords this package's schemas use: `prefixItems` (the tuple
 * grammar), `exclusiveMinimum`, and `$defs` as a container.
 *
 * Annotations (`title`, `description`, `default`, `example(s)`, `$comment`,
 * `$id`, `$schema`, `format`) are accepted and ignored.
 */

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type Schema = { readonly [key: string]: Json };

const ANNOTATIONS = new Set([
    '$comment', '$id', '$schema', 'title', 'description', 'default', 'example', 'examples',
    'format', 'definitions', '$defs',
]);
const IMPLEMENTED = new Set([
    '$ref', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items',
    'prefixItems', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems', 'minimum',
    'maximum', 'exclusiveMinimum', 'uniqueItems', 'anyOf', 'oneOf', 'allOf', 'not',
]);

function isObject(v: Json | undefined): v is { readonly [key: string]: Json } {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeOf(v: Json): string {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
}

function matchesType(v: Json, t: string): boolean {
    const actual = typeOf(v);
    return actual === t || (t === 'number' && actual === 'integer');
}

function deepEqual(a: Json, b: Json): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Resolve a local `#/a/b` pointer against the root schema. */
function resolveRef(root: Schema, ref: string): Schema | null {
    if (!ref.startsWith('#/')) return null;
    let node: Json | undefined = root;
    for (const raw of ref.slice(2).split('/')) {
        const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
        if (!isObject(node)) return null;
        node = node[key];
    }
    return isObject(node) ? node : null;
}

/**
 * Validate `value` against `schema`. Returns the failure lines (JSON-pointer
 * style paths), empty when the value conforms.
 */
export function validate(value: Json, schema: Schema, root: Schema = schema, at = '$'): string[] {
    const errors: string[] = [];
    for (const keyword of Object.keys(schema)) {
        if (!ANNOTATIONS.has(keyword) && !IMPLEMENTED.has(keyword)) {
            errors.push(`${at}: schema keyword "${keyword}" is not implemented by json-schema-lite — extend it rather than skipping the check`);
        }
    }
    if (errors.length > 0) return errors;

    const ref = schema['$ref'];
    if (typeof ref === 'string') {
        const target = resolveRef(root, ref);
        if (target === null) return [`${at}: unresolvable $ref "${ref}" (only local pointers are supported)`];
        errors.push(...validate(value, target, root, at));
    }

    const type = schema['type'];
    if (typeof type === 'string' && !matchesType(value, type)) errors.push(`${at}: expected ${type}, got ${typeOf(value)}`);
    if (Array.isArray(type) && !type.some((t) => typeof t === 'string' && matchesType(value, t))) {
        errors.push(`${at}: expected one of ${type.join(' | ')}, got ${typeOf(value)}`);
    }

    const enumeration = schema['enum'];
    if (Array.isArray(enumeration) && !enumeration.some((e) => deepEqual(e, value))) {
        errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(enumeration)}`);
    }
    if ('const' in schema && !deepEqual(schema['const'] as Json, value)) {
        errors.push(`${at}: expected the constant ${JSON.stringify(schema['const'])}`);
    }

    if (typeof value === 'string') {
        const length = Array.from(value).length;
        const min = schema['minLength'];
        const max = schema['maxLength'];
        const pattern = schema['pattern'];
        if (typeof min === 'number' && length < min) errors.push(`${at}: shorter than minLength ${String(min)}`);
        if (typeof max === 'number' && length > max) errors.push(`${at}: longer than maxLength ${String(max)} (${String(length)})`);
        if (typeof pattern === 'string' && !new RegExp(pattern, 'u').test(value)) errors.push(`${at}: does not match pattern ${pattern}`);
    }

    if (typeof value === 'number') {
        const min = schema['minimum'];
        const max = schema['maximum'];
        const xmin = schema['exclusiveMinimum'];
        if (typeof min === 'number' && value < min) errors.push(`${at}: below minimum ${String(min)}`);
        if (typeof max === 'number' && value > max) errors.push(`${at}: above maximum ${String(max)}`);
        if (typeof xmin === 'number' && value <= xmin) errors.push(`${at}: not above exclusiveMinimum ${String(xmin)}`);
    }

    if (Array.isArray(value)) {
        const items = schema['items'];
        const prefix = schema['prefixItems'];
        const min = schema['minItems'];
        const max = schema['maxItems'];
        if (typeof min === 'number' && value.length < min) errors.push(`${at}: fewer than minItems ${String(min)}`);
        if (typeof max === 'number' && value.length > max) errors.push(`${at}: more than maxItems ${String(max)}`);
        if (schema['uniqueItems'] === true && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) {
            errors.push(`${at}: items are not unique`);
        }
        let from = 0;
        if (Array.isArray(prefix)) {
            prefix.forEach((sub, i) => {
                if (i < value.length && isObject(sub)) errors.push(...validate(value[i], sub, root, `${at}[${String(i)}]`));
            });
            from = prefix.length;
        }
        if (isObject(items)) {
            value.forEach((v, i) => {
                if (i >= from) errors.push(...validate(v, items, root, `${at}[${String(i)}]`));
            });
        } else if (items !== undefined) {
            errors.push(`${at}: tuple-form "items" is not implemented by json-schema-lite`);
        }
    }

    if (isObject(value)) {
        const required = schema['required'];
        if (Array.isArray(required)) {
            for (const key of required) {
                if (typeof key === 'string' && !(key in value)) errors.push(`${at}: missing required property "${key}"`);
            }
        }
        const properties = isObject(schema['properties']) ? schema['properties'] : {};
        for (const [key, sub] of Object.entries(properties)) {
            const child = value[key];
            if (child !== undefined && isObject(sub)) errors.push(...validate(child, sub, root, `${at}.${key}`));
        }
        const additional = schema['additionalProperties'];
        for (const [key, child] of Object.entries(value)) {
            if (key in properties) continue;
            if (additional === false) errors.push(`${at}: unexpected property "${key}"`);
            else if (isObject(additional)) errors.push(...validate(child, additional, root, `${at}.${key}`));
        }
    }

    const branches = (keyword: 'anyOf' | 'oneOf' | 'allOf'): Schema[] | null => {
        const list = schema[keyword];
        return Array.isArray(list) ? list.filter(isObject) : null;
    };
    const anyOf = branches('anyOf');
    if (anyOf !== null) {
        const results = anyOf.map((s) => validate(value, s, root, at));
        if (!results.some((r) => r.length === 0)) {
            errors.push(`${at}: matches none of the ${String(anyOf.length)} anyOf branches (closest: ${results.sort((a, b) => a.length - b.length)[0]?.[0] ?? 'n/a'})`);
        }
    }
    const oneOf = branches('oneOf');
    if (oneOf !== null) {
        const passing = oneOf.filter((s) => validate(value, s, root, at).length === 0).length;
        if (passing !== 1) errors.push(`${at}: matches ${String(passing)} of the ${String(oneOf.length)} oneOf branches, expected exactly 1`);
    }
    const allOf = branches('allOf');
    if (allOf !== null) for (const s of allOf) errors.push(...validate(value, s, root, at));
    const not = schema['not'];
    if (isObject(not) && validate(value, not, root, at).length === 0) errors.push(`${at}: matches the schema under "not"`);

    return errors;
}
