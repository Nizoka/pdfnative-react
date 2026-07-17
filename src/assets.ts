/**
 * Asset helpers: obtain the raw image bytes `<Image data>` expects from
 * common sources (URLs, base64 payloads) without hand-rolling fetch/decode
 * boilerplate. Pure and isomorphic — no engine or Node-only imports.
 *
 * @packageDocumentation
 */

/**
 * Fetch a resource and return its bytes — e.g. a JPEG/PNG for `<Image data>`.
 * Works in Node (≥20) and the browser via the global `fetch`.
 *
 * @param url - The resource URL.
 * @param init - Optional `fetch` options (headers, signal…).
 * @throws Error when the response status is not OK.
 */
export async function fromUrl(url: string, init?: RequestInit): Promise<Uint8Array> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(
            `fromUrl: failed to fetch ${url} — ${response.status} ${response.statusText}`,
        );
    }
    return new Uint8Array(await response.arrayBuffer());
}

/**
 * Decode a base64 string (optionally a full `data:` URI) into bytes — e.g. an
 * inline PNG for `<Image data>`. Works in Node and the browser.
 *
 * @param base64 - Base64 payload, with or without a `data:*;base64,` prefix.
 */
export function fromBase64(base64: string): Uint8Array {
    const comma = base64.indexOf(',');
    const payload = base64.startsWith('data:') && comma !== -1
        ? base64.slice(comma + 1)
        : base64;

    if (typeof atob === 'function') {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }
    // Node < 16 lacks a global atob; fall back to Buffer without importing it.
    const BufferCtor = (globalThis as { Buffer?: { from(s: string, e: string): Uint8Array } })
        .Buffer;
    if (!BufferCtor) throw new Error('fromBase64: no base64 decoder available.');
    return new Uint8Array(BufferCtor.from(payload, 'base64'));
}
