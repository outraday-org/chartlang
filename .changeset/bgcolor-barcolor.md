---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add `bgcolor(color, opts?)` and `barcolor(color, opts?)` — Pine-ergonomic
top-level aliases for the `bg-color` / `bar-color` plot styles. One call
(`bgcolor(close > open ? "#16a34a" : "#dc2626", { transp: 80 })`) replaces
the verbose `plot(NaN, { style: { kind: "bg-color", … } })`. Surfaced in the
generated primitive reference and taught in the chartlang-coding skill.

Deliverable 2 (per-bar dynamic color): `PlotEmission` gains an optional
`colorValue: Color | null` channel; the runtime resolves the `bgcolor` /
`barcolor` per-bar color into it (omitted on the static `plot` path → wire
byte-identical, every pinned `plot-hash` untouched), validates it
(non-empty color string or `null`), and dedups it last-write-wins per
`(slotId, bar)` like `value`. Adapters prefer `colorValue` over the static
`style.color` at render time — this precedence is now the normative
adapter-kit contract (`PlotEmission.colorValue` JSDoc) and is implemented in
the canvas2d reference renderer (`null` ⇒ paint-nothing gap; omitted ⇒ static
fallback). The Pine converter emits the real per-bar dynamic color
(`bgcolor(close > open ? "#16a34a" : "#dc2626")`) instead of a static
`plot(NaN, …)`, so `bgcolor`/`barcolor` round-trip with per-bar semantics
intact.
