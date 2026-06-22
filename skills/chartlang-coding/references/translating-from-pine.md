# Translating from Pine Script

You are porting a Pine Script v6 indicator to chartlang, either by hand or
by interpreting the output of the `@invinite-org/chartlang-pine-converter`
tool. This reference is the **author's** view: "if your Pine script does
X, write it like Y." Implementer detail lives in the
[converter docs](https://chartlang.dev/converter/).

The converter's v1 slice is **drawings-focused**: `line.new`, `label.new`,
`box.new`, `table.new`, `polyline.new`, `linefill.new`, plus inputs,
control flow, state, and a partial `ta.*` / `math.*` passthrough. The
`plot` family (`plotshape`, `plotchar`, `plotarrow`) and the multi-output
`ta.*` indicators map too (see below). It is a source-to-source
translator — it emits chartlang `.chart.ts`, not a runtime bundle.

## Why might my Pine script not convert?

Run the converter and read the diagnostics. Each one carries a stable
**code**, a **severity**, a **source span**, and usually a suggested fix:

- **error** — the converter could not faithfully translate this site. The
  output carries a `// HARD-REJECT` marker. Fix the Pine and re-run, or
  hand-port that slice.
- **warning** — translated, but a detail was dropped or approximated.
  Review it.
- **info** — an intentional approximation; usually no action needed.

The CLI prints a `= docs:` link per diagnostic that goes straight to the
[diagnostics reference](https://chartlang.dev/converter/diagnostics). Under
`--strict`, every warning becomes an error.

## The three drawing camps

How you *manage* a Pine drawing handle decides how it converts. Match your
script to one of these shapes to get a clean conversion.

### Camp A — one handle, mutated each bar

Pine:

```text
var line lvl = na
lvl := line.new(bar_index, high, bar_index, high)
line.set_xy2(lvl, bar_index, low)
```

This is the cleanest case: a single `var`/`varip` handle, created once and
updated with `set_*` calls. It lowers to one chartlang drawing slot whose
setters fold into a single `update({...})` patch. **Write your single
persistent drawings this way.**

### Camp B — a bounded ring of handles

Pine — a `var array<line>` with FIFO eviction:

```text
var array<line> lines = array.new<line>()
array.push(lines, line.new(bar_index, high, bar_index, high))
if array.size(lines) > 50
    line.delete(array.shift(lines))
```

The explicit eviction (`array.size > K` → `array.shift`) is the signal
that caps the collection. It converts to a fixed-capacity chartlang ring;
the eviction block is removed (the ring rotates internally) and an info
notes the elision. **This is the idiom for "keep the last K drawings."**

A Camp B ring holding **numeric values** (not drawing handles) lowers the
same way — to a persistent `state.array<number>(K)`:

```text
// Pine: a bounded var array<float> with the same FIFO-eviction signature.
var array<float> win = array.new<float>()
array.push(win, close)
if array.size(win) > 20
    array.shift(win)
plot(array.last(win))
```

converts to:

```ts
// chartlang: the eviction block is elided (the ring self-bounds), and the
// literal cap K becomes the required state.array capacity.
const win = state.array<number>(20);
win.push(bar.close);
plot(win.last());
```

**Index direction flips.** Pine `array.get(coll, n)` indexes from the
**oldest** element (index `0` is the first pushed; `array.shift` evicts it),
whereas `state.array.get(n)` indexes from the **newest** (`0` is the newest).
The converter inverts the index so a translated read targets the same element:
`array.get(win, n)` → `win.get(win.size - 1 - n)`, while `array.last(win)` →
`win.last()` and `array.first(win)` → `win.get(win.size - 1)`.

Only **numeric** (`float` / `int`) value rings have a target; a
`var array<bool>` / `var array<string>` rejects as
`array-collection-non-numeric`.

### Camp C — dynamic collections (often a reject)

A collection that fits neither shape cleanly. The converter tries to infer
a cap (from an `indicator(max_*_count=…)` arg, a literal loop bound, or a
straight-line push count) and fold it into a Camp B ring. **If it cannot
find a cap, it hard-rejects** with `unbounded-handle-collection` — chartlang
has no analogue for an unbounded handle collection.

To steer a Camp C script into a bounded camp:

- Add `max_lines_count=K` (or `max_labels_count` / `max_boxes_count`) to the
  `indicator(...)` call, **or**
- Add an explicit ring-buffer eviction with `array.size` + `array.shift`,
  **and**
- Declare the collection at the **top level** — a collection declared only
  inside an `if`/`for` block does not resolve and falls to a reject.

## Common hard-reject patterns and their rewrites

| Pine pattern | Why it rejects | Rewrite |
|---|---|---|
| `for l in line.all` | No bulk-handle iteration in v1. | Track handles in a `var array<line>` (Camp B). |
| `line.copy(h)` | Handles are not first-class values. | Re-create the drawing at the new spot. |
| A handle stored in a `type` field | No UDTs in v1. | Hoist it into a top-level `var line/label/box`. |
| `polyline.new([p1, p2, ...])` | The `[...]` array literal **does not parse**. | Build the anchors with `array.new<chart.point>()` + a literal `for i = 0 to K` push loop. |
| `array.get(coll, -1)` | Negative ring index. | Use `array.last(coll)`. |
| `linefill.new(array.get(a,i), array.get(b,i))` | Cross-collection fill. | Use a single `draw.path(...)` over the anchor pair. |
| `while` / `for ... in` | Unbounded loops. | Use a literal `for i = a to b`. |
| `strategy(...)` | No backtester. | Convert as `indicator(...)`; emit orders as `alert(...)`. |

## `request.security` — timeframe AND symbol

Pine's positional `request.security(symbol, timeframe, expr)` maps to
chartlang's options-object `request.security({ symbol?, interval }, (bar) =>
expr)`. The **first** Pine arg (the symbol) decides whether the chartlang opts
carry a `symbol`:

| Pine | chartlang | Notes |
|---|---|---|
| `request.security(syminfo.tickerid, "1D", close)` | `request.security({ interval: "1D" }).close` | Chart's own symbol ⇒ `symbol` **omitted** (byte-identical to the higher-timeframe-only case). |
| `request.security("NASDAQ:AAPL", "1D", close)` | `request.security({ symbol: "NASDAQ:AAPL", interval: "1D" }).close` | A **literal** different symbol ⇒ `{ symbol, interval }` (multi-symbol). |
| `request.security(someComputedTicker, "1D", close)` | _reject_ `request-security-not-mapped` | The symbol must be a compile-time literal (string literal / `input.symbol` / `input.enum`); a computed ticker can't lower. |

The expression form carries the symbol the same way:
`request.security("NASDAQ:AAPL", "1D", ta.ema(close, 20))` →
`request.security({ symbol: "NASDAQ:AAPL", interval: "1D" }, (bar) =>
ta.ema(bar.close, 20))`.

A non-chart symbol additionally requires the adapter's **`multiSymbol`**
capability (a strictly larger ask than `multiTimeframe`); against an adapter
that declares `multiSymbol: false`, a different-symbol read degrades to an
all-NaN series with one `multi-symbol-not-supported` diagnostic. The data form's
`SecurityBar.close` is a `Series<Price>` (indexable, NOT number-coercible), so
read `.current` for the live scalar before arithmetic
(`spy.close.current / qqq.close.current`).

## Gotchas

- **`varip` is approximated.** A `varip` handle reuses the same slot and
  raises a `varip-approximated` info — chartlang does not reproduce Pine's
  intra-bar tick-rollback. Confirm your script does not rely on it.
- **`var x := …; x[1]` becomes a `state.series`.** A numeric `var`/`varip`
  scalar that is read with a literal `[n]` history index lowers to a writable,
  indexable `state.series` slot (not a scalar `state.float`/`int`), so the
  `x[n]` history converts directly: `var float prev = na; … prev := close;
  plot(prev[1])` → `const prev = state.series(Number.NaN); … prev.value =
  bar.close; plot(prev[1])`. A numeric `var` never read with `[n]` keeps its
  leaner scalar `state.*` lowering. A `bool`/`string` history-indexed `var` is
  out of v1 series scope (`series-history-non-numeric`); a `varip` series
  approximates to a non-tick `state.series` (`varip-series-approximated`); a
  non-literal series-slot offset rejects (`dynamic-series-index`).
- **A bounded numeric `var array<float>`/`<int>` becomes a `state.array`.** A
  Camp B numeric value ring (an `array.push` plus an `array.size > K` →
  `array.shift` eviction) lowers to a persistent `const a =
  state.array<number>(K)`; the eviction block is elided (the ring self-bounds)
  and an info notes it. `a.push(v)` / `a.get(n)` (0 = newest) / `a.last()` /
  `a.size` map the Pine `array.*` reads. This is distinct from the scalar `var x
  := …; x[1]` → `state.series` case above: `state.series` is one value's bar
  history, `state.array` is a bounded bag of pushed values. `array<bool>` /
  `array<string>` value rings reject as `array-collection-non-numeric`.
- **`bar_index` anchors lower to `bar.point`.** A drawing anchored by
  `bar_index` (current, `bar_index[N]` historical, or `bar_index + N`
  future) now lowers to `bar.point(<signed offset>, price)` — the integer
  offset is read straight from the Pine expression (`bar_index` → `0`,
  `bar_index[3]` → `-3`, `bar_index + 10` → `+10`). The old
  `__BAR_INTERVAL_MS` sentinel and the `--bar-interval` flag are gone:
  `bar.point` resolves historical times from retained bars and extrapolates
  future times from recent bar spacing, so no ms-per-bar interval is needed.
  A literal negative offset sizes the lookback buffer like `series[n]`.
- **`yloc.abovebar` / `yloc.belowbar` are padded approximations.** They
  lower to the bar high/low plus a fixed fraction of the bar range
  (`yloc-padding-approximated`). Tune `__YLOC_PAD_FRAC` in the generated
  script if the offset is too tight.
- **`linefill.new(lineA, lineB)` becomes a filled quad.** It maps to
  `draw.rotatedRectangle` over the two lines' endpoints — chartlang has no
  fill-between-series primitive, so it is best-effort
  (`linefill-rotatedrect-approximated`).
- **Some `ta.*` names differ.** Pine `ta.rma` → chartlang `ta.smma`, etc.
  These emit a `ta-signature-divergence` warning — check the arguments. An
  unmapped `ta.*` / `math.*` / `str.*` is passed through verbatim with a
  "not mapped" warning so you can finish the port by hand.
- **`ta.pivothigh` / `ta.pivotlow` project a combined result.** Both Pine
  calls lower onto `ta.pivotsHighLow(...)` and read the matching field of
  its result (`ta.pivothigh` → the high field, `ta.pivotlow` → the low
  field) — chartlang computes both pivots in one primitive.
- **Multi-output `ta.*` destructures the tuple.** `ta.bb`, `ta.macd`,
  `ta.supertrend`, and `ta.kc` return multiple series, so the converter
  emits a destructuring binding (e.g. `const [macd, signal, hist] =
  ta.macd(...)`) rather than separate calls. Confirm the field order
  matches what your downstream code expects.
- **The `plot` family maps location / style / char enums.** `plotshape`,
  `plotchar`, and `plotarrow` translate, mapping Pine's `location.*`,
  `shape.*` / `size.*`, and the literal `char` argument onto the chartlang
  equivalents. An unrecognised enum member falls back to a warning so you
  can pick the closest fit by hand.
- **Inputs must be literal.** Defaults and option values must be
  compile-time literals (a unary `+`/`-` on a number is fine). A computed
  default rejects. **The converter** does not translate Pine `input.enum`
  (Pine v6 enums are UDT-backed) — use `input.string` as the migration
  target. chartlang itself supports `input.enum`; this limit is
  converter-only.
- **`explicit_plot_zorder` needs no translation.** chartlang already orders
  marks by declaration within a group by default, so Pine's
  `explicit_plot_zorder=true` is chartlang's default — the converter
  recognizes the flag as a no-op (no warning). For explicit per-mark control,
  use the chartlang `z` option on `plot()` / `draw.*` (default `0`, higher on
  top, a negative drawing `z` to sit beneath plots).

## See also

- [Converter overview](https://chartlang.dev/converter/) — intro + quick start.
- [Usage](https://chartlang.dev/converter/usage) — CLI flags + programmatic API.
- [Supported surface](https://chartlang.dev/converter/supported) — the full mapping tables.
- [Rejects + manual rewrites](https://chartlang.dev/converter/rejects) — the hard-reject catalogue.
- [Diagnostics reference](https://chartlang.dev/converter/diagnostics) — every code, anchored by slug.
- [`references/forbidden.md`](./forbidden.md) — the chartlang constructs the compiler rejects (the porting target's hard rules).
