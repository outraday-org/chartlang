---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": minor
---

Add an optional presentation-only `z` (render-order / z-index) option to
`plot()` and every `draw.*` primitive. Default `0`; higher renders on
top, ties fall back to the existing group + declaration order. Finite
numbers only. Affects stacking only — values, alerts, and `state.*` are
unchanged.

Adapter kit: `PlotEmission` and `DrawingEmission` gain the matching
presentation-only `z?: number` wire field, validated by
`validateEmission` as a finite number (NaN / ±Infinity rejected;
fractional and negative allowed). Omitted/`0` stays byte-identical to a
pre-feature emission, so existing goldens and conformance hashes are
untouched.

Runtime: `plotImpl` reads `opts.z`, and the drawing-emit path
(`createDrawingHandle`) lifts `z` out of `state.style` — into a shallow
clone with `z` removed, where the per-kind `draw.*` impls fold the opts
bag — and threads it onto the top-level `PlotEmission.z` /
`DrawingEmission.z` with the same omit-when-`0` conditional spread used
for `xShift`. `z` is persisted **beside** the drawing slot's `state`
(never inside `DrawingState`), so an `update` retains the last value. A
no-`z` plot or drawing emits no `z` key — byte-identical to the
pre-feature baseline. `draw.table` / `draw.group` do not carry `z` in
v1.

Pine converter: `explicit_plot_zorder` is now a recognized no-op instead
of an unmapped warning. chartlang already layers marks by declaration
order within their group (the normative ordering contract), which is
exactly what Pine's `explicit_plot_zorder=true` makes authoritative — so
the flag is satisfied by default and needs no chartlang option.
`mapDeclarationArgs` no longer raises `indicator-arg-not-mapped` for it;
instead it emits a single `explicit-plot-zorder-default` info note
(covering both `explicit_plot_zorder=true` and the Pine-default
`=false`). The converter still never *emits* a numeric `z` — Pine has no
per-element z source construct. Other unmapped `indicator(...)` args
(`timeframe`, etc.) keep warning.

Compiler: the ambient `@invinite-org/chartlang-core` `.d.ts` shim gains a
`ZOrdered { z?: number }` mixin intersected into `PlotOpts` and every
`draw.*` option type (mirroring core's `drawingStyle.ts`), so a compiled
script's `plot(value, { z })` **and** `draw.*(…, { z })` type-check (the
shim stays in lockstep with core).

Conformance: a new `z-order` scenario pins the plot `z` →
`PlotEmission.z` wire contract — a `plot(value, { z: -1 })` emits
`z: -1`, a no-`z` plot omits the field (omit-when-`0` byte-identity), and
a value-hash proves `z` never transforms the series. The `plot-field`
assertion's `field` union widens to also accept `"z"`.
