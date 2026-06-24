---
"@invinite-org/chartlang-adapter-kit": minor
---

Promote the canvas glyph geometry into the shared `./canvas` sink so the
canvas-family adapters (uplot draw-hook, lightweight-charts overlay) consume one
source instead of hand-porting it (the bug class the `shift.ts` /
`renderOrder.ts` promotions exist to kill). New `./canvas` exports:
`drawShape` / `drawCharacter` / `drawArrow` / `drawMarker` / `drawLabel`
(`shape` / `character` / `arrow` / `marker` / `label` geometry on a
`RenderCtx`) plus their arg + enum types (`ShapeArgs` / `ShapeGlyph` /
`CharacterArgs` / `ArrowArgs` / `MarkerArgs` / `MarkerShape` / `LabelArgs` /
`LabelPosition` / `GlyphLocation`). Each helper is model-free — it draws onto a
`RenderCtx` and takes a plain `fallbackColor: string` (the null-color default),
so it carries no palette / library / model types. The five filled-marker `shape`
glyphs delegate to `drawMarker`; `cross` / `xcross` / `flag` stroke directly.
Promoted out of the canvas2d reference adapter (which keeps its own
`Palette`-taking local renderers — re-consume deferred). Pure, fully covered.
