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
| [`computed-indicator-title`](./diagnostics.md#computed-indicator-title) | The `indicator(...)` title is computed. | Use a string-literal `name`. |

## Coordinates & control flow

| Code | When | Rewrite |
|---|---|---|
| [`requires-bar-interval`](./diagnostics.md#requires-bar-interval) | A future `bar_index + N` anchor with `barInterval` null. | Pass `barInterval` (ms per bar) — CLI `--bar-interval`. |
| [`dynamic-series-index`](./diagnostics.md#dynamic-series-index) | Series history `x[n]` with a non-literal `n`. | Use a literal offset, or a `ta.*` window primitive. |
| [`loop-bounds-not-literal-for-stateful-body`](./diagnostics.md#loop-bounds-not-literal-for-stateful-body) | A `for` whose body calls a stateful primitive has non-resolvable bounds. | Lift the stateful call out of the loop, or use a literal `for i = 0 to N`. |

## Tables & passthrough

| Code | When | Rewrite |
|---|---|---|
| [`table-cell-out-of-bounds`](./diagnostics.md#table-cell-out-of-bounds) | A `table.cell(...)` addresses a cell outside the declared grid. | Raise the `table.new(position, columns, rows)` counts or fix the index. |
| [`table-dynamic-loop`](./diagnostics.md#table-dynamic-loop) | A table-cell loop has a non-literal bound. | Use a literal `for i = 0 to N` bound so the writes unroll. |
| [`fill-not-mapped`](./diagnostics.md#fill-not-mapped) | `fill(plot1, plot2, ...)`. | Draw the band with `draw.fillBetween(edgeA, edgeB, ...)` over the two series' anchors. A `plot`-level series fill is a planned follow-up. |
| [`request-security-not-mapped`](./diagnostics.md#request-security-not-mapped) | A `request.security(...)` shape outside the v1 single-symbol MTF subset — a non-literal timeframe, an out-of-table timeframe, or missing positional args. (A `ta.*`/expression third arg is **supported** — it lowers to the callback form.) | Use a literal `"<timeframe>"`; the third arg may be a bare OHLCV field or a `ta.*` expression. |

## Internal

[`codegen-output-invalid`](./diagnostics.md#codegen-output-invalid) is
reserved for the async compile round-trip (`convertFile`): the converted
`.chart.ts` failed to compile through `@invinite-org/chartlang-compiler`.
If you hit this on a script that should convert, it is a converter bug —
please file it with the source.
