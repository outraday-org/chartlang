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

**`array.*` reductions map onto the handle methods.** A Pine reduction takes
the array id as its first arg, so it is a direct shape match for the chartlang
method (or the equivalent `array.*` free-function alias — `win.avg()` and
`array.avg(win)` are **identical**, the alias just delegates):

| Pine | chartlang |
|------|-----------|
| `array.sum(id)` | `win.sum()` *(or `array.sum(win)`)* |
| `array.avg(id)` | `win.avg()` |
| `array.min(id)` / `array.max(id)` / `array.range(id)` | `win.min()` / `win.max()` / `win.range()` |
| `array.variance(id[, biased])` / `array.stdev(id[, biased])` | `win.variance([biased])` / `win.stdev([biased])` — population by default, sample when `biased` is `false` |
| `array.median(id)` | `win.median()` |
| `array.percentile_linear_interpolation(id, p)` | `win.percentile(p)` |
| `array.percentile_nearest_rank(id, p)` | **unsupported** → `array-reduction-not-mapped` + a `Number.NaN /* TODO */` (nearest-rank deferred) |
| `array.indexof(id, v)` / `array.includes(id, v)` | `win.indexOf(v)` / `win.includes(v)` |
| `array.sort(id, order.descending)` | `win.sort("desc")` — but chartlang `sort` returns a **fresh copy** (Pine sorts in place), so an `array-sort-returns-copy` info fires; read from the returned copy, not the original |

The reductions **skip NaN** and return `NaN` (never `0`) on an empty / all-NaN
window. An unmapped `array.*` member over a slot never hard-fails — it emits a
`Number.NaN` placeholder + an `array-reduction-not-mapped` diagnostic.

### `map.*` — the keyed collection (`state.map`)

A Pine `var map<K, V>` keyed dictionary lowers to a persistent
`state.map<number, number>(capacity)` slot; each `map.*(id, …)` call takes the
map id as its first arg, so it is a direct shape match for the chartlang handle
method:

```pine
// Pine: a per-price-level volume accumulator.
var map<float, float> levels = map.new<float, float>()
key = math.round(close)
map.put(levels, key, (na(map.get(levels, key)) ? 0 : map.get(levels, key)) + volume)
plot(map.get(levels, key))
```

```ts
// A synthesized literal capacity; key→value store persists across bars.
const levels = state.map<number, number>(1000);
const key = Math.round(bar.close.current);
levels.set(key, (levels.get(key) ?? 0) + bar.volume.current);
plot(levels.get(key) ?? 0);
```

| Pine | chartlang |
|------|-----------|
| `map.new<K, V>()` | `state.map<number, number>(1000)` — a **synthesized** literal capacity (Pine maps are unbounded; chartlang needs a compile-time literal), with a `map-capacity-synthesized` info. **Set a real bound.** |
| `map.put(id, k, v)` | `levels.set(k, v)` |
| `map.get(id, k)` | `(levels.get(k) ?? Number.NaN)` — chartlang `get` returns `undefined` (not `na`); the converter na-bridges the read |
| `map.contains(id, k)` | `levels.has(k)` |
| `map.remove(id, k)` | `levels.delete(k)` |
| `map.size(id)` | `levels.size` *(a property, not a call)* |
| `map.clear(id)` | `levels.clear()` |
| `map.keys(id)` / `map.values(id)` | **unsupported** → `map-builtin-not-mapped` + a `Number.NaN /* TODO */` (no v1 iterators — walk with `keyAt(i)` + `size`) |

**`undefined` vs `0`.** chartlang's `get` returns `undefined` for a never-seen
key (distinct from a stored `0`), so authors seed accumulators with `?? 0`
(`(levels.get(k) ?? 0) + …`). The converter wraps Pine reads with
`?? Number.NaN` to match Pine's `na`; switch to `?? 0` where you accumulate.

**Capacity bound.** A `state.map` is bounded so it serializes; a **new** key
once `size === capacity` evicts the **oldest-inserted** one (insertion-order
FIFO). The synthesized `1000` is a placeholder — size it to the distinct-key
count. Only **numeric** value maps lower; a `map<K, string|bool>` rejects as
`map-collection-non-numeric`.

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
| `request.security(syminfo.tickerid, "1D", close)` | `request.security({ interval: "1D" }).close.current` | Chart's own symbol ⇒ `symbol` **omitted** (byte-identical to the higher-timeframe-only case). |
| `request.security("NASDAQ:AAPL", "1D", close)` | `request.security({ symbol: "NASDAQ:AAPL", interval: "1D" }).close.current` | A **literal** different symbol ⇒ `{ symbol, interval }` (multi-symbol). |
| `sym = input.symbol("NASDAQ:QQQ")`<br>`tf = input.timeframe("D")`<br>`request.security(sym, tf, close)` | `request.security({ symbol: inputs.sym as string, interval: inputs.tf as string }).close.current` | A symbol/timeframe bound to an **`input.symbol`/`input.timeframe`** lowers to an `inputs.<name>` reference (so the value stays user-editable); the compiler resolves the feed through the input default. `input.timeframe` → `input.interval`. |
| `tf = input.timeframe("")`<br>`request.security(syminfo.tickerid, tf, close)` | `request.security({ interval: inputs.tf as string }).close.current` | An **empty** `input.timeframe("")` default is the **chart timeframe** (`input.interval("")`) — the primary stream, not a rejected default. |
| `request.security(syminfo.tickerid, "D", close, gaps=barmerge.gaps_off)` | `request.security({ interval: "1d" }).close.current` + info | The `gaps=` arg is **dropped** with `request-security-gaps-dropped` (info) — chartlang feeds are gap-filled by default. |
| `request.security(someComputedTicker, "1D", close)` | _reject_ `request-security-not-mapped` | The symbol/timeframe must be a compile-time literal **or** an `input.symbol`/`input.timeframe`/`input.enum` value; a computed ticker (or an input of the wrong kind) can't lower. |
| `[hi, lo] = request.security(syminfo.tickerid, "D", [high, low])` | `const hi = request.security({ interval: "1d" }).high.current`<br>`const lo = request.security({ interval: "1d" }).low.current` | **Tuple** form ⇒ one independent read per element, all sharing one feed; each name binds its own `const`. OHLCV → data form, `ta.*`/computed → callback form. A `_` element is dropped. |

The expression form carries the symbol the same way:
`request.security("NASDAQ:AAPL", "1D", ta.ema(close, 20))` →
`request.security({ symbol: "NASDAQ:AAPL", interval: "1D" }, (bar) =>
ta.ema(bar.close, 20)).current`.

A non-chart symbol additionally requires the adapter's **`multiSymbol`**
capability (a strictly larger ask than `multiTimeframe`); against an adapter
that declares `multiSymbol: false`, a different-symbol read degrades to an
all-NaN series with one `multi-symbol-not-supported` diagnostic. `SecurityBar`'s
OHLCV fields are `Series<Price>` (indexable, NOT number-coercible), so every
security read is lowered with a trailing **`.current`** for the live per-bar
scalar — that is why the table's outputs end in `.close.current` and the
expression form ends in `).current`. Inside an expression callback, an OHLCV
read used in arithmetic is projected the same way (`(bar) => atr / bar.close.current`),
and a stateful helper in the source (`request.security(sym, tf, cf_atr(len))`)
is inlined into a block-bodied callback (`(bar) => { … return …; }`).

An expression callback runs on a **separate higher-timeframe clock**, so it may
not capture a main-timeline binding. The converter handles this automatically:
when the callback reads a top-level binding whose value is **bar-invariant**
(it bottoms out at `inputs`/`Math`/literals — e.g. a length derived from an
`input.int` and a `switch`-over-input preset), the converter **reconstructs**
that binding (and its whole dependency chain) as a callback-local `let`/`switch`
prelude, so the read resolves in-scope. You do not need to inline the length by
hand. Only a **bar-varying** capture (one that depends on series / `ta.*` /
OHLCV) cannot be rebuilt — that emits `request-security-expr-captures-series`
(error); rewrite it so the higher-timeframe value is computed inside the callback
from `inputs`/OHLCV, or read it on the main timeframe.

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

## Color & transparency — Pine `transp` → chartlang alpha

Pine separates a color from its transparency (`color.new(base, transp)`, or the
4-arg `color.rgb(r, g, b, transp)`), where `transp` is `0` (opaque) … `100`
(fully transparent). chartlang has no separate transparency channel — opacity
lives in the color's **alpha**. The converter folds the two together with
`alpha = (100 − transp)`:

| Pine | chartlang | Note |
|------|-----------|------|
| `color.rgb(255, 153, 0, 60)` | `"#FF990066"` | Literal base + literal `transp` → a `#RRGGBBAA` hex string. No `color` import. |
| `color.new(color.white, 50)` | `"#FFFFFF80"` | Named/`#RRGGBB` base + literal `transp` → hex string. |
| `color.new(dynCol, 50)` | `color.withAlpha(dynCol, 0.5)` | A **dynamic** base (or dynamic `transp`) → `color.withAlpha(base, (100 − transp) / 100)` (alpha in 0–1). Imports `color`. |
| `color.rgb(r, g, b)` | `color.rgb(r, g, b)` | 3-arg form passes through. Imports `color`. |

- **When you write chartlang by hand**, reach for `color.withAlpha(base, a)`
  (alpha `0`–`1`, **not** Pine's `0`–`100`) for a dynamic tint, or just write a
  `#RRGGBBAA` string for a fixed one. `color` is a module-scope import, **not**
  a `compute({ … })` field — it only appears in the import line when a
  `color.*` member survives (an all-hex script imports none).

## Alerts — `alert(message, freq)` → `alert(message)`

Pine fires an alert imperatively from inside an `if` with a string payload and
an `alert.freq_*` firing-frequency enum. chartlang's `alert` is already
message-first and imperative, so the conversion is small — the message passes
through (string concat preserved), the enclosing `if` is **preserved** (never
hoisted), and the frequency is **dropped**:

| Pine | chartlang | Note |
|------|-----------|------|
| `alert(message)` | `alert(message)` | Bare message, no diagnostic. |
| `alert(message, alert.freq_all)` | `alert(message)` | The `alert.freq_*` arg is dropped with an `alert-frequency-not-mapped` info. |

```pine
if go_long
    alert('{"symbol": "' + syminfo.ticker + '", "action": "buy"}', alert.freq_all)
// → if (go_long) { alert(('{"symbol": "' + syminfo.ticker) + '", "action": "buy"}'); }
```

All three frequency enums (`alert.freq_all`, `alert.freq_once_per_bar`,
`alert.freq_once_per_bar_close`) are recognised and dropped — chartlang's
`AlertOpts` (`{ severity?, meta? }`) has no firing-frequency contract. The
trigger still fires once per closed bar inside its `if`; for explicit
deduplication, gate the `alert(...)` behind your own `state.*` flag.

- **When you write chartlang by hand**, `alert(message, { severity, meta })` is
  a `compute({ … })` field; there is no frequency option (every alert is
  effectively once-per-closed-bar inside its guard). `alertcondition(...)` is a
  deferred follow-up.

## User-defined functions — `f(a, b) => …`

Pine helper functions convert, and how they lower depends on whether the
helper is **stateful** (its body, transitively, calls `ta.*` / `state.*` /
`plot` / `hline` / `alert` / `draw.*`):

- A **pure** helper (no stateful calls) becomes a reusable arrow function at the
  top of `compute`: `cf_limit(v, hi, lo) => math.max(math.min(v, hi), lo)` →
  `const cf_limit = (v, hi, lo) => Math.max(Math.min(v, hi), lo);`, and every
  call site reuses it.
- A **stateful** helper is **inlined at each call site**, because chartlang keys
  each `ta.*` / `state` slot by source position — a shared function would make
  all callers collide on one slot. Two calls to the same helper therefore expand
  to two independent `ta.*` sites and hold independent state, matching Pine's
  per-call instancing:

  ```text
  cf_slope(ma, n) => ta.ema(((ma - ma[1]) / ma[1] * 100), n)
  close_slope = cf_slope(close, 3)   // → ta.ema(((bar.close - bar.close[1]) / bar.close[1] * 100), 3).current
  open_slope  = cf_slope(open, 5)    // → an independent ta.ema slot
  ```

- The body's **last expression is the return** (Pine has no `return`); a
  multi-line body's intermediate `x = expr` lines become local `let`s.

Three things to keep in mind:

- **Recursion does not convert** (`udf-recursive-rejected`) — rewrite it as a
  literal-bounded `for` loop accumulating into a `var`.
- **Param defaults reject the whole helper** (`udf-param-default-unsupported`);
  a typed param (`float x`) just drops the type (`udf-typed-param-unsupported`).
- **A helper that indexes a param's history mostly converts now.** A pure
  helper's params are auto-annotated `: number`, and a *stateful* helper that
  indexes a **param's history** (`cf_slope(ma, n) => ta.ema((ma - ma[1]) / ma[1]
  * 100, n)`) auto-promotes the matching argument to a `state.series` slot — so
  `cf_slope(ma_1, 3)` over a derived `ma_1 = ta.ema(close, 8)` converts cleanly
  (it used to need a hand-written slot). The one residual v1 limitation: a
  **pure** helper (no `ta.*`) that indexes its own param's history
  (`f(src) => src - src[1]`) — the param is a `: number`, so `src[1]` is a
  `TS7053`; promote `src` by hand or pass it through a `ta.*` window primitive.
- **A value-form `switch` converts** (Pine's `cf_ma`): `result = switch sel`
  with `"SMA" => ta.sma(src, len)` arms lowers to a chained ternary
  (`sel === "SMA" ? ta.sma(src, len).current : … : Number.NaN`) — the first
  matching arm wins, a wildcard `=> v` arm is the default, and an unmatched
  subject yields `na`. The subject-less boolean form (`switch\n cond => v`)
  lowers each condition directly. Only a single-expression arm body converts; a
  multi-statement / `:=`-assignment arm rejects (`switch-expression-unsupported`)
  — rewrite it as a statement-form `switch` that assigns into a `var`.

## Inputs — dropdowns → `input.enum`, bare `input()`

Pine's `input.*` builders map to chartlang's, but two shapes lower into forms
that aren't a 1:1 name match — option dropdowns become `input.enum`, and the
legacy generic `input()` becomes a source or typed builder.

| Pine | chartlang | Note |
|------|-----------|------|
| `input.string("EMA", options=["EMA", "SMA"])` | `input.enum("EMA", ["EMA", "SMA"])` | A string-literal `options=` dropdown. Comparisons against the value (`sel == "EMA"`) keep working — the enum value is the string. |
| `input.int(21, options=[8, 21, 30, 50])` | `input.enum(21, [8, 21, 30, 50])` | A numeric-literal `options=` dropdown → a **numeric** `input.enum` (`input.enum` accepts `string \| number`). Same for `input.float`. |
| `input(close, "Source")` | `input.source("close", { title: "Source" })` | Bare `input()` with a **series** default (an OHLCV / synthetic source). Hoisted to `manifest.inputs`, referenced as `inputs.<name>`. |
| `input(14, "Length")` | `input.int(14, { title: "Length" })` | Bare `input()` with a **literal** default → the typed builder by the literal's kind (`input(14)` → `input.int`, `input(1.5)` → `input.float`, `input(true)` → `input.bool`, …). |

Pine input metadata maps to chartlang input opts on every builder:
`group`, `inline`, `tooltip`, `confirm`, and `display`. Input `display`
uses `"all"`, `"status-line"`, `"data-window"`, or `"none"` and controls
where the input value appears outside the settings panel. This is separate
from `plot(..., display=...)`, which maps only the all/none show-hide toggle
to `plot(..., { visible })`. Metadata values must be literals; non-literal
metadata and Pine's conditional `active=` argument are dropped with
`input-arg-not-mapped`.

- **Default must be one of the options.** If the dropdown `default` isn't in
  `options=`, the enum is still emitted with an
  `input-string-options-default-mismatch` warning — fix the source to pick a
  listed value.
- **Non-uniform option lists can't become an enum.** A mixed or non-literal
  `options=` list falls back to a plain `input.string`/`input.int` with the
  options dropped (`input-string-options-not-literal`) — list the choices as
  plain literals to recover the dropdown.
- **Bare `input()` rejects a non-literal, `na`, or missing default**
  (`non-literal-input-default`).

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
  leaner scalar `state.*` lowering. A `varip` series approximates to a non-tick
  `state.series` (`varip-series-approximated`); a non-literal series-slot offset
  rejects (`dynamic-series-index`).
- **A history-indexed `var bool` / `var string` becomes a `state.boolSeries` /
  `state.stringSeries`.** The non-numeric analogues of `state.series` lower the
  same way — `var bool active = false; … active := close > open; x = active[1]`
  → `const active = state.boolSeries(false); … active.value = bar.close >
  bar.open; let x = active[1]`. First-bar / out-of-range history defaults are
  deterministic (`false` for bool — Pine v6 bool history, `""` for string), so
  no warmup guard is emitted. (This **retires** the old
  `series-history-non-numeric` deferral for bool/string.) A history-indexed
  `var color` is still out of v1 scope and keeps `series-history-non-numeric`.
- **A `var color` becomes a `state.color`.** A persistent color *scalar*
  (`var color exitClr = na; exitClr := close > open ? color.green : color.red`)
  lowers to `const exitClr = state.color("#00000000"); exitClr.value = (bar.close
  > bar.open) ? color.green : color.red`, read back as `exitClr.value`. Pine `na`
  color seeds the transparent `"#00000000"`, so no `scalar-state-type-defaulted`
  info fires (color is now a first-class slot, not a defaulted `state.float`).
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
- **A `ta.*` may appear anywhere in an expression — no manual `.current`.**
  A `ta.*` in a scalar slot (an operator operand, a ternary arm, a `math.*`
  argument) is projected to its per-bar scalar for you (`ta.rsi(close, 14) *
  scale` → `ta.rsi(bar.close, 14).current * (inputs.scale as number)`), marked
  by a `nested-ta-lowered` info. A `ta.*` fed as a *source* to another `ta.*`
  stays a series (`ta.sma(ta.atr(14), 5)` keeps the inner `ta.atr` bare). When
  you write chartlang by hand, follow the same rule: read `.current` only where
  a number is required.
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
- **`plot(..., display=)` maps to `{ visible }`.** `display = <cond> ?
  display.all : display.none` lowers to `plot(value, { visible: <cond> })`
  (the inverted `... ? display.none : display.all` becomes
  `{ visible: !(<cond>) }`); a bare `display.none` becomes
  `{ visible: false }`. A constant `display.all` (and an omitted `display=`)
  emits **no** `visible` key, so a fully-shown plot stays byte-clean. Any
  other `display.*` target (`display.status_line`, `display.price_scale`,
  `display.pane`, `display.data_window`) has no chartlang analogue beyond
  show/hide, so the `display=` is dropped, the plot is left visible, and a
  `plot-display-approximated` warning is emitted.
- **Inputs must be literal.** Defaults and option values must be
  compile-time literals (a unary `+`/`-` on a number is fine). A computed
  default rejects. A native Pine `input.enum(EnumType.member, title?, ...)`
  lowers to a string-backed chartlang `input.enum`, with options taken from the
  enum declaration in order; comparisons against `EnumType.member` lower to
  the same string values. `input.string` / `input.int` / `input.float`
  `options=` dropdowns still use the converter-synthesised `input.enum` bridge
  (see [Inputs — dropdowns & bare `input()`](#inputs--dropdowns--inputenum-bare-input)).
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
