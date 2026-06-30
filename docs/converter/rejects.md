# Rejects + manual rewrites

A **reject** is an `error`-severity diagnostic: the converter could not
produce a faithful translation for that site. The emitted `.chart.ts`
carries a `// HARD-REJECT` marker (or omits the construct), so a rejected
script does not silently mis-convert. This page groups the rejects by
*why* they fire and gives the recommended Pine rewrite.

Every code below links to its entry in the
[diagnostics reference](./diagnostics.md). For the conceptual mapping
between the two languages, see the
[Pine migration guide](../spec/pine-migration.md).

## Declaration & language-level rejects

These fire at parse time — the construct has no v1 analogue at all.

| Code | When | Rewrite |
|---|---|---|
| [`unsupported-pine-version`](./diagnostics.md#unsupported-pine-version) | The `//@version` directive is not `6`. | Port to Pine v6 first. |
| [`missing-version-directive`](./diagnostics.md#missing-version-directive) | No `//@version=6` on the first line. | Add `//@version=6`. |
| [`unsupported-strategy`](./diagnostics.md#unsupported-strategy) | A `strategy(...)` declaration. | Strip the backtester; convert the signal logic as an `indicator(...)`, re-emitting orders as `alert(...)`. |
| [`unsupported-library`](./diagnostics.md#unsupported-library) / [`unsupported-library-import`](./diagnostics.md#unsupported-library-import) | A `library(...)` declaration or an `import` of one. | Inline the library's functions into the script. |
| [`unsupported-udt`](./diagnostics.md#unsupported-udt) | A user-defined `type`. | Replace the UDT with plain variables or arrays of primitives. |
| [`unsupported-method`](./diagnostics.md#unsupported-method) | A `method` declaration. | Rewrite the method as a free function. |
| [`unsupported-for-in`](./diagnostics.md#unsupported-for-in) / [`unsupported-while`](./diagnostics.md#unsupported-while) | A `for ... in` or `while` loop. | Rewrite as a literal-bounded `for i = a to b`. |
| [`for-in-line-all`](./diagnostics.md#for-in-line-all) | Bulk iteration over `line.all` / `box.all` / `label.all`. | Track the handles explicitly in a `var array<line>` (Camp B). |

> **Parser limitation:** the Pine `[...]` square-bracket **array literal**
> does not parse — `[` is only recognised as history access (`x[1]`). A
> `polyline.new([chart.point.A, ...])` literal-array does not convert; use
> the `var array<chart.point>` build-loop idiom instead (see
> [polyline rejects](#dynamic-drawing-collections)).

## User-defined functions

Pine user-defined functions convert (pure → reusable function, stateful →
inlined per call site; see [supported](./supported.md#user-defined-functions)).
A few param forms and constructs reject, and two v1 limitations stop a fully
faithful Trend Wizard port from type-checking.

| Code | When | Rewrite |
|---|---|---|
| [`udf-recursive-rejected`](./diagnostics.md#udf-recursive-rejected) | A UDF calls itself directly or through a cycle. chartlang cannot inline a recursive call graph. | Rewrite the recursion as a literal-bounded `for i = a to b` loop accumulating into a `var`. |
| [`udf-param-default-unsupported`](./diagnostics.md#udf-param-default-unsupported) | A param has a default value (`f(x = 2) => …`). The whole declaration rejects. | Drop the default and pass the value at every call site. |
| [`udf-typed-param-unsupported`](./diagnostics.md#udf-typed-param-unsupported) | A param is typed (`float x`). **Warning only** — the type is dropped and the bare name `x` is kept. | None needed; remove the type annotation to silence it. |
| [`udf-arity-mismatch`](./diagnostics.md#udf-arity-mismatch) | A call passes a different argument count than the declaration. **Warning only.** | Match the call to the declared parameter list. |

> **v1 note — a pure helper's params are typed `: number`.** A pure UDF emits as
> a `const f = (a: number, b: number) => …` arrow; the numeric annotation lets
> the compiler type-check it (an untyped param trips `noImplicitAny`/`TS7006`),
> and a `PriceSeries` call-site argument (`bar.close`) is assignable to `number`.
> **v1 limitation — a *pure* helper that history-indexes its own param.** A pure
> helper whose body reads `param[1]` (`f(src) => src - src[1]`) emits as
> `const f = (src: number) => src - src[1]`, and `number[1]` is a `TS7053`.
> Promote `src` to a `state.series` by hand, or pass it through a `ta.*` window
> primitive. (A *stateful* helper that does the same — `cf_slope` — no longer
> needs this; see the next note.)

> **Now supported — a *stateful* helper that indexes a *param's* history.** A
> stateful helper whose body reads `param[1]` (e.g. Trend Wizard's
> `cf_slope(ma, n) => ta.ema((ma - ma[1]) / ma[1] * 100, n)`) inlines cleanly
> whether the argument natively supports history — an OHLCV field
> (`cf_slope(close, 3)` → `bar.close[1]`) — **or** is a derived value: a
> simple-identifier argument passed to such a helper auto-promotes to a
> `state.series` slot (`ma_1 = ta.ema(close, 8)` → `const ma_1 =
> state.series(Number.NaN)`, written `ma_1.value = …` each bar), so the inlined
> `ma_1[1]` is a real indexed read. A history-indexed local *inside* an inlined
> stateful body (Trend Wizard's `cf_macross` `ma_cross[1]`) likewise gets its own
> per-call-site `state.series`/`state.boolSeries` slot. See
> [supported.md](./supported.md#sources-and-history).

### `switch` used as a value

A **`switch` in value position** — `x = switch s \n "A" => … ` (Trend Wizard's
`cf_ma` returns one) — **now converts**: it lowers to a chained ternary
(`s === "A" ? … : … : Number.NaN`), the first matching arm wins, a wildcard
`=> v` arm is the default, and an unmatched subject yields `na`. The
subject-less boolean form lowers each condition directly. See
[supported.md](./supported.md#control-flow).

The one residual reject is an arm whose **body is not a single expression** — a
multi-statement block, a comma list, or a `:=`/`=` assignment arm — which still
emits [`switch-expression-unsupported`](./diagnostics.md#switch-expression-unsupported)
(error) and degrades that `switch` to an unknown expression. Rewrite such an arm
as a statement-form `switch` that assigns into a `var`:

```pine
// converts — single-expression arms (value position)
ma = switch ma_type
    "SMA" => ta.sma(src, len)
    "EMA" => ta.ema(src, len)

// for a multi-statement / `:=` arm body, use the statement form instead
var float ma = na
switch ma_type
    "SMA" => ma := ta.sma(src, len)
    "EMA" => ma := ta.ema(src, len)
```

## Non-numeric state

A `var color` scalar and a history-indexed `var bool` / `var string` now lower
to first-class slots — `state.color`, `state.boolSeries`, and
`state.stringSeries` (see
[supported.md](./supported.md#non-numeric-persistent-state)). The one piece
still deferred is **color *history***:

| Code | When | Rewrite |
|---|---|---|
| [`series-history-non-numeric`](./diagnostics.md#series-history-non-numeric) | A `var color` is read with a history index (`exitClr[1]`). `bool`/`string` history is supported; only `color` history has no v1 slot. | Keep the prior-bar color in a second `state.color` you assign at the end of each bar, or recompute it from the numeric series the color is derived from. |

> **Deferred follow-up.** A `state.colorSeries` (the indexable color twin of
> `state.boolSeries` / `state.stringSeries`) is a tracked follow-up; v1 ships
> only the persistent color *scalar*.

## Dynamic drawing collections

The load-bearing reject class. chartlang has no analogue for an unbounded
collection of drawing handles, so a dynamic collection must be **capped**
to convert.

| Code | When | Rewrite |
|---|---|---|
| [`unbounded-handle-collection`](./diagnostics.md#unbounded-handle-collection) | A drawing collection with no detectable cap (no `max_*_count`, no ring eviction), or one declared only inside an `if`/`for` block. | Cap it: add `max_lines_count=K` (etc.) to `indicator(...)`, **or** add a ring-buffer eviction (`if array.size(coll) > K` → `array.shift`). Declare the collection at the **top level**. |
| [`dynamic-handle-index`](./diagnostics.md#dynamic-handle-index) | `array.get(arr, expr)` with a non-literal-bounded index. | Iterate with a literal `for i = 0 to K - 1` loop. |
| [`negative-array-index`](./diagnostics.md#negative-array-index) | `array.get(coll, -1)` (negative index). | Use `array.last(...)` for the newest element. |
| [`ring-buffer-zero-cap`](./diagnostics.md#ring-buffer-zero-cap) | The resolved ring capacity is `≤ 0`. | Give the collection a positive `max_*_count` / eviction cap. |
| [`polyline-dynamic-points`](./diagnostics.md#polyline-dynamic-points) | `polyline.new` over a dynamically-sized anchor array. | Build the anchor list in a literal-bounded `for i = 0 to K` loop over `chart.point.*` values. |
| [`handle-copy`](./diagnostics.md#handle-copy) | `line.copy(handle)` / `box.copy(...)` etc. | Re-create the drawing at the new location — handles are not first-class values. |
| [`handle-store-in-udt`](./diagnostics.md#handle-store-in-udt) | A drawing handle stored in a UDT field. | Hoist the handle into a top-level `var line/label/box`. |

## linefill rejects

| Code | When | Rewrite |
|---|---|---|
| [`linefill-over-ring`](./diagnostics.md#linefill-over-ring) | `linefill.new` over ring-buffer elements. | Pull the pair of anchors out of the ring and fill them with a single `draw.fillBetween(edgeA, edgeB, ...)`. |
| [`cross-collection-linefill`](./diagnostics.md#cross-collection-linefill) | `linefill.new` across two collections (`array.get(a, i)`, `array.get(b, i)`). | Fill the band directly with `draw.fillBetween(edgeA, edgeB, ...)` over the two anchor lists. |

A **static** two-line `linefill.new(lineA, lineB, color)` is *not* a reject
— it lowers to a true filled `draw.fillBetween` ribbon between the two
lines' anchors. The dynamic forms above reject only because chartlang has
no analogue for resolving a fill across an unbounded handle collection.

## Inputs & declaration args

| Code | When | Rewrite |
|---|---|---|
| [`input-enum-default-not-member`](./diagnostics.md#input-enum-default-not-member) | `input.enum(...)` default is not a declared `EnumType.member`. | Pass a member reference such as `Signal.buy`. |
| [`non-literal-input-default`](./diagnostics.md#non-literal-input-default) | An `input.*` default is computed. | Use a compile-time literal default. |
| [`non-literal-source-input`](./diagnostics.md#non-literal-source-input) | `input.source(...)` default is a computed series. | Pass an OHLCV built-in (`close`, `hl2`, …). |
| [`input-string-options-default-mismatch`](./diagnostics.md#input-string-options-default-mismatch) | An `input.string(default, options=[…])` default is not one of the options (the enum is still emitted). | Set the default to one of the `options=` values. |
| [`input-string-options-not-literal`](./diagnostics.md#input-string-options-not-literal) | An `input.string(options=[…])` list has a non-literal or mixed-type element (a plain `input.string` is emitted, options dropped). | List the choices as plain string literals. |
| [`computed-indicator-title`](./diagnostics.md#computed-indicator-title) | The `indicator(...)` title is computed. | Use a string-literal `name`. |

## Coordinates & control flow

| Code | When | Rewrite |
|---|---|---|
| [`requires-bar-interval`](./diagnostics.md#requires-bar-interval) | A future `bar_index + N` anchor with `barInterval` null. | Pass `barInterval` (ms per bar) — CLI `--bar-interval`. |
| [`dynamic-series-index`](./diagnostics.md#dynamic-series-index) | Series history `x[n]` with a non-literal `n`. | Use a literal offset, or a `ta.*` window primitive. |
| [`loop-bounds-not-literal-for-stateful-body`](./diagnostics.md#loop-bounds-not-literal-for-stateful-body) | A `for` whose body calls a stateful primitive has non-resolvable bounds. | Lift the stateful call out of the loop, or use a literal `for i = 0 to N`. |
| [`stateful-loop-with-break`](./diagnostics.md#stateful-loop-with-break) | A `for` body has **both** a stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) **and** a `break`/`continue`. The stateful call needs an unroll; the `break` forbids one. | Lift the stateful call out of the loop, or drop the `break`/`continue` so the loop can unroll. |
| [`break-continue-outside-loop`](./diagnostics.md#break-continue-outside-loop) | A `break`/`continue` with no enclosing `for` loop. | Move the `break`/`continue` inside a `for` loop, or remove it. |

## Tables & passthrough

| Code | When | Rewrite |
|---|---|---|
| [`table-cell-out-of-bounds`](./diagnostics.md#table-cell-out-of-bounds) | A `table.cell(...)` addresses a cell outside the declared grid. | Raise the `table.new(position, columns, rows)` counts or fix the index. |
| [`table-dynamic-loop`](./diagnostics.md#table-dynamic-loop) | A table-cell loop has a non-literal bound. | Use a literal `for i = 0 to N` bound so the writes unroll. |
| [`fill-handle-unresolved`](./diagnostics.md#fill-handle-unresolved) | A `fill(a, b, ...)` handle resolves to neither an `hline` nor a `plot` (an unbound name, a ring-buffer `array.get(...)`, a literal). The supported `fill(hline, hline)` / `fill(plot, plot)` band shape is in [supported](./supported.md#filled-bands-fill). | Pass two top-level (or inline) `hline(...)` / `plot(...)` handles to `fill(a, b, color)`. |
| [`fill-not-mapped`](./diagnostics.md#fill-not-mapped) | A `fill(...)` with a gradient (`top_color`/`bottom_color`/`top_value`/`bottom_value`) or `fillgaps` styling — the two-handle band itself is [supported](./supported.md#filled-bands-fill). | Drop the gradient / `fillgaps` styling, or draw the band as an explicit `draw.rectangle` / `draw.path`. |
| [`plot-offset-needs-ta-call`](./diagnostics.md#plot-offset-needs-ta-call) | `plot(<value>, offset=N)` where `<value>` is **not** a direct `ta.*` call (a bare series, a variable, an arithmetic expression). The offset is dropped — chartlang's offset lives on the `ta.*` opts and there is no plot-level offset yet. | Wrap the value in a `ta.*` primitive, or set the offset on the indicator's `ta.*` call. A `plot`-level offset is a planned follow-up. |
| [`request-security-not-mapped`](./diagnostics.md#request-security-not-mapped) | A `request.security(...)` shape outside the v1 single-symbol MTF subset — a non-literal timeframe, an out-of-table timeframe, or missing positional args. (A `ta.*`/expression third arg is **supported** — it lowers to the callback form.) | Use a literal `"<timeframe>"`; the third arg may be a bare OHLCV field or a `ta.*` expression. |
| [`request-security-expr-captures-series`](./diagnostics.md#request-security-expr-captures-series) | A `request.security(...)` expression callback captures an outer binding that is **bar-varying** (it depends on series / `ta.*` / OHLCV), so it cannot be reconstructed inside the higher-timeframe callback. A bar-**invariant** capture (one that bottoms out at `inputs`/`Math`/literals) is reconstructed automatically — no diagnostic. | Compute the higher-timeframe value inside the callback from `inputs`/OHLCV, or read it on the main timeframe instead of inside the source. |

## Internal

[`codegen-output-invalid`](./diagnostics.md#codegen-output-invalid) is
reserved for the async compile round-trip (`convertFile`): the converted
`.chart.ts` failed to compile through `@invinite-org/chartlang-compiler`.
If you hit this on a script that should convert, it is a converter bug —
please file it with the source.
