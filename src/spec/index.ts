/**
 * Compact, token-frugal authoring surface for pdfnative-react.
 *
 * Re-exports the {@link DocSpec} types, the spec compile/render entry points, and
 * the versioned JSON Schema. See {@link ./types} for the grammar.
 *
 * @packageDocumentation
 */

export {
    specToElement,
    compileSpec,
    inspectSpec,
    renderSpecToBytes,
    renderSpecToBlob,
    renderSpecToStream,
    renderSpecToFile,
    renderSpecToFileStream,
} from './compile.js';

export { docSpecSchema, docSpecSchemaId } from './schema.js';
export type { JsonSchema } from './schema.js';

export type {
    DocSpec,
    BlockSpec,
    BlockSpecKind,
    HeadingSpec,
    ParagraphSpec,
    ListSpec,
    TableSpec,
    TableSpecBody,
    TableRowSpec,
    ImageSpec,
    ImageSpecBody,
    LinkSpec,
    SpacerSpec,
    PageBreakSpec,
    PageSpec,
    TocSpec,
    BarcodeSpec,
    SvgSpec,
    FormFieldSpec,
    FormFieldSpecBody,
    HeadingSpecOpts,
    ParagraphSpecOpts,
    ListSpecOpts,
    LinkSpecOpts,
    TocSpecOpts,
    BarcodeSpecOpts,
    SvgSpecOpts,
} from './types.js';
