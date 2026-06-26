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
> The one shape this does not cover is a pure helper that history-indexes its own
> param (`f(src) => src - src[1]`): `number[1]` is a `TS7053` error and a sound
> series type is the same `state.series` promotion the stateful history-indexed
> case below defers. Promote the value by hand, or pass it through a `ta.*`
> window primitive.

> **v1 limitation — a stateful helper that indexes a *param's* history.** A
> helper whose body reads `param[1]` (e.g. Trend Wizard's
> `cf_slope(ma, n) => ta.ema((ma - ma[1]) / ma[1] * 100, n)`) inlines correctly
> only when the argument is itself a **series** that supports history — an OHLCV
> field (`cf_slope(close, 3)` → `bar.close[1]`, fine). Applied to a **derived**
> value (`ma_1 = ta.ema(close, 8)`, which lowers to a `.current` scalar), the
> inlined `ma_1[1]` indexes a `number` (`TS7053`). Promote the derived value to
> a `state.series` by hand, or read the prior bar through a `ta.*` window
> primitive. Auto-promoting a history-indexed inlined argument is a planned
> follow-up.

### `switch` used as a value

A **`switch` in value position** — `x = switch s \n "A" => … ` (Trend Wizard's
`cf_ma` returns one) — is a clean reject:
[`switch-expression-unsupported`](./diagnostics.md#switch-expression-unsupported)
(error). The converter recovers the `switch` header + its indented arm block
and resumes at the next statement, so the rest of the script still converts.
Rewrite it as a chained ternary, or assign the result **inside each arm body**
(which IS supported — see the multi-assignment switch in
[supported.md](./supported.md#control-flow)):

```pine
// rejected — switch as a value
ma = switch ma_type
    "SMA" => ta.sma(src, len)
    "EMA" => ta.ema(src, len)

// supported — assign inside each arm
var float ma = na
switch ma_type
    "SMA" => ma := ta.sma(src, len)
    "EMA" => ma := ta.ema(src, len)
```

> **Deferred follow-up.** Lowering a value-position `switch` to a ternary chain
> (a new `SwitchExpression` AST node + Pratt-parser surgery) is a tracked
> follow-up, out of scope for the multi-assignment switch feature.

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
| [`input-enum-rejected`](./diagnostics.md#input-enum-rejected) | `input.enum(...)`. | Use `input.string(...)` of the allowed values. |
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
| [`fill-not-mapped`](./diagnostics.md#fill-not-mapped) | `fill(plot1, plot2, ...)`. | Draw the band with `draw.fillBetween(edgeA, edgeB, ...)` over the two series' anchors. A `plot`-level series fill is a planned follow-up. |
| [`plot-offset-needs-ta-call`](./diagnostics.md#plot-offset-needs-ta-call) | `plot(<value>, offset=N)` where `<value>` is **not** a direct `ta.*` call (a bare series, a variable, an arithmetic expression). The offset is dropped — chartlang's offset lives on the `ta.*` opts and there is no plot-level offset yet. | Wrap the value in a `ta.*` primitive, or set the offset on the indicator's `ta.*` call. A `plot`-level offset is a planned follow-up. |
| [`request-security-not-mapped`](./diagnostics.md#request-security-not-mapped) | A `request.security(...)` shape outside the v1 single-symbol MTF subset — a non-literal timeframe, an out-of-table timeframe, or missing positional args. (A `ta.*`/expression third arg is **supported** — it lowers to the callback form.) | Use a literal `"<timeframe>"`; the third arg may be a bare OHLCV field or a `ta.*` expression. |

## Internal

[`codegen-output-invalid`](./diagnostics.md#codegen-output-invalid) is
reserved for the async compile round-trip (`convertFile`): the converted
`.chart.ts` failed to compile through `@invinite-org/chartlang-compiler`.
If you hit this on a script that should convert, it is a converter bug —
please file it with the source.
