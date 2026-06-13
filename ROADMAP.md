# Roadmap — pdfnative-react

This roadmap is indicative, not a commitment. Priorities follow the needs of the
[pdfnative](https://www.npmjs.com/package/pdfnative) ecosystem.

## 0.2.x — Stabilisation

- Harden the reconciler against edge cases (fragments, conditional children, keys).
- Expand test coverage and golden-PDF snapshots.
- Documentation site. ✅ Runnable samples and the compact `DocSpec` agent
  authoring layer shipped in 0.2.0.

## 0.3.0 — React 18 support

- Add React 18 to the peer range and CI matrix.
- Resolve the `react-reconciler` version matrix for 18 + 19 simultaneously.

## 0.4.0 — Richer authoring

- `<Section>` helper that pairs a heading with grouped content.
- Convenience props for fonts (auto-`registerFonts` from a `fonts` prop).
- Image source helpers (`fromUrl`, `fromBase64`) returning the required bytes.

## Later

- React Server Components streaming helpers.
- React Native renderer (separate entry point).
- Layout linting / accessibility checks surfaced as dev warnings.

## Non-goals

- A CSS/flexbox box model (`<View>`). pdfnative is a declarative block flow by
  design; we will not emulate HTML/CSS layout.
