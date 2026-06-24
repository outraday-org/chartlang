---
"@invinite-org/chartlang-adapter-kit": minor
---

Add the shared z-order render comparator (`geometry/renderOrder.ts`) so every
adapter sorts its paint pass identically instead of hand-porting the math. New
public exports on the root barrel: `sortByRenderOrder<T extends RenderOrderKey>`
(the model-agnostic `a.z - b.z || a.band - b.band || a.seq - b.seq` total order,
sorted in place and the same array returned), `RENDER_BAND` (`{ series, glyph,
hline, drawing }`, the pre-`z` phase order), and the `RenderOrderKey` structural
key (`{ z, band, seq }`). Promoted out of the canvas2d reference adapter
(which now re-exports the comparator and aliases `BAND = RENDER_BAND`),
mirroring the earlier `shift.ts` promotion — the z-comparator is identical
across rendering models, so one generic helper replaces what would otherwise be
five divergent ports as Tasks 4/6/10/12 add `z` to the other adapters. The
comparator is generic over the mark payload, so each adapter keeps its own
mark union local. Pure, fully covered, behaviour-preserving (the canvas2d
integration hash has no drawings, so the comparator path is unchanged).
