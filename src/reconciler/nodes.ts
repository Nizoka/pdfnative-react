/**
 * Internal tree representation produced by the reconciler.
 *
 * pdfnative-react does not target the DOM: its "host instances" are plain data
 * nodes that are later serialized into a `pdfnative` `DocumentParams` object.
 */

/** Host element tag names emitted by the public components. */
export type HostTag =
    | 'document'
    | 'page'
    | 'heading'
    | 'paragraph'
    | 'list'
    | 'item'
    | 'table'
    | 'row'
    | 'cell'
    | 'image'
    | 'link'
    | 'spacer'
    | 'pageBreak'
    | 'toc'
    | 'barcode'
    | 'svg'
    | 'formField';

/** A reconciled element node. */
export interface ElementNode {
    readonly kind: 'element';
    readonly tag: HostTag;
    props: Record<string, unknown>;
    readonly children: HostNode[];
}

/** A reconciled text node (string/number child). */
export interface TextNode {
    readonly kind: 'text';
    text: string;
}

export type HostNode = ElementNode | TextNode;

/** The mutable root container handed to the reconciler. */
export interface RootContainer {
    readonly children: HostNode[];
}

export function createElementNode(tag: HostTag, props: Record<string, unknown>): ElementNode {
    return { kind: 'element', tag, props, children: [] };
}

export function createTextNode(text: string): TextNode {
    return { kind: 'text', text };
}

export function isElementNode(node: HostNode): node is ElementNode {
    return node.kind === 'element';
}
