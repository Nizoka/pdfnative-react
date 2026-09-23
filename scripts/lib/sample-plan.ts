/**
 * pdfnative-react — the sample plan
 * =================================
 * One table lists every file under `samples/` and what running it produces,
 * so `scripts/generate-samples.ts` knows which samples to run, where their
 * PDFs land, and which ones stay out of the byte baseline (and why);
 * `tests/regression/samples.test.ts` and the `sample-index-parity` rule of
 * `verify:docs` hold the table to the directory and to samples/README.md.
 *
 * A sample is what the README documents — `npx tsx samples/<name>.tsx`, a PDF
 * written to the current directory — and nothing more. The generator runs
 * each one in its own process with the working directory set under
 * `test-output/samples/<dir>/`, so the output path of `samples/layout/x.tsx`
 * writing `x.pdf` is `layout/x.pdf` in the baseline.
 */

export interface SampleEntry {
    /** Repo-relative source, forward slashes. */
    readonly source: string;
    /** PDFs the sample writes to its working directory (its own file names). */
    readonly outputs: readonly string[];
    /**
     * Why the sample is run but not fingerprinted, when that is the case:
     * `network` — its bytes depend on a fetch the hermetic gate cannot make.
     */
    readonly exclude?: 'network';
}

/** Samples that are executed by the generator. Order is the README's. */
export const SAMPLE_PLAN: readonly SampleEntry[] = [
    { source: 'samples/invoice.tsx', outputs: ['invoice.pdf'] },
    { source: 'samples/report.tsx', outputs: ['report.pdf'] },
    { source: 'samples/text/typography.tsx', outputs: ['typography.pdf'] },
    { source: 'samples/text/typography-engine.tsx', outputs: ['typography-engine.pdf'] },
    { source: 'samples/text/typography-french.tsx', outputs: ['typography-french.pdf'] },
    { source: 'samples/text/nested-lists.tsx', outputs: ['nested-lists.pdf'] },
    { source: 'samples/text/math.tsx', outputs: ['math.pdf'] },
    { source: 'samples/table/data-table.tsx', outputs: ['data-table.pdf'] },
    { source: 'samples/table/cell-borders.tsx', outputs: ['cell-borders.pdf'] },
    { source: 'samples/media/image.tsx', outputs: ['image.pdf'] },
    { source: 'samples/media/link.tsx', outputs: ['link.pdf'] },
    { source: 'samples/media/barcode.tsx', outputs: ['barcode.pdf'] },
    { source: 'samples/media/svg.tsx', outputs: ['svg.pdf'] },
    { source: 'samples/media/svg-text.tsx', outputs: ['svg-text.pdf'] },
    { source: 'samples/media/image-helpers.tsx', outputs: ['image-helpers.pdf'], exclude: 'network' },
    { source: 'samples/forms/form-fields.tsx', outputs: ['form-fields.pdf'] },
    { source: 'samples/structure/sections.tsx', outputs: ['sections.pdf'] },
    { source: 'samples/structure/section.tsx', outputs: ['section.pdf'] },
    { source: 'samples/structure/outline.tsx', outputs: ['outline.pdf', 'outline-auto.pdf'] },
    { source: 'samples/structure/stream-to-file.tsx', outputs: ['stream-to-file.pdf'] },
    { source: 'samples/fonts/custom-fonts.tsx', outputs: ['custom-fonts.pdf'] },
    { source: 'samples/fonts/fonts-prop.tsx', outputs: ['fonts-prop.pdf', 'fonts-prop-sync.pdf'] },
    { source: 'samples/fonts/scripts-27.tsx', outputs: ['scripts-27.pdf'] },
    { source: 'samples/layout/page-setup.tsx', outputs: ['page-setup.pdf'] },
    { source: 'samples/layout/viewer-preferences.tsx', outputs: ['viewer-preferences.pdf'] },
    { source: 'samples/layout/debug-inspect.tsx', outputs: ['debug-overlay.pdf'] },
    { source: 'samples/layout/watermark-header-footer.tsx', outputs: ['watermark-header-footer.pdf'] },
    { source: 'samples/layout/print-production.tsx', outputs: ['print-production.pdf'] },
    { source: 'samples/layout/print-pdfx4.tsx', outputs: ['print-pdfx4.pdf'] },
    { source: 'samples/layout/cmyk.tsx', outputs: ['cmyk.pdf'] },
    { source: 'samples/charts/charts.tsx', outputs: ['charts.pdf'] },
    { source: 'samples/charts/charts-v2.tsx', outputs: ['charts-v2.pdf'] },
    { source: 'samples/quality/lint.tsx', outputs: [] },
    { source: 'samples/quality/diagnostics.tsx', outputs: ['diagnostics.pdf'] },
    { source: 'samples/quality/reproducible.tsx', outputs: ['reproducible.pdf'] },
    { source: 'samples/agent/agent-loop.ts', outputs: ['agent-loop.pdf'] },
    { source: 'samples/agent/compact-spec.ts', outputs: ['compact-spec.pdf'] },
    { source: 'samples/agent/manifest.ts', outputs: [] },
    { source: 'samples/agent/schema.ts', outputs: [] },
    { source: 'samples/agent/error-envelope.tsx', outputs: [] },
    { source: 'samples/agent/visual-verify.tsx', outputs: ['visual-verify.pdf'] },
];

/**
 * Samples that are modules, not scripts: React components and a route handler
 * to drop into an application. They are type-checked (`typecheck:samples`)
 * but never executed.
 */
export const MODULE_SAMPLES: readonly string[] = [
    'samples/client/use-pdf.tsx',
    'samples/client/viewer.tsx',
    'samples/server/next-route-handler.tsx',
];

/** Files under samples/ that are neither a sample nor a module. */
export const SAMPLE_SUPPORT_FILES: readonly string[] = ['samples/README.md', 'samples/tsconfig.json'];

/** `samples/layout/x.tsx` → `layout`; `samples/invoice.tsx` → ``. */
export function sampleDir(source: string): string {
    const parts = source.split('/');
    return parts.slice(1, -1).join('/');
}

/** The baseline keys a plan entry produces (`layout/x.pdf`, `invoice.pdf`). */
export function expectedOutputs(entry: SampleEntry): string[] {
    const dir = sampleDir(entry.source);
    return entry.outputs.map((name) => (dir === '' ? name : `${dir}/${name}`));
}
