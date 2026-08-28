/**
 * Font convenience helpers.
 *
 * `resolveFonts` turns a map of language → dynamic font loader into the
 * concrete `FontEntry[]` the render pipeline consumes, so callers don't have
 * to hand-wire `registerFonts` + `loadFontData` + entry objects themselves.
 * Font data loads asynchronously, which is why the synchronous render entry
 * points (`renderToBytes`, `renderToBlob`, `renderToStream`) take resolved
 * `fontEntries` while the async surfaces accept a `fonts` map directly.
 *
 * @packageDocumentation
 */

import { loadFontData, registerFonts } from './core-bridge/index.js';
import type { FontEntry, FontsMap, RenderOptions } from './types.js';

/**
 * Register the given font loaders and resolve them into `FontEntry[]`.
 *
 * Each key is a language/script identifier understood by the engine's
 * font-fallback logic (e.g. `'ar'`, `'math'`, `'emoji'`); each value is a
 * dynamic loader, typically `() => import('pdfnative/fonts/…-data.js')`.
 * Loaders that yield no font data are skipped.
 *
 * @example
 * ```ts
 * const fontEntries = await resolveFonts({
 *     math: () => import('pdfnative/fonts/noto-sans-math-data.js'),
 * });
 * const bytes = renderToBytes(doc, { fontEntries });
 * ```
 */
export async function resolveFonts(fonts: FontsMap): Promise<FontEntry[]> {
    // The engine's `registerFonts` types its loaders more strictly than the
    // auto-generated font modules actually satisfy under `strict` (see the
    // note on `FontLoader`). We accept the ergonomic `() => import(...)` form
    // and widen to the engine's loader type in this one contained spot.
    registerFonts(fonts as Parameters<typeof registerFonts>[0]);
    const entries: FontEntry[] = [];
    for (const lang of Object.keys(fonts)) {
        const fontData = await loadFontData(lang);
        // `fontRef` is written verbatim into content streams as a PDF *name*
        // (`BT /latin 10 Tf`), so it must carry the leading slash — a bare
        // `latin` emits a keyword where ISO 32000 requires a name, and the
        // whole file is malformed for conforming readers. Map keys stay
        // slash-free (they are language identifiers); normalize here.
        if (fontData) {
            const fontRef = lang.startsWith('/') ? lang : `/${lang}`;
            entries.push({ fontData, fontRef, lang });
        }
    }
    return entries;
}

const resolvedCache = new WeakMap<FontsMap, Promise<FontEntry[]>>();

/**
 * {@link resolveFonts}, memoized per `fonts` object identity. Used by the
 * hooks so a stable options object does not re-load font data on every
 * render. Internal — not part of the public barrel.
 */
export function resolveFontsCached(fonts: FontsMap): Promise<FontEntry[]> {
    let pending = resolvedCache.get(fonts);
    if (!pending) {
        pending = resolveFonts(fonts);
        resolvedCache.set(fonts, pending);
    }
    return pending;
}

/**
 * Resolve `options.fonts` into concrete `fontEntries` (appended after any
 * explicit entries). Returns the options untouched when no `fonts` map is
 * present, keeping the common path synchronous. Internal — shared by the
 * async render entry points and the hooks.
 */
export async function optionsWithFonts(
    options?: RenderOptions,
): Promise<RenderOptions | undefined> {
    if (!options?.fonts) return options;
    const resolved = await resolveFontsCached(options.fonts);
    return { ...options, fontEntries: [...(options.fontEntries ?? []), ...resolved] };
}
