---
---

Refactor the canvas2d reference adapter to consume the shared
`sortByRenderOrder` + `RENDER_BAND` from `@invinite-org/chartlang-adapter-kit`
instead of its local z-order comparator. The canvas2d-specific `SortableMark`
payload union stays local; `render/renderOrder.ts` re-exports the comparator
and aliases `BAND = RENDER_BAND` so every `BAND.*` call site is untouched. No
behaviour change — the comparator math is identical and the integration
`PINNED_HASH` (EMA-cross, no drawings) does not exercise the z-sort path.
(Private example package — no version bump.)
