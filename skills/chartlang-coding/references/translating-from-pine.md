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

## `math.*` — bare `Math` plus the chart-aware extras

chartlang allows plain JavaScript `Math.*` directly in `compute` (only
`Math.random` is forbidden), so the converter leaves the numeric `math.*`
functions on bare `Math` and adds only the chart-aware extras to the `math`
namespace:

| Pine | chartlang | Note |
|------|-----------|------|
| `math.abs/pow/sqrt/floor/ceil/round/min/max/log/exp/sign(...)` | `Math.abs/...` | Bare `Math` — **not** re-wrapped. `math.sign` stays on `Math.sign`. |
| `math.round_to_mintick(x)` | `math.roundToMintick(x, syminfo.mintick)` | The tick step is injected (the namespace is pure, no ambient `syminfo`). |
| `na(x)` | `(x === null)` / `!Number.isFinite(x)` | Lowered to an inline predicate by context. The scalar `math.na(x)` is also available when you write chartlang by hand. |
| `nz(x)` / `nz(x, r)` | `math.nz(x)` / `math.nz(x, r)` | **Scalar** coalesce; emits an advisory `nz-scalar-assumed` info. |
| `math.avg(a, b, …)` | `math.avg(a, b, …)` | Variadic **scalar** mean (skip-NaN). |
| `math.sum(a, b, …)` | `math.sum(a, b, …)` | Variadic **scalar** sum (skip-NaN). |
| `math.sum(source, length)` | *(not mapped)* | Pine's 2-arg **rolling** window has no scalar analogue — `math-rolling-window-unmapped`; rewrite with `state.array<number>(length)` or a `ta.*` average. |

- **Bare `Math` is fine.** If you reach for `math.abs` in chartlang you will not
  find it — use `Math.abs`. `math.*` is the small set of extras, not a superset
  of `Math`. `math` is a module-scope import, **not** a `compute({ … })` field
  (do not destructure it); `syminfo` *is* a `compute` field.
- **Scalar `math.nz` vs series `ta.nz`.** chartlang splits the NaN-coalesce by
  shape: `math.nz(scalar, r?)` for a plain number, `ta.nz(series, r?)` for a
  series. The converter assumes the **scalar** `math.nz` and emits an advisory
  `nz-scalar-assumed`; if your `nz` argument is a series whose history you
  coalesce, change the emitted `math.nz(...)` to `ta.nz(...)` by hand.

## `str.*` — the string namespace, lowered to native JS

chartlang ships a `str` namespace for the dynamic text `draw.text` /
`draw.table` / `alert(...)` consume, but the converter lowers each Pine `str.*`
call to the **native JS** method (the same native-where-native-exists shape
`math.*` uses for bare `Math.*`):

| Pine | chartlang | Note |
|------|-----------|------|
| `str.tostring(x)` | `String(x)` | Plain stringify. |
| `str.tostring(x, "#.##")` | `(x).toFixed(2)` | The mask's fractional-digit count drives `toFixed`. A grouped / `format.mintick` mask emits `str-format-not-mapped` and passes through. |
| `str.format("{0} {1}", a, b)` | `` `${a} ${b}` `` | Positional `{n}` placeholders become a template literal. A styled `{0,number}` placeholder emits `str-format-not-mapped`. |
| `str.length(s)` | `s.length` | |
| `str.contains(s, t)` | `s.includes(t)` | |
| `str.startswith(s, t)` / `str.endswith(s, t)` | `s.startsWith(t)` / `s.endsWith(t)` | |
| `str.pos(s, t)` | `s.indexOf(t)` | Pine returns `na` when absent; JS returns `-1`. |
| `str.upper(s)` / `str.lower(s)` | `s.toUpperCase()` / `s.toLowerCase()` | |
| `str.trim(s)` | `s.trim()` | |
| `str.substring(s, b[, e])` | `s.substring(b[, e])` | Both 0-based, `e` exclusive — matches JS. |
| `str.repeat(s, n[, sep])` | `s.repeat(n)` | 2-arg, or a `""` empty-string-literal separator. A non-empty / non-literal separator emits `str-not-mapped`. |
| `str.replace_all(s, t, r)` | `s.replaceAll(t, r)` | snake_case → native `replaceAll`. |
| `str.replace(s, t, r[, occ])` | `s.replace(t, r)` | No occurrence, or a literal-`0` occurrence (replaces the first match). A non-zero / non-literal occurrence emits `str-not-mapped`. |
| `str.split(s, sep)` | `s.split(sep)` | |
| `str.tonumber(s)` | `Number(s)` | `NaN` ≈ Pine `na` (edge: `Number("")` is `0`). |
| `str.match` / `str.format_time` | *(passed through)* | `str-not-mapped` — regex / host-time, no native one-liner; rewrite by hand. |
| any other `str.*` member | *(passed through)* | `str-not-mapped`; rewrite by hand. |

- **When you write chartlang by hand**, the `str.*` namespace is available
  directly (`str.tostring(value, "#.##")`, `str.format(...)`) — same
  byte-identical formatting, just the curated surface instead of native
  methods. `str` is a module-scope import, **not** a `compute({ … })` field.

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
