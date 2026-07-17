/**
 * Serialize a reconciled host tree into a `pdfnative` `DocumentParams` object.
 *
 * This is the heart of the "JSX compiles to JSON" promise: a pure, synchronous
 * transform with no side effects, so it is trivially testable in isolation.
 */

import type {
    DocumentParams,
    DocumentBlock,
    DocumentMetadata,
    ListItem,
    OutlineItem,
    PageLabelRange,
    PdfRow,
} from '../types.js';
import {
    type ElementNode,
    type HostNode,
    type RootContainer,
    isElementNode,
} from './nodes.js';

/** Thrown when a component tree cannot be mapped onto the pdfnative model. */
export class PdfStructureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PdfStructureError';
    }
}

function collectText(node: HostNode): string {
    if (!isElementNode(node)) return node.text;
    let out = '';
    for (const child of node.children) out += collectText(child);
    return out;
}

function elementText(node: ElementNode): string {
    if (typeof node.props.text === 'string') return node.props.text;
    return node.children.map(collectText).join('');
}

function elementChildren(node: ElementNode): ElementNode[] {
    return node.children.filter(isElementNode);
}

/** Remove `undefined` values so the emitted JSON stays clean and deterministic. */
function compact<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) out[key] = value;
    }
    return out as T;
}

function toBlock(node: ElementNode): DocumentBlock | DocumentBlock[] {
    const p = node.props;
    switch (node.tag) {
        case 'heading':
            return compact({
                type: 'heading',
                text: elementText(node),
                level: (p.level as 1 | 2 | 3) ?? 1,
                color: p.color,
            }) as DocumentBlock;

        case 'paragraph':
            return compact({
                type: 'paragraph',
                text: elementText(node),
                fontSize: p.fontSize,
                lineHeight: p.lineHeight,
                align: p.align,
                indent: p.indent,
                color: p.color,
            }) as DocumentBlock;

        case 'list':
            return compact({
                type: 'list',
                items:
                    (p.items as readonly (string | ListItem)[] | undefined) ??
                    elementChildren(node)
                        .filter((c) => c.tag === 'item')
                        .map(toListItem),
                style: p.ordered ? 'numbered' : ((p.style as string) ?? 'bullet'),
                fontSize: p.fontSize,
            }) as DocumentBlock;

        case 'table':
            return toTableBlock(node);

        case 'image':
            return compact({
                type: 'image',
                data: p.data,
                width: p.width,
                height: p.height,
                align: p.align,
                alt: p.alt,
            }) as DocumentBlock;

        case 'link':
            return compact({
                type: 'link',
                text: elementText(node),
                url: p.url ?? p.href,
                fontSize: p.fontSize,
                color: p.color,
            }) as DocumentBlock;

        case 'spacer':
            return { type: 'spacer', height: (p.height as number) ?? 12 };

        case 'pageBreak':
            return { type: 'pageBreak' };

        case 'toc':
            return compact({
                type: 'toc',
                title: p.title,
                maxLevel: p.maxLevel,
                fontSize: p.fontSize,
                indent: p.indent,
            }) as DocumentBlock;

        case 'barcode':
            return compact({
                type: 'barcode',
                format: p.format,
                data: p.data,
                width: p.width,
                height: p.height,
                align: p.align,
                ecLevel: p.ecLevel,
                pdf417ECLevel: p.pdf417ECLevel,
            }) as DocumentBlock;

        case 'svg':
            return compact({
                type: 'svg',
                data: p.data,
                width: p.width,
                height: p.height,
                align: p.align,
                viewBox: p.viewBox,
                fill: p.fill,
                stroke: p.stroke,
                strokeWidth: p.strokeWidth,
                alt: p.alt,
            }) as DocumentBlock;

        case 'formField':
            return compact({
                type: 'formField',
                fieldType: p.fieldType ?? p.type,
                name: p.name,
                label: p.label,
                value: p.value,
                placeholder: p.placeholder,
                width: p.width,
                height: p.height,
                fontSize: p.fontSize,
                options: p.options,
                readOnly: p.readOnly,
                required: p.required,
                maxLength: p.maxLength,
                checked: p.checked,
            }) as DocumentBlock;

        case 'page':
            return blocksFrom(node.children);

        default:
            throw new PdfStructureError(
                `<${node.tag}> is not valid here. Expected a block-level component inside <Document> or <Page>.`,
            );
    }
}

/**
 * Serialize an `<Item>` into a `string` (leaf item, byte-identical to the flat
 * behavior) or a `ListItem` (`{ text, items }`) when it carries sub-items.
 *
 * The item's own text deliberately excludes nested `item`/`list` elements —
 * reusing {@link elementText} here would swallow the sub-items' text into the
 * parent label.
 */
function toListItem(node: ElementNode): string | ListItem {
    const p = node.props;
    const text =
        typeof p.text === 'string'
            ? p.text
            : node.children
                  .filter((c) => !isElementNode(c) || (c.tag !== 'item' && c.tag !== 'list'))
                  .map(collectText)
                  .join('');

    const items =
        (p.items as readonly (string | ListItem)[] | undefined) ?? subItemsOf(node);
    if (!items || items.length === 0) return text;
    return { text, items };
}

/**
 * Collect an item's nested sub-items from either authoring form: a child
 * `<List>` grouping `<Item>`s (HTML-shaped; the nested list's own props are
 * ignored — sub-items inherit the parent list's style) or directly nested
 * `<Item>` children.
 */
function subItemsOf(node: ElementNode): (string | ListItem)[] {
    const out: (string | ListItem)[] = [];
    for (const child of elementChildren(node)) {
        if (child.tag === 'item') {
            out.push(toListItem(child));
        } else if (child.tag === 'list') {
            const nested =
                (child.props.items as readonly (string | ListItem)[] | undefined) ??
                elementChildren(child)
                    .filter((c) => c.tag === 'item')
                    .map(toListItem);
            out.push(...nested);
        }
    }
    return out;
}

function toTableBlock(node: ElementNode): DocumentBlock {
    const p = node.props;
    const rowNodes = elementChildren(node).filter((c) => c.tag === 'row');

    let headers = p.headers as readonly string[] | undefined;
    let bodyRows = rowNodes;

    // If no explicit headers prop, treat the first <Row header> (or first row) as headers.
    if (!headers && rowNodes.length > 0) {
        const headerRow = rowNodes.find((r) => r.props.header === true) ?? rowNodes[0];
        headers = elementChildren(headerRow)
            .filter((c) => c.tag === 'cell')
            .map(elementText);
        bodyRows = rowNodes.filter((r) => r !== headerRow);
    }

    const rows: PdfRow[] =
        (p.rows as PdfRow[] | undefined) ??
        bodyRows.map((r) => ({
            cells: elementChildren(r)
                .filter((c) => c.tag === 'cell')
                .map(elementText),
            type: (r.props.variant as string) ?? 'default',
            pointed: (r.props.pointed as boolean) ?? false,
        }));

    return compact({
        type: 'table',
        headers: headers ?? [],
        rows,
        columns: p.columns,
        clipCells: p.clipCells,
        autoFitColumns: p.autoFitColumns,
        wrap: p.wrap,
        repeatHeader: p.repeatHeader,
        zebra: p.zebra,
        caption: p.caption,
        minRowHeight: p.minRowHeight,
        cellPadding: p.cellPadding,
        cellBorders: p.cellBorders,
        cellVAlign: p.cellVAlign,
    }) as DocumentBlock;
}

function blocksFrom(children: readonly HostNode[]): DocumentBlock[] {
    const blocks: DocumentBlock[] = [];
    let pageIndex = 0;
    for (const child of children) {
        if (!isElementNode(child)) continue;
        if (child.tag === 'page') {
            if (pageIndex > 0) blocks.push({ type: 'pageBreak' });
            pageIndex += 1;
        }
        const result = toBlock(child);
        if (Array.isArray(result)) blocks.push(...result);
        else blocks.push(result);
    }
    return blocks;
}

function findDocument(container: RootContainer): ElementNode {
    const elements = container.children.filter(isElementNode);
    const doc = elements.find((c) => c.tag === 'document');
    if (doc) return doc;
    if (elements.length === 1 && elements[0].tag !== 'document') {
        throw new PdfStructureError(
            'The root component must be <Document>. Wrap your content in <Document>…</Document>.',
        );
    }
    throw new PdfStructureError('No <Document> found at the root of the tree.');
}

/** Convert a committed reconciler root into a `pdfnative` `DocumentParams`. */
export function serialize(container: RootContainer): DocumentParams {
    const doc = findDocument(container);
    const p = doc.props;

    const params: DocumentParams = compact({
        title: p.title as string | undefined,
        blocks: blocksFrom(doc.children),
        footerText: p.footerText as string | undefined,
        fontEntries: p.fontEntries,
        metadata: p.metadata as DocumentMetadata | undefined,
        layout: p.layout,
        outline: p.outline as readonly OutlineItem[] | 'auto' | undefined,
        pageLabels: p.pageLabels as readonly PageLabelRange[] | undefined,
    }) as DocumentParams;

    return params;
}
