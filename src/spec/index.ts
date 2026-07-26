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
    lintSpec,
    renderSpecToBytes,
    renderSpecToBlob,
    renderSpecToStream,
    renderSpecToFile,
    renderSpecToFileStream,
    renderSpecToResponse,
} from './compile.js';

export { schema, schemaId, SCHEMA_SUBJECTS, docSpecSchema, docSpecSchemaId } from './schema.js';
export type { JsonSchema, SchemaSubject } from './schema.js';

export { validateSpec, SpecCode } from './validate.js';
export type {
    SpecCodeValue,
    SpecFinding,
    SpecFindingSeverity,
    SpecValidation,
} from './validate.js';

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
    ChartSpec,
    ChartSpecBody,
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
