---
---

Bring the lightweight-charts reference adapter's capability honesty to parity:
render `bg-color` as a per-bar background BAND through the `DrawingPrimitive`
overlay (LC's background is a single chart-layout option, not a per-bar band),
honouring the 3-state `colorValue` (omitted ⇒ static `style.color`; present ⇒
override; `null` ⇒ no band that bar) and folding `transp` into the stripe
opacity — the prior documented no-op is gone; paint `alertConditions` (fired
only, top-right) + `logs` (last 5, bottom-left) via the same overlay,
always-on-top and NOT z-sorted (the v1 deferral mirroring canvas2d's
`renderOverlayTail`); and order the overlay-painted marks (drawings + bg-color
bands + overlay glyphs) by the SHARED `sortByRenderOrder` + `RENDER_BAND` from
`@invinite-org/chartlang-adapter-kit` (no hand-port), so a `z:-1` drawing sorts
beneath a `z:0` band. Native LC series stacking stays LC-managed (best-effort
via series-creation order — documented). Private example package — no published
surface; empty changeset.
