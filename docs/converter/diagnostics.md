# Converter diagnostics

Every idiom the Pine → chartlang converter cannot translate faithfully
surfaces as a structured `Diagnostic` with a **stable code**, a severity,
a human message, and (usually) a suggested manual rewrite. Codes never
change — downstream tooling (the CLI, editors, gate scripts) keys on them.

Severities:

- **error** — the converter could not produce a faithful translation for
  this site. The emitted `.chart.ts` carries a `// HARD-REJECT` marker (or
  omits the construct). Fix the Pine source and re-run, or hand-port the
  rejected slice. Under `--strict` (`strictMode: true`) every **warning**
  is upgraded to an **error**.
- **warning** — the converter translated the site, but a detail was
  dropped or approximated. Review the output.
- **info** — an advisory note about an approximation the converter made on
  purpose (no action usually needed).

The CLI links each diagnostic to this page by its short slug — the final
`/`-segment of the code. `pine-converter/transform/cap-mismatch` →
[`#cap-mismatch`](#cap-mismatch). Use the anchors below.

This page is generated from the converter's diagnostic registry, so it can
never drift from the shipped codes. See also the
[reject catalogue](./rejects.md) for the architectural *why* behind the
hard-rejects and the recommended Pine rewrites.

### codegen-output-invalid

- **Code:** `pine-converter/codegen/codegen-output-invalid`
- **Severity:** error
- **Message:** The converted chartlang source failed to compile through `@invinite-org/chartlang-compiler`.
- **Suggested fix:** Open the emitted `.chart.ts`, address the compiler diagnostics, or file a converter bug with the source.

### chained-ternary-warning

- **Code:** `pine-converter/parse/chained-ternary-warning`
- **Severity:** info
- **Message:** Chained ternary; chartlang codegen prefers an if/else.
- **Suggested fix:** Consider rewriting `a ? b : c ? d : e` as nested if/else.

### expected-token

- **Code:** `pine-converter/parse/expected-token`
- **Severity:** error
- **Message:** Expected a different token here.

### missing-version-directive

- **Code:** `pine-converter/parse/missing-version-directive`
- **Severity:** error
- **Message:** Script must start with a `//@version=6` directive.
- **Suggested fix:** Add `//@version=6` as the first line.

### mixed-named-positional-args

- **Code:** `pine-converter/parse/mixed-named-positional-args`
- **Severity:** error
- **Message:** A positional argument cannot follow a named argument.
- **Suggested fix:** Move all positional arguments before the named ones.

### switch-expression-unsupported

- **Code:** `pine-converter/parse/switch-expression-unsupported`
- **Severity:** error
- **Message:** A `switch` used as a value (e.g. `x = switch s ...`) is not yet supported.
- **Suggested fix:** Rewrite it as a chained ternary, or assign the result inside each `switch` arm body (`switch s\n  "A" => x := ...`).

### udf-param-default-unsupported

- **Code:** `pine-converter/parse/udf-param-default-unsupported`
- **Severity:** error
- **Message:** A user-defined function parameter has a default value; default-valued UDF params are not supported in v1, so the whole declaration was skipped.
- **Suggested fix:** Drop the parameter default and pass the value explicitly at every call site.

### udf-typed-param-unsupported

- **Code:** `pine-converter/parse/udf-typed-param-unsupported`
- **Severity:** warning
- **Message:** A user-defined function parameter has a type annotation; Pine v1 UDF params are treated as untyped, so the type was dropped and the bare name kept.
- **Suggested fix:** Remove the parameter type (`f(x) =>` instead of `f(float x) =>`); the converter infers types from usage.

### unexpected-token

- **Code:** `pine-converter/parse/unexpected-token`
- **Severity:** error
- **Message:** Unexpected token.

### unsupported-for-in

- **Code:** `pine-converter/parse/unsupported-for-in`
- **Severity:** error
- **Message:** `for ... in` loops are not supported.
- **Suggested fix:** Rewrite as a literal-bounded `for i = a to b` loop.

### unsupported-library

- **Code:** `pine-converter/parse/unsupported-library`
- **Severity:** error
- **Message:** `library(...)` declarations are not supported.
- **Suggested fix:** Inline the exported functions into an `indicator(...)` script.

### unsupported-library-import

- **Code:** `pine-converter/parse/unsupported-library-import`
- **Severity:** error
- **Message:** `import` of a Pine library is not supported.
- **Suggested fix:** Inline the imported library's logic into this script.

### unsupported-method

- **Code:** `pine-converter/parse/unsupported-method`
- **Severity:** error
- **Message:** `method` declarations are not supported.
- **Suggested fix:** Rewrite the method as a free function call.

### unsupported-pine-version

- **Code:** `pine-converter/parse/unsupported-pine-version`
- **Severity:** error
- **Message:** Only Pine Script v6 is supported.
- **Suggested fix:** Change the directive to `//@version=6`.

### unsupported-strategy

- **Code:** `pine-converter/parse/unsupported-strategy`
- **Severity:** error
- **Message:** `strategy(...)` declarations are not supported.
- **Suggested fix:** Strip the backtester and convert the signal logic as an `indicator(...)`.

### unsupported-udt

- **Code:** `pine-converter/parse/unsupported-udt`
- **Severity:** error
- **Message:** User-defined `type` declarations are not supported.
- **Suggested fix:** Replace the UDT with plain variables or arrays of primitives.

### unsupported-while

- **Code:** `pine-converter/parse/unsupported-while`
- **Severity:** error
- **Message:** `while` loops are not supported.
- **Suggested fix:** Rewrite as a literal-bounded `for i = a to b` loop.

### accidental-shadowing

- **Code:** `pine-converter/semantic/accidental-shadowing`
- **Severity:** warning
- **Message:** Assignment with `=` re-declares a variable from an enclosing scope.
- **Suggested fix:** Use `:=` to reassign the existing variable, or rename to declare a new one.

### dynamic-handle-collection

- **Code:** `pine-converter/semantic/dynamic-handle-collection`
- **Severity:** info
- **Message:** Bounded drawing collection with no explicit eviction; relying on the indicator cap.
- **Suggested fix:** Add a `max_*_count` argument or an explicit ring-buffer eviction.

### history-on-non-series

- **Code:** `pine-converter/semantic/history-on-non-series`
- **Severity:** warning
- **Message:** History access `[n]` applied to a non-series value.
- **Suggested fix:** History can only be taken on a series; check the operand's type.

### udf-arity-mismatch

- **Code:** `pine-converter/semantic/udf-arity-mismatch`
- **Severity:** warning
- **Message:** A user-defined function is called with a different number of arguments than it declares.
- **Suggested fix:** Pass exactly one argument per declared parameter at the call site.

### udf-recursive-rejected

- **Code:** `pine-converter/semantic/udf-recursive-rejected`
- **Severity:** error
- **Message:** A user-defined function is recursive (it calls itself directly or through a cycle); chartlang cannot inline a recursive call graph.
- **Suggested fix:** Rewrite the helper iteratively (a literal-bounded `for` loop), or unfold the recursion by hand.

### unbounded-handle-collection

- **Code:** `pine-converter/semantic/unbounded-handle-collection`
- **Severity:** error
- **Message:** Drawing collection has no detectable cap; no faithful chartlang analogue.
- **Suggested fix:** Cap the collection with a `max_*_count` argument or a ring-buffer eviction.

### unknown-identifier

- **Code:** `pine-converter/semantic/unknown-identifier`
- **Severity:** error
- **Message:** Reference to an undeclared identifier.
- **Suggested fix:** Declare the variable, or check for a typo in a built-in name.

### unsupported-tuple-destructuring

- **Code:** `pine-converter/semantic/unsupported-tuple-destructuring`
- **Severity:** info
- **Message:** Tuple destructuring is outside the v1 drawing scope.
- **Suggested fix:** Assign each returned value to its own variable.

### anchor-mirror-required

- **Code:** `pine-converter/transform/anchor-mirror-required`
- **Severity:** warning
- **Message:** A ring-update loop references a handle's prior anchor, which the ring does not store; a TODO was left.
- **Suggested fix:** Recompute the anchor from the original creation expression, or mirror it in a state slot.

### array-collection-non-numeric

- **Code:** `pine-converter/transform/array-collection-non-numeric`
- **Severity:** info
- **Message:** Persistent non-numeric collections are not supported in chartlang v1 (only numeric `state.array`).
- **Suggested fix:** Hold numeric values in the array, or track the non-numeric data with scalar `state.*` slots.

### array-reduction-not-mapped

- **Code:** `pine-converter/transform/array-reduction-not-mapped`
- **Severity:** warning
- **Message:** This `array.*` reduction has no chartlang analogue (nearest-rank percentile is deferred; only linear interpolation ships in v1), so it was left as a `Number.NaN` placeholder.
- **Suggested fix:** Use `array.percentile_linear_interpolation(...)` (→ `array.percentile`), or maintain the reduction yourself over the `state.array<number>` window.

### array-sort-returns-copy

- **Code:** `pine-converter/transform/array-sort-returns-copy`
- **Severity:** info
- **Message:** Pine `array.sort` sorts the array in place; chartlang `array.sort` / `<slot>.sort` returns a fresh sorted COPY and never mutates the ring, so reads of the original window after the sort are unchanged.
- **Suggested fix:** Capture the sorted copy (`const sorted = win.sort("desc")`) and read from it, instead of re-reading the original array.

### break-continue-outside-loop

- **Code:** `pine-converter/transform/break-continue-outside-loop`
- **Severity:** error
- **Message:** A `break`/`continue` appears outside any `for` loop; it has no loop to control and was dropped.
- **Suggested fix:** Move the `break`/`continue` inside a `for` loop, or remove it.

### camp-c-heuristic-applied

- **Code:** `pine-converter/transform/camp-c-heuristic-applied`
- **Severity:** info
- **Message:** A dynamic drawing collection was folded into a bounded ring by a Camp C heuristic.
- **Suggested fix:** Confirm the inferred cap matches Pine's runtime eviction; add an explicit `max_*_count` to be sure.

### cap-mismatch

- **Code:** `pine-converter/transform/cap-mismatch`
- **Severity:** info
- **Message:** The Pine cap exceeds the chartlang bucket cap; the ring capacity was clamped to the bucket limit.
- **Suggested fix:** Lower the Pine eviction cap to within the chartlang bucket limit.

### chart-point-from-index-without-xloc

- **Code:** `pine-converter/transform/chart-point-from-index-without-xloc`
- **Severity:** warning
- **Message:** `chart.point.from_index` used on a drawing whose `xloc` is `bar_time`; treated as `bar_index`.
- **Suggested fix:** Use `chart.point.from_time` for `xloc.bar_time` drawings.

### color-transp-approximated

- **Code:** `pine-converter/transform/color-transp-approximated`
- **Severity:** info
- **Message:** A `color.new(base, transp)` / `color.rgb(r, g, b, transp)` plot/hline/table colour was lowered with its Pine transparency converted to an alpha channel — a `#RRGGBBAA` hex for a literal base, or a `color.withAlpha(...)` call for a dynamic base.
- **Suggested fix:** No action needed; the alpha preserves the Pine transparency.

### computed-indicator-title

- **Code:** `pine-converter/transform/computed-indicator-title`
- **Severity:** error
- **Message:** The indicator title is computed; chartlang requires a string-literal `name`.
- **Suggested fix:** Replace the computed title with a string literal.

### cross-collection-linefill

- **Code:** `pine-converter/transform/cross-collection-linefill`
- **Severity:** error
- **Message:** `linefill.new` across two collections has no chartlang analogue.
- **Suggested fix:** Use a single `draw.path(...)` over the pair of anchor points instead.

### cross-mount-state-not-preserved

- **Code:** `pine-converter/transform/cross-mount-state-not-preserved`
- **Severity:** info
- **Message:** A `var` handle with a non-`na` initial value is reset to its creation branch on a cold mount.
- **Suggested fix:** Re-create the handle inside a `barstate.isfirst` guard if cold-restart parity matters.

### drawing-only-script

- **Code:** `pine-converter/transform/drawing-only-script`
- **Severity:** info
- **Message:** Script emits only drawings; converted as a `defineDrawing` (plot capability dropped).
- **Suggested fix:** Add a `plot(...)` call if the script should remain a `defineIndicator`.

### dynamic-bar-index

- **Code:** `pine-converter/transform/dynamic-bar-index`
- **Severity:** warning
- **Message:** Non-literal arithmetic on `bar_index`; the offset direction is a best-effort guess.
- **Suggested fix:** Use a literal offset (`bar_index + 10`) so the anchor resolves deterministically.

### dynamic-handle-index

- **Code:** `pine-converter/transform/dynamic-handle-index`
- **Severity:** error
- **Message:** `array.get(arr, expr)` with a non-literal-bounded index has no faithful ring analogue.
- **Suggested fix:** Replace dynamic indexing with a `for i = 0 to K - 1` loop where K is a literal.

### dynamic-series-index

- **Code:** `pine-converter/transform/dynamic-series-index`
- **Severity:** error
- **Message:** Series history `x[n]` with a non-literal `n` is not supported in chartlang.
- **Suggested fix:** Use a literal offset, or read the value through a `ta.*` window primitive.

### explicit-plot-zorder-default

- **Code:** `pine-converter/transform/explicit-plot-zorder-default`
- **Severity:** info
- **Message:** Pine `explicit_plot_zorder` is the default in chartlang (marks layer by declaration order within their group); no flag is needed and none is emitted.
- **Suggested fix:** Remove the argument; chartlang always orders marks by declaration order, so the flag is a no-op either way.

### fill-not-mapped

- **Code:** `pine-converter/transform/fill-not-mapped`
- **Severity:** error
- **Message:** `fill(plot1, plot2, ...)` has no chartlang analogue (no plot-fill primitive in v1).
- **Suggested fix:** Draw the band as an explicit `draw.rectangle`/`draw.path` instead.

### for-in-line-all

- **Code:** `pine-converter/transform/for-in-line-all`
- **Severity:** error
- **Message:** Bulk iteration over `line.all`/`box.all`/`label.all` (or `for ... in array`) is not supported.
- **Suggested fix:** Track the handles explicitly in a `var array<line>` (Camp B).

### handle-copy

- **Code:** `pine-converter/transform/handle-copy`
- **Severity:** error
- **Message:** Drawing `*.copy(handle)` has no chartlang analogue (handles aren't first-class values).
- **Suggested fix:** Re-create the drawing at the new location instead of copying it.

### handle-store-in-udt

- **Code:** `pine-converter/transform/handle-store-in-udt`
- **Severity:** error
- **Message:** A drawing handle stored in a user-defined type is not supported in v1.
- **Suggested fix:** Hoist the handle into a `var line/label/box` declaration at the script top level.

### indicator-arg-not-mapped

- **Code:** `pine-converter/transform/indicator-arg-not-mapped`
- **Severity:** warning
- **Message:** This `indicator(...)` argument has no chartlang analogue and was dropped.
- **Suggested fix:** Remove the argument or replicate its effect in the chartlang adapter.

### inline-input-promoted

- **Code:** `pine-converter/transform/inline-input-promoted`
- **Severity:** info
- **Message:** An inline `input.*` call was promoted to a named top-level input.
- **Suggested fix:** Name the input explicitly (`len = input.int(20)`) to control its key.

### input-arg-not-mapped

- **Code:** `pine-converter/transform/input-arg-not-mapped`
- **Severity:** warning
- **Message:** This `input.*` argument has no chartlang analogue and was dropped.
- **Suggested fix:** Remove the argument; chartlang inputs do not model it.

### input-enum-rejected

- **Code:** `pine-converter/transform/input-enum-rejected`
- **Severity:** error
- **Message:** `input.enum(...)` is not supported; Pine enums are UDT-backed in v6.
- **Suggested fix:** Replace the enum input with an `input.string(...)` of allowed values.

### input-string-options-default-mismatch

- **Code:** `pine-converter/transform/input-string-options-default-mismatch`
- **Severity:** warning
- **Message:** An `input.string(default, options=[…])` default is not one of the listed options; the `input.enum` is still emitted with the given default.
- **Suggested fix:** Set the default to one of the `options=` values so the dropdown opens on a valid selection.

### input-string-options-not-literal

- **Code:** `pine-converter/transform/input-string-options-not-literal`
- **Severity:** warning
- **Message:** An `input.string(options=[…])` list is not a uniform set of string literals (a non-literal or mixed-type element); it could not become an `input.enum`, so the options were dropped and a plain `input.string` was emitted.
- **Suggested fix:** List the dropdown choices as plain string literals (`options=["SMA", "EMA"]`).

### label-style-not-mapped

- **Code:** `pine-converter/transform/label-style-not-mapped`
- **Severity:** warning
- **Message:** This `label.style_*` value has no chartlang analogue and was dropped.
- **Suggested fix:** Use a `label.style_*` value with a chartlang `draw.*` mapping.

### linefill-color-transp-approximated

- **Code:** `pine-converter/transform/linefill-color-transp-approximated`
- **Severity:** info
- **Message:** `color.new(color, transp)` was folded to a `#RRGGBBAA` hex with the transparency converted to an alpha channel.
- **Suggested fix:** No action needed; the alpha hex preserves the Pine transparency.

### linefill-over-ring

- **Code:** `pine-converter/transform/linefill-over-ring`
- **Severity:** error
- **Message:** `linefill.new` over ring-buffer elements has no chartlang analogue (Camp C territory).
- **Suggested fix:** Draw the fill as an explicit `draw.rectangle`/`draw.frame` instead.

### linefill-series-fill

- **Code:** `pine-converter/transform/linefill-series-fill`
- **Severity:** info
- **Message:** A `linefill` between two bar-by-bar updated lines lowers to a single `draw.fillBetween` band that tracks the two lines' latest anchors each bar.
- **Suggested fix:** No action needed; the band re-anchors to both lines every bar.

### loop-body-unrolled

- **Code:** `pine-converter/transform/loop-body-unrolled`
- **Severity:** info
- **Message:** A `for` loop with a stateful body was unrolled at convert time into one statement per iteration.
- **Suggested fix:** No action needed; the unrolled copies reproduce the per-iteration call sites.

### loop-bounds-not-literal-for-stateful-body

- **Code:** `pine-converter/transform/loop-bounds-not-literal-for-stateful-body`
- **Severity:** error
- **Message:** A `for` loop whose body calls a stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) needs compile-time-resolvable bounds so it can be unrolled.
- **Suggested fix:** Lift the stateful call out of the loop, or use a literal `for i = 0 to N` bound.

### loop-unroll-frozen-at-input-default

- **Code:** `pine-converter/transform/loop-unroll-frozen-at-input-default`
- **Severity:** info
- **Message:** A `for` loop bound came from an `input.int` default; the unrolled iteration count is frozen at that default and will not follow the input at runtime.
- **Suggested fix:** Use a literal bound if the iteration count must stay fixed, or accept the frozen default.

### map-builtin-not-mapped

- **Code:** `pine-converter/transform/map-builtin-not-mapped`
- **Severity:** warning
- **Message:** This `map.*` member has no chartlang analogue over a `state.map` slot (key/value iteration — `map.keys`/`map.values` — is unsupported in v1; chartlang exposes `keyAt(i)` + `size` bounded indexing, not iterators), so it was left as a `Number.NaN` placeholder.
- **Suggested fix:** Walk the map with a literal-bounded `for (let i = 0; i < <slot>.size; i++)` over `<slot>.keyAt(i)` instead of `map.keys`/`map.values`.

### map-capacity-synthesized

- **Code:** `pine-converter/transform/map-capacity-synthesized`
- **Severity:** info
- **Message:** Pine `map.new<K, V>()` is unbounded, but chartlang `state.map<K, V>(capacity)` requires a compile-time literal capacity (so the keyed store is bounded and snapshot-clean), so a default bound of 1000 was synthesized.
- **Suggested fix:** Set a real bound on the emitted `state.map<number, number>(1000)` based on how many distinct keys the map can hold (a new key over capacity evicts the oldest-inserted one).

### map-collection-non-numeric

- **Code:** `pine-converter/transform/map-collection-non-numeric`
- **Severity:** info
- **Message:** This `map.new(...)` has a non-numeric value type (`map<K, bool|string|color>`); chartlang `state.map`'s v1 value type is `number`, so the map was left as-is rather than lowered to a `state.map` slot.
- **Suggested fix:** Restructure the map to a numeric `value` type, or maintain the keyed string/bool state yourself outside a `state.map`.

### math-not-mapped

- **Code:** `pine-converter/transform/math-not-mapped`
- **Severity:** warning
- **Message:** This `math.*` member has no chartlang analogue (or is rejected); the call was passed through unchanged.
- **Suggested fix:** Replace the call with a supported `math.*`/`Math.*` member.

### math-rolling-window-unmapped

- **Code:** `pine-converter/transform/math-rolling-window-unmapped`
- **Severity:** warning
- **Message:** Pine `math.sum`/`math.avg(source, length)` is a rolling-window reduction; chartlang's scalar `math.sum`/`math.avg` is variadic-scalar, not rolling, and there is no `ta` rolling-sum analogue (`ta.cum` is unmapped), so the call was passed through unchanged.
- **Suggested fix:** Maintain the window yourself with a `state.array<number>(length)` (push the source each bar, sum/average the elements), or use a `ta.*` moving average where one fits.

### max-count-out-of-range

- **Code:** `pine-converter/transform/max-count-out-of-range`
- **Severity:** warning
- **Message:** A `max_*_count` value exceeds the chartlang bucket cap; clamped to the cap.
- **Suggested fix:** Lower the `max_*_count` value to within the chartlang bucket limit.

### mtf-series-to-scalar-conversion

- **Code:** `pine-converter/transform/mtf-series-to-scalar-conversion`
- **Severity:** info
- **Message:** `request.security(...)` returns a series; `.current` was inserted where a scalar value is expected.
- **Suggested fix:** No action needed; `.current` reads the latest secondary-stream value.

### multi-return-arg-dropped

- **Code:** `pine-converter/transform/multi-return-arg-dropped`
- **Severity:** info
- **Message:** A Pine argument has no chartlang equivalent on the multi-output primitive and was dropped (e.g. `ta.kc`'s explicit source / `useTrueRange`).
- **Suggested fix:** No action needed if the default matches your script; otherwise adjust the chartlang call by hand.

### multi-return-arity-mismatch

- **Code:** `pine-converter/transform/multi-return-arity-mismatch`
- **Severity:** warning
- **Message:** A tuple destructuring binds more outputs than the chartlang result exposes (e.g. `ta.dmi`'s ADX); the extra names were left unresolved.
- **Suggested fix:** Drop the unsupported output, or read it from its dedicated primitive (e.g. ADX via `ta.adx`).

### multi-return-not-mapped

- **Code:** `pine-converter/transform/multi-return-not-mapped`
- **Severity:** warning
- **Message:** A tuple destructuring `[a, b] = …` reads from a call that is not a recognised multi-output `ta.*`; the elements were left unresolved.
- **Suggested fix:** Destructure a supported multi-output (`ta.macd`/`ta.bb`/`ta.kc`/`ta.dmi`/`ta.supertrend`), or assign each output to its own variable.

### negative-array-index

- **Code:** `pine-converter/transform/negative-array-index`
- **Severity:** error
- **Message:** Negative array indices are not supported on a chartlang ring buffer.
- **Suggested fix:** Use `array.last(...)` for the newest element instead of `array.get(.., -1)`.

### nested-ta-lowered

- **Code:** `pine-converter/transform/nested-ta-lowered`
- **Severity:** info
- **Message:** A nested `ta.*` call in a scalar position (an operator operand, a ternary arm, or a `math.*` argument) was projected to its per-bar `.current` scalar so the surrounding arithmetic type-checks.
- **Suggested fix:** No action needed — the `.current` projection is the per-bar number Pine uses; the `ta.*` series keeps its own per-call-site history.

### nested-ta-not-lowered

- **Code:** `pine-converter/transform/nested-ta-not-lowered`
- **Severity:** warning
- **Message:** A `ta.*` call was left as a `Series` in a scalar position because its name is unmapped or rejected; the generated arithmetic may not type-check (a `Series<number>` where a `number` is required).
- **Suggested fix:** Map the `ta.*` name (or rewrite the expression by hand), then read its `.current` scalar before the surrounding arithmetic.

### non-literal-input-default

- **Code:** `pine-converter/transform/non-literal-input-default`
- **Severity:** error
- **Message:** `input.*` default value must be a compile-time literal.
- **Suggested fix:** Replace the computed default with a literal value.

### non-literal-source-input

- **Code:** `pine-converter/transform/non-literal-source-input`
- **Severity:** error
- **Message:** `input.source(...)` default must be an OHLCV built-in; a computed source is not supported.
- **Suggested fix:** Pass `close`, `open`, `high`, `low`, `volume`, `hl2`, `hlc3`, etc.

### nz-scalar-assumed

- **Code:** `pine-converter/transform/nz-scalar-assumed`
- **Severity:** info
- **Message:** Pine `nz(...)` was lowered to the scalar `math.nz(...)`. chartlang separates scalar NaN-coalescing (`math.nz`) from the series form (`ta.nz`); the scalar form was assumed.
- **Suggested fix:** If the argument is a series whose history you coalesce, switch the emitted `math.nz(...)` to `ta.nz(...)` by hand.

### partial-anchor-filled

- **Code:** `pine-converter/transform/partial-anchor-filled`
- **Severity:** info
- **Message:** A whole-anchor setter moved only one endpoint; the unset anchor was filled from the creation expression so the patch is a complete tuple. The filled endpoint re-evaluates each bar instead of staying frozen.
- **Suggested fix:** Set both `set_xy1` and `set_xy2`, or mirror the fixed endpoint in a state slot if it must stay put.

### plot-offset-needs-ta-call

- **Code:** `pine-converter/transform/plot-offset-needs-ta-call`
- **Severity:** warning
- **Message:** Pine plot `offset=` only maps when the plotted value is a direct `ta.*` call; chartlang's offset lives on the `ta.*` opts. Offset dropped.
- **Suggested fix:** Wrap the value in a `ta.*` primitive (e.g. `ta.sma(value, 1)`), or set the offset on the indicator's `ta.*` call.

### plot-offset-overrides-ta-offset

- **Code:** `pine-converter/transform/plot-offset-overrides-ta-offset`
- **Severity:** warning
- **Message:** The Pine plot-level `offset=` replaced the `offset` already set on the plotted `ta.*` call; the plot-level offset is the source of truth.
- **Suggested fix:** Remove the `offset` argument on the `ta.*` call, or drop the plot-level `offset=` so the two no longer conflict.

### polyline-closed-info

- **Code:** `pine-converter/transform/polyline-closed-info`
- **Severity:** info
- **Message:** `polyline.new(closed=true)` maps to `draw.path(..., { closed: true })`.
- **Suggested fix:** No action needed; the path closes the anchor loop.

### polyline-curved-anchors-warning

- **Code:** `pine-converter/transform/polyline-curved-anchors-warning`
- **Severity:** warning
- **Message:** `polyline.new(curved=true)` with more than 3 anchors maps to a straight `draw.polyline`; chartlang's smooth `draw.curve` takes exactly 3 anchors.
- **Suggested fix:** Split the curve into 3-anchor segments, or accept the straight polyline.

### polyline-dynamic-points

- **Code:** `pine-converter/transform/polyline-dynamic-points`
- **Severity:** error
- **Message:** `polyline.new` over a dynamically-sized anchor array has no chartlang analogue.
- **Suggested fix:** Build the anchor list in a literal-bounded `for (let i = 0; i < K; i++)` loop.

### request-security-different-symbol

- **Code:** `pine-converter/transform/request-security-different-symbol`
- **Severity:** info
- **Message:** `request.security` on a different symbol was mapped to chartlang multi-symbol (`{ symbol, interval }`); the adapter must advertise the `multiSymbol` capability or the series degrades to NaN.
- **Suggested fix:** Confirm your adapter supports `multiSymbol`; otherwise drop the cross-symbol read or request the chart's own symbol.

### request-security-lookahead-not-supported

- **Code:** `pine-converter/transform/request-security-lookahead-not-supported`
- **Severity:** warning
- **Message:** The `lookahead` parameter on `request.security` has no chartlang analogue and was dropped.
- **Suggested fix:** Remove the `lookahead` argument; chartlang MTF reads are non-repainting.

### request-security-not-mapped

- **Code:** `pine-converter/transform/request-security-not-mapped`
- **Severity:** error
- **Message:** This `request.security(...)` shape is outside the v1 single-symbol intraday MTF subset.
- **Suggested fix:** Use `request.security(syminfo.tickerid, "<timeframe>", <ohlcv>)` with a string-literal timeframe.

### requires-bar-interval

- **Code:** `pine-converter/transform/requires-bar-interval`
- **Severity:** error
- **Message:** Future `bar_index + N` anchor needs a bar interval, but `barInterval` is null.
- **Suggested fix:** Pass `barInterval` (ms per bar) in the converter options.

### ring-buffer-zero-cap

- **Code:** `pine-converter/transform/ring-buffer-zero-cap`
- **Severity:** error
- **Message:** The ring-buffer capacity resolved to zero or negative; the site was skipped.
- **Suggested fix:** Give the collection a positive `max_*_count` / eviction cap.

### ring-eviction-implicit

- **Code:** `pine-converter/transform/ring-eviction-implicit`
- **Severity:** info
- **Message:** The explicit `array.shift`/`*.delete` FIFO eviction was removed; the ring buffer evicts implicitly.
- **Suggested fix:** No action needed; the ring's modulo-K write reproduces the eviction.

### scalar-state-type-defaulted

- **Code:** `pine-converter/transform/scalar-state-type-defaulted`
- **Severity:** info
- **Message:** A `var`/`varip` scalar's type could not be inferred from its initializer; it was defaulted to `state.float`.
- **Suggested fix:** Give the variable a literal initial value so its type can be inferred.

### series-history-non-numeric

- **Code:** `pine-converter/transform/series-history-non-numeric`
- **Severity:** info
- **Message:** History indexing on a non-numeric `var` is not supported in chartlang v1 (only numeric series).
- **Suggested fix:** Track the boolean/string history yourself, or convert the value to a number before indexing it.

### set-path-unsupported

- **Code:** `pine-converter/transform/set-path-unsupported`
- **Severity:** info
- **Message:** A single-coordinate setter (`set_x1`/`set_y1`/…) cannot be folded into the tuple patch and was dropped.
- **Suggested fix:** Use the whole-anchor setter (`set_xy1`/`set_xy2`) so both coordinates fold together.

### setter-fold-cross-branch

- **Code:** `pine-converter/transform/setter-fold-cross-branch`
- **Severity:** info
- **Message:** A drawing handle is mutated across multiple branches; one `update({...})` is emitted per branch.
- **Suggested fix:** No action needed; the per-branch folding preserves the Pine behaviour.

### stateful-loop-with-break

- **Code:** `pine-converter/transform/stateful-loop-with-break`
- **Severity:** error
- **Message:** A `for` loop with a `break`/`continue` AND a stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) in its body cannot be converted: chartlang forbids a stateful call inside a loop, and a `break`/`continue` body cannot be unrolled.
- **Suggested fix:** Lift the stateful call out of the loop, or drop the `break`/`continue` so the loop can unroll.

### str-format-not-mapped

- **Code:** `pine-converter/transform/str-format-not-mapped`
- **Severity:** warning
- **Message:** This `str.format`/`str.tostring` format string could not be lowered; the call was passed through unchanged.
- **Suggested fix:** Use a simple "#.##" precision format, or format the value by hand.

### str-not-mapped

- **Code:** `pine-converter/transform/str-not-mapped`
- **Severity:** warning
- **Message:** This `str.*` member has no chartlang analogue; the call was passed through unchanged.
- **Suggested fix:** Use one of the supported `str.*` members or a plain JavaScript string op.

### strategy-as-indicator

- **Code:** `pine-converter/transform/strategy-as-indicator`
- **Severity:** info
- **Message:** `strategy(...)` was stripped to a `defineIndicator`; backtester args were dropped.
- **Suggested fix:** Re-create order logic as `alert(...)` emissions in the converted script.

### strategy-signal-only

- **Code:** `pine-converter/transform/strategy-signal-only`
- **Severity:** info
- **Message:** A `strategy.*` order call was lowered to an `alert(...)`; order sizing/fills are not reproduced.
- **Suggested fix:** Wire the alert into your own execution layer if you need order semantics.

### ta-not-mapped

- **Code:** `pine-converter/transform/ta-not-mapped`
- **Severity:** warning
- **Message:** This `ta.*` member has no chartlang analogue; the call was passed through unchanged.
- **Suggested fix:** Replace the call with a supported `ta.*` member or an inline computation.

### ta-signature-divergence

- **Code:** `pine-converter/transform/ta-signature-divergence`
- **Severity:** warning
- **Message:** This `ta.*` call maps to a chartlang member whose signature differs; the arguments were passed through as-is.
- **Suggested fix:** Check the chartlang `ta.*` signature and adjust the arguments by hand.

### table-bucket-cap-adjusted

- **Code:** `pine-converter/transform/table-bucket-cap-adjusted`
- **Severity:** info
- **Message:** The `other` drawing-bucket cap was raised to fit the converted tables.
- **Suggested fix:** No action needed; the cap was widened to match the table count.

### table-cell-out-of-bounds

- **Code:** `pine-converter/transform/table-cell-out-of-bounds`
- **Severity:** error
- **Message:** A `table.cell(...)` write addresses a cell outside the declared `(columns, rows)` grid.
- **Suggested fix:** Raise the `table.new(position, columns, rows)` counts or fix the index.

### table-clear-noop

- **Code:** `pine-converter/transform/table-clear-noop`
- **Severity:** info
- **Message:** `table.clear(...)` is a no-op; the converted table is rebuilt from scratch each `barstate.islast` tick.
- **Suggested fix:** No action needed; the rebuild already starts from an empty grid.

### table-dynamic-loop

- **Code:** `pine-converter/transform/table-dynamic-loop`
- **Severity:** error
- **Message:** A loop that writes table cells has a non-literal bound; chartlang requires a literal-bounded unroll.
- **Suggested fix:** Use a literal `for i = 0 to N` bound so the cell writes can be unrolled.

### table-formatting-not-mapped

- **Code:** `pine-converter/transform/table-formatting-not-mapped`
- **Severity:** warning
- **Message:** Pine's `text_formatting`/`text_font_family`/`text_wrap` cell options have no chartlang analogue and were dropped.
- **Suggested fix:** chartlang `TableCell` models text, colors, alignment, and size only.

### table-merge-fallback

- **Code:** `pine-converter/transform/table-merge-fallback`
- **Severity:** warning
- **Message:** `table.merge_cells(...)` has no chartlang analogue; the merged span keeps the top-left cell and blanks the rest.
- **Suggested fix:** Lay the data out in unmerged cells, or accept the top-left-only fallback.

### table-multi-init

- **Code:** `pine-converter/transform/table-multi-init`
- **Severity:** warning
- **Message:** A `table` variable is initialised by more than one `table.new(...)`; the first wins.
- **Suggested fix:** Create the table once; mutate its cells rather than re-creating it.

### time-builtin-not-mapped

- **Code:** `pine-converter/transform/time-builtin-not-mapped`
- **Severity:** warning
- **Message:** This calendar built-in call shape is not mapped (only `time()`, `time_close()`, and `dayofweek(t[, tz])` lower in v1).
- **Suggested fix:** Use the bare epoch (`bar.time`) with the `time.*` / `session.*` accessors — e.g. `session.isOpen(bar.time, "0930-1600")` instead of the `time(timeframe, session)` form.

### udf-arg-hoisted

- **Code:** `pine-converter/transform/udf-arg-hoisted`
- **Severity:** info
- **Message:** A non-trivial argument to an inlined stateful user-defined function was hoisted to a temporary so it is evaluated exactly once (Pine evaluates each argument once; substituting it inline could re-evaluate it or duplicate its `ta.*` state).
- **Suggested fix:** No action needed — the temporary preserves Pine's evaluate-once argument semantics.

### udf-emitted-function

- **Code:** `pine-converter/transform/udf-emitted-function`
- **Severity:** info
- **Message:** A pure (state-free) user-defined function was emitted as a reusable chartlang arrow function at the top of `compute`, and every call site reuses it (no inlining needed — a pure helper is referentially transparent).
- **Suggested fix:** No action needed — a single shared function is semantically identical to Pine's per-call evaluation for a state-free helper.

### udf-inlined

- **Code:** `pine-converter/transform/udf-inlined`
- **Severity:** info
- **Message:** A stateful user-defined function call was inline-expanded at its call site so each `ta.*`/`state.*` it contains gets an independent slot (Pine instances stateful helper state per call site; a shared function would cross-contaminate it).
- **Suggested fix:** No action needed — inlining reproduces Pine's per-call-site state instancing for a stateful helper.

### unbounded-array-collection

- **Code:** `pine-converter/transform/unbounded-array-collection`
- **Severity:** error
- **Message:** A persistent numeric array with no detectable capacity cannot be bounded; chartlang has no unbounded collection.
- **Suggested fix:** Add a FIFO eviction guard (`if array.size(coll) > K` → `array.shift(coll)`) or size the array via `array.new<float>(K)` so the capacity is a literal.

### unknown-input-primitive

- **Code:** `pine-converter/transform/unknown-input-primitive`
- **Severity:** warning
- **Message:** Unrecognised `input.*` primitive; no chartlang analogue, input dropped.
- **Suggested fix:** Use one of the supported `input.*` primitives.

### unresolved-bar-index

- **Code:** `pine-converter/transform/unresolved-bar-index`
- **Severity:** warning
- **Message:** Coordinate argument is not a recognised `bar_index` pattern; using offset 0.
- **Suggested fix:** Anchor on `bar_index`, `bar_index[N]`, or `bar_index + N`.

### varip-approximated

- **Code:** `pine-converter/transform/varip-approximated`
- **Severity:** info
- **Message:** `varip` drawing-handle persistence has no exact chartlang analogue; intra-bar rollback is not reproduced.
- **Suggested fix:** Confirm the handle does not rely on Pine's tick-rollback semantics.

### varip-series-approximated

- **Code:** `pine-converter/transform/varip-series-approximated`
- **Severity:** info
- **Message:** A history-indexed `varip` scalar lowers to a (non-tick) `state.series`; intra-bar tick-rollback of the history is not reproduced.
- **Suggested fix:** Confirm the series history does not rely on Pine's `varip` tick-rollback semantics.

### yloc-padding-approximated

- **Code:** `pine-converter/transform/yloc-padding-approximated`
- **Severity:** info
- **Message:** `yloc.abovebar`/`yloc.belowbar` was approximated as a fixed fraction of the bar range.
- **Suggested fix:** Tune the `0.001` bar-range padding fraction in the generated anchor if the default offset is too tight.
