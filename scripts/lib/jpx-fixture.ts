/**
 * Minimal JPEG 2000 fixtures — one implementation, shared by the tests, the
 * `media/image-jpx` sample and the conformance corpus (the same construction
 * the pdfnative engine uses for its own `images/*` samples).
 *
 * The engine never decodes JPEG 2000: the bytes are embedded as they are
 * with `/JPXDecode` and the viewer decodes them, exactly as it does the DCT
 * data of a JPEG. A pass-through fixture therefore only needs to be a valid
 * codestream that every decoder reproduces the same way — here a flat mid
 * grey (every coefficient zero, 128 after the DC level shift) in each
 * component — not a picture.
 */

/** Big-endian helpers. */
const u16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const fourcc = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));
const box = (type: string, body: readonly number[]): number[] => [...u32(8 + body.length), ...fourcc(type), ...body];

/**
 * A minimal, valid JPEG 2000 codestream (ISO/IEC 15444-1): `size` × `size`
 * pixels, `components` 8-bit unsigned components, one tile, one quality
 * layer, no wavelet decomposition, the reversible 5/3 transform and no
 * quantization. Every packet is empty, so the image decodes to mid grey.
 */
export function makeMinimalJ2K(components = 1, size = 8): Uint8Array {
    const siz = [
        ...u16(38 + 3 * components), ...u16(0),
        ...u32(size), ...u32(size), ...u32(0), ...u32(0), // image size and offset
        ...u32(size), ...u32(size), ...u32(0), ...u32(0), // one tile covering the image
        ...u16(components),
    ];
    for (let c = 0; c < components; c++) siz.push(0x07, 0x01, 0x01); // 8-bit unsigned, no subsampling
    const cod = [...u16(12), 0x00, 0x00, ...u16(1), components === 3 ? 0x01 : 0x00, 0x00, 0x04, 0x04, 0x00, 0x01];
    const qcd = [...u16(4), 0x40, 0x40]; // no quantization, 2 guard bits; LL exponent 8
    const packets = Array.from({ length: components }, () => 0x00); // one empty packet per component
    const psot = 12 + 2 + packets.length; // SOT segment + SOD + data
    const sot = [...u16(10), ...u16(0), ...u32(psot), 0x00, 0x01];
    return new Uint8Array([
        0xff, 0x4f, // SOC
        0xff, 0x51, ...siz, // SIZ
        0xff, 0x52, ...cod, // COD
        0xff, 0x5c, ...qcd, // QCD
        0xff, 0x90, ...sot, // SOT
        0xff, 0x93, ...packets, // SOD + the empty packets
        0xff, 0xd9, // EOC
    ]);
}

/**
 * The JP2 file wrapping {@link makeMinimalJ2K}: signature and file-type
 * boxes, a JP2 header (`ihdr`; a `colr` box naming sRGB, greyscale or CMYK
 * by the component count), optionally a `cdef` box declaring the last
 * component as opacity, and the codestream box.
 */
export function makeMinimalJP2(
    components = 1,
    options: { readonly alpha?: boolean; readonly size?: number } = {},
): Uint8Array {
    const size = options.size ?? 8;
    const colourChannels = options.alpha ? components - 1 : components;
    const enumCs = colourChannels === 1 ? 17 : colourChannels === 4 ? 12 : 16;
    const codestream = makeMinimalJ2K(components, size);
    const ihdr = box('ihdr', [...u32(size), ...u32(size), ...u16(components), 0x07, 0x07, 0x00, 0x00]);
    const colr = box('colr', [0x01, 0x00, 0x00, ...u32(enumCs)]);
    const cdef = options.alpha
        ? box('cdef', [
              ...u16(components),
              ...Array.from({ length: components }, (_, i) =>
                  i === components - 1 ? [...u16(i), ...u16(1), ...u16(0)] : [...u16(i), ...u16(0), ...u16(i + 1)],
              ).flat(),
          ])
        : [];
    return new Uint8Array([
        ...box('jP  ', [0x0d, 0x0a, 0x87, 0x0a]),
        ...box('ftyp', [...fourcc('jp2 '), ...u32(0), ...fourcc('jp2 ')]),
        ...box('jp2h', [...ihdr, ...colr, ...cdef]),
        ...box('jp2c', Array.from(codestream)),
    ]);
}
