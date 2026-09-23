// Markdown heading anchors the way GitHub renders them, for the verify-docs
// rule `anchor-parity` (v1.5.0, audit G4): every `#fragment` a document links
// to must be an anchor its target actually has. `internal-links` proves the
// file; this proves the fragment. The slug mirrors pdfnative's
// scripts/build-guides.ts `slugify` (GitHub convention: punctuation stripped,
// every whitespace character becomes its own hyphen, no collapsing).

const ENTITIES: Readonly<Record<string, string>> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
};

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
        if (body.startsWith('#x') || body.startsWith('#X')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
        if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
        return ENTITIES[body.toLowerCase()] ?? m;
    });
}

const isAsciiLetter = (ch: string | undefined): boolean =>
    ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));

/**
 * Drop HTML tags — `<` + optional `/` + a letter … up to the next `>` — and
 * every angle bracket that is left, in ONE left-to-right scan.
 *
 * Deliberately not a `replace(/<[^>]+>/g, '')`: removing a multi-character
 * pattern in one regex pass can leave a new match behind (`<<b>script>` →
 * `<script>`), which is what CodeQL reports as
 * js/incomplete-multi-character-sanitization. A scanner that never emits a
 * bracket cannot: its output holds no `<` and no `>`, whatever the input.
 * Linear time, no backtracking. `a < b and c > d` is not a tag: only the two
 * brackets go.
 */
export function stripTags(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i]!;
        if (ch === '<') {
            const nameAt = text[i + 1] === '/' ? i + 2 : i + 1;
            const close = isAsciiLetter(text[nameAt]) ? text.indexOf('>', nameAt) : -1;
            i = close === -1 ? i + 1 : close + 1;
            continue;
        }
        if (ch !== '>') out += ch;
        i++;
    }
    return out;
}

/**
 * The anchor GitHub generates for a heading's raw Markdown text: trailing
 * closing `#`s dropped, inline code kept as its text, links reduced to their
 * text, HTML tags removed, entities decoded; then trim → lowercase → every
 * character that is not a letter, digit, whitespace, `_` or `-` removed →
 * each whitespace character becomes a hyphen.
 */
export function githubSlug(heading: string): string {
    const text = decodeEntities(
        stripTags(
            heading
                .replace(/\s+#+\s*$/, '')                   // closing ATX hashes
                .replace(/`([^`]*)`/g, '$1')                // inline code → its text
                .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'), // links and images → their text
        ),
    );
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)\s*$/;
const ATX_EMPTY = /^ {0,3}#{1,6}\s*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const ID_ATTR = /\b(?:id|name)="([^"]+)"/g;

function isParagraphText(line: string): boolean {
    const t = line.trim();
    if (t.length === 0) return false;
    if (t.startsWith('|')) return false;          // table row: the `---` under it is a separator
    if (/^ {0,3}#{1,6}(\s|$)/.test(line)) return false;
    if (/^ {0,3}([-*+]|\d+[.)])\s/.test(line)) return false; // list item
    if (/^ {0,3}>/.test(line)) return false;       // blockquote
    if (FENCE.test(line)) return false;
    return true;
}

/**
 * Every anchor a Markdown document exposes: ATX and setext headings (fenced
 * code blocks and HTML comments skipped, duplicates suffixed `-1`, `-2`, …
 * as GitHub does) plus explicit `id="…"` / `name="…"` attributes.
 */
export function markdownAnchors(text: string): ReadonlySet<string> {
    const anchors = new Set<string>();
    const seen = new Map<string, number>();
    const add = (raw: string): void => {
        const base = githubSlug(raw);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        anchors.add(n === 0 ? base : `${base}-${n}`);
    };

    const lines = text.split(/\r?\n/);
    let fence: string | null = null;
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        if (inComment) {
            if (line.includes('-->')) inComment = false;
            continue;
        }
        if (fence !== null) {
            const close = FENCE.exec(line);
            if (close !== null && close[1]!.startsWith(fence[0]!) && close[1]!.length >= fence.length) fence = null;
            continue;
        }
        const open = FENCE.exec(line);
        if (open !== null) { fence = open[1] as string; continue; }
        const commentAt = line.indexOf('<!--');
        if (commentAt >= 0 && !line.includes('-->', commentAt)) { inComment = true; }
        const visible = commentAt >= 0 ? line.slice(0, commentAt) : line;

        const atx = ATX.exec(visible);
        if (atx !== null) { add(atx[2] as string); continue; }
        if (ATX_EMPTY.test(visible)) continue;
        const next = lines[i + 1];
        if (next !== undefined && SETEXT_UNDERLINE.test(next) && isParagraphText(visible) && (i === 0 || (lines[i - 1] as string).trim().length === 0 || isParagraphText(lines[i - 1] as string))) {
            add(visible);
            i++;
        }
    }
    for (const m of text.matchAll(ID_ATTR)) anchors.add((m[1] as string).toLowerCase());
    return anchors;
}

export interface FragmentLink {
    /** The path part before `#` — empty for a same-document link. */
    readonly path: string;
    readonly fragment: string;
    /** Character offset of the link in the text (for line numbers). */
    readonly index: number;
}

const MD_FRAGMENT_LINK = /\]\(([^)\s]*)#([^)\s]+)\)/g;

/** Every Markdown link carrying a `#fragment`, external URLs excluded. */
export function fragmentLinks(text: string): FragmentLink[] {
    const out: FragmentLink[] = [];
    for (const m of text.matchAll(MD_FRAGMENT_LINK)) {
        const path = m[1] as string;
        if (/^(https?:|mailto:|data:|\/\/)/.test(path) || path.includes('${') || path.includes('<')) continue;
        out.push({ path, fragment: m[2] as string, index: m.index });
    }
    return out;
}
