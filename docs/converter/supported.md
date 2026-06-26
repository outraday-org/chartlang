# Supported surface

What the v1 (drawings-focused) converter translates, pillar by pillar.
Anything not listed here either hard-rejects (see
[rejects](./rejects.md)) or passes through unchanged with a "not mapped"
warning.

## Drawings

The six Pine drawing constructors and how they lower:

| Pine constructor | chartlang target |
|---|---|
| `line.new` | `draw.line` |
| `box.new` | `draw.rectangle` |
| `label.new` | `draw.text` (default) or `draw.marker` / `draw.frame` / `draw.arrowMarkUp` / `draw.arrowMarkDown` / `draw.rectangle` per the `style=label.style_*` enum |
| `table.new` | `draw.table({ position, cells })` (rebuilt each `barstate.islast` tick) |
| `polyline.new` | `draw.polyline`, or `draw.path` (`closed=true`), or `draw.curve` (`curved=true` with exactly 3 anchors) |
| `linefill.new` | `draw.fillBetween` — a true filled ribbon between the two referenced lines' anchors (static two-line form) |

### The three drawing camps

How a drawing handle is *managed* in Pine decides its conversion strategy.
The converter classifies each `.new()` site deterministically:

- **Camp A — single handle.** A `var`/`varip` handle created once and
  mutated each bar (`var line lvl = na` … `lvl := line.new(...)` …
  `line.set_xy1(lvl, ...)`). Lowers to a single chartlang drawing-handle
  slot whose setters fold into one `update({...})` patch per branch.
- **Camp B — ring buffer.** A `var array<line|label|box>` filled by
  `array.push(coll, line.new(...))` with FIFO eviction
  (`if array.size(coll) > K` → `array.shift`/`*.delete`). Lowers to a
  fixed-capacity chartlang ring; the explicit eviction block is removed
  (the ring rotates modulo K) and an info marks the elision.
- **Camp B — numeric ring.** The numeric analogue: a bounded
  `var array<float|int>` filled by `array.push(coll, <number>)` with the same
  FIFO eviction signature (`if array.size(coll) > K` → `array.shift(coll)` /
  `array.remove(coll, 0)`). Lowers to `const <name> = state.array<number>(K)`;
  `array.push`/`get`/`size`/`last`/`first`/`clear` map onto the slot's surface
  and the eviction block is elided (one `ring-eviction-implicit` info). The cap
  `K` comes from the eviction guard or an `array.new<float>(K)` size argument; a
  numeric array with no detectable cap hard-rejects `unbounded-array-collection`.
  A non-numeric collection (`array<string|bool|color>`) emits
  `array-collection-non-numeric` — only numeric `state.array` is supported in
  v1. A `for i = 0 to array.size(coll) - 1` summation does **not** lower
  (chartlang requires literal `for` bounds); read the window with direct
  `array.get`/`array.last`/`array.size` calls instead.
- **Camp C — heuristic-or-reject.** A dynamic collection that fits neither
  shape cleanly. The converter tries to fold it into a Camp B ring using a
  capacity heuristic (an `indicator(max_*_count=…)` cap, a literal loop
  bound, or a straight-line push count). If no cap can be inferred, it
  **hard-rejects** with `unbounded-handle-collection` — chartlang has no
  faithful analogue for an unbounded handle collection.

To steer a borderline script into a bounded camp, cap the collection: add
`max_lines_count=…` (etc.) to the `indicator(...)` call, or add an explicit
`array.shift` ring-buffer eviction. See
[translating from Pine](https://github.com/outraday-org/chartlang/blob/main/skills/chartlang-coding/references/translating-from-pine.md).

### Anchors and `bar_index`

Drawing coordinates resolve from Pine's `(x, y)` pairs. Each `bar_index`
anchor lowers to a `bar.point(<signed offset>, <price>)` call — the
chartlang authoring sugar that resolves an integer bar offset to a
`WorldPoint { time, price }` at compute time (see
[Series and indexing § Anchoring drawings by bar offset](../language/series-and-indexing.md#anchoring-drawings-by-bar-offset-bar-point)).
The drawing anchor frame stays `WorldPoint` only; `bar.point` adds no new
anchor shape.

- Bare `bar_index` → the current bar, `bar.point(0, price)`.
- `bar_index[N]` or `bar_index - N` (literal `N`) → `N` bars ago,
  `bar.point(-(N), price)`. Historical anchors use `barIndexOrigin` when set.
- `bar_index + N` (literal `N`) → `N` bars in the **future**,
  `bar.point((N), price)`. The future time is resolved **at runtime** by
  extrapolating from the median of recent bar spacings (falling back to the
  parsed bar interval), so the converter no longer synthesises any
  `bar.time + N * __BAR_INTERVAL_MS` arithmetic — the old host-supplied
  `__BAR_INTERVAL_MS` sentinel is gone. A future anchor still carries
  `requiresBarInterval` as a manifest-intent signal, and when `barInterval`
  is unset the converter emits a single advisory `requires-bar-interval`
  error.
- `bar_index ± <non-literal>` → best-effort direction + a `dynamic-bar-index`
  warning.
- `yloc.abovebar` / `yloc.belowbar` → the bar high/low padded by a fixed
  fraction of the bar range (`yloc-padding-approximated` info).

## Sources and history

Pine's OHLCV built-ins map to the chartlang compute bar's fields:
`close` → `bar.close`, `open` → `bar.open`, `high` → `bar.high`,
`low` → `bar.low`, `volume` → `bar.volume`, and the derived `hl2` / `hlc3` /
`ohlc4` / `hlcc4` likewise.

These fields are **price series**, so Pine's historical access with a literal
offset converts directly:

```
close[2]   // → bar.close[2]  (the close two bars ago)
high[1]    // → bar.high[1]
```

A literal `close[N]` is the common case (a loop over `close[i]` is unrolled to
`bar.close[0]`, `bar.close[1]`, … first). A genuinely **non-literal** series
index (`close[i]` outside an unrollable loop) is still rejected with
[`dynamic-series-index`](./diagnostics.md#dynamic-series-index) — use a literal
offset or a `ta.*` window primitive. History on a `ta.*`-derived scalar
(`macdLine[1]`, where `macdLine` is a destructured tuple field projected with
`.current`) is **not** supported.

### History on a `var` — `state.series`

Pine's pervasive `var x := …; x[1]` idiom — reading the history of a value you
**store yourself** — is the one history case that is not a bar field or a
`ta.*` output. A numeric `var`/`varip` that is read with a literal `[n]`
anywhere in the script lowers to a chartlang
[`state.series`](../language/series-and-indexing.md#user-created-series-state-series)
slot — a writable, indexable user series — and its `[n]` history converts
**directly**:

```pine
var float prev = na
delta = close - prev
prev := close
plot(prev[1])
```

becomes

```ts
const prev = state.series(Number.NaN);
let delta = bar.close - prev.value;
prev.value = bar.close;
plot(prev[1]);
```

The literal init picks the seed (`na` → `Number.NaN`); the write stays
`prev.value = …` and the read `prev.value`, while `prev[1]` is the committed
history. A numeric `var` **never** read with `[n]` keeps its leaner scalar
[`state.*`](#state) lowering.

A plain (`=`-declared) **`ta.*` series that is history-indexed** anywhere —
`ma = ta.ema(close, len)` read as `ma[i]` — is promoted to the **same**
`state.series` slot: `const ma = state.series(Number.NaN)`, written each bar as
`ma.value = ta.ema(bar.close, len).current`, so `ma[i]` is a real indexed read
while `ma`'s scalar uses (`ma >= 0`, `plot(ma)`) still read `ma.value`. A
`ta.*` series **never** indexed keeps its `.current` scalar lowering (no
change). A `bool`/`string` history-indexed `var` is out of
the v1 series scope and is flagged
[`series-history-non-numeric`](./diagnostics.md#series-history-non-numeric); a
`varip` series approximates to a (non-tick) `state.series` with
[`varip-series-approximated`](./diagnostics.md#varip-series-approximated). A
non-literal series-slot offset rejects with
[`dynamic-series-index`](./diagnostics.md#dynamic-series-index).

## Inputs

| Pine input | chartlang input |
|---|---|
| `input.int` | `input.int`, or `input.enum` when a numeric-literal `options=[…]` dropdown is given |
| `input.float` | `input.float`, or `input.enum` when a numeric-literal `options=[…]` dropdown is given |
| `input.bool` | `input.bool` |
| `input.string` | `input.string`, or `input.enum` when a string-literal `options=[…]` dropdown is given |
| `input.color` | `input.color` |
| `input.source` | `input.source` (OHLCV built-in default only) |
| `input.symbol` | `input.symbol` |
| `input.time` | `input.time` |
| `input.price` | `input.price` |
| `input.session` | `input.session` (an `"HH:MM-HH:MM"` spec, fed to `session.isOpen`) |
| `input.timeframe` | `input.interval` |
| bare `input(...)` | `input.source` (series default) or the typed `input.int/float/bool/string/color` (literal default) |
| `input.enum` | **rejected** (`input-enum-rejected`) — Pine v6 enums are UDT-backed |

Input defaults and option literals must be **compile-time literals** (a
unary `+`/`-` on a numeric literal is allowed, e.g. `input.int(-1)`). A
computed default rejects with `non-literal-input-default`. Unmapped named
args (`tooltip`/`group`/`inline`/`confirm`) are dropped with an
`input-arg-not-mapped` warning, but the input still emits. An inline input
(`ta.ema(close, input.int(20))`) is promoted to a named top-level input
(`inline-input-promoted`).

### String dropdowns → `input.enum`

`input.string(default, title?, options=["A", "B"])` (a string-literal
dropdown) converts to `input.enum(default, ["A", "B"], { title? })` — the title
threads from the positional 2nd arg or a `title=` named arg, and string
comparisons against the value (`sel == "EMA"`) keep working (the enum value
is the string). If the `default` is not one of the `options`, the enum is still
emitted with a `input-string-options-default-mismatch` warning. A mixed or
non-literal `options=` list cannot become an enum: it falls back to a plain
`input.string` with `input-string-options-not-literal`. (Pine's UDT-backed
`input.enum` stays rejected; see [rejects](./rejects.md).)

### Numeric dropdowns → `input.enum<number>`

`input.int/float(default, options=[8, 21, 30, …])` (a numeric-literal dropdown)
converts to a numeric `input.enum(default, [8, 21, 30, …], { title? })`. Numeric
use sites keep working: comparisons (`len == 8`) and length args
(`ta.sma(close, len)`) read the value as a `number`. The same
`input-string-options-default-mismatch` / `input-string-options-not-literal`
rules apply; an all-string or empty `options=` list on a numeric input defers to
the plain `input.int/float`.

### Bare `input()` → `input.source` / typed

The legacy generic `input(...)` form (callee `input`, not `input.<member>`)
hoists to `manifest.inputs` and is referenced as `inputs.<name>` — never an
inline `input(...)` call. A **series** default (`input(title="LT", defval=close)`
— an OHLCV / synthetic source) becomes `input.source("close", { title? })`; a
**literal** default becomes the typed `input.int/float/bool/string/color` by the
literal's kind (`input(14)` → `input.int(14)`). A missing default, `na`, or a
computed default rejects with `non-literal-input-default`.

## Control flow

| Pine construct | Converts? |
|---|---|
| `if` / `else if` / `else` | ✅ |
| Ternary `a ? b : c` | ✅ (chained ternary → an `chained-ternary-warning` info) |
| `switch` (subjected and subjectless), incl. **comma multi-assignment arms** (`"X" => a := 8, b := 21`) | ✅ |
| `for i = a to b [by s]` with **literal-resolvable** bounds | ✅ |
| `break` / `continue` inside a `for` | ✅ (forces a runtime `for` — see below) |
| `for` with a non-literal bound and a stateful body | ❌ `loop-bounds-not-literal-for-stateful-body` |
| `for` with **both** a stateful body **and** a `break`/`continue` | ❌ `stateful-loop-with-break` |
| `for ... in` | ❌ `unsupported-for-in` — rewrite as a literal `for i = a to b` |
| `while` | ❌ `unsupported-while` — rewrite as a literal `for i = a to b` |

A `for` whose body calls a **stateful** primitive (`plot` / `hline` /
`alert` / `ta.*` / `draw.*`) is **unrolled** at convert time (the compiler
forbids a stateful call inside a loop), so its bound must resolve to a
compile-time integer. A bound from an `input.int` default unrolls but
freezes the count at the default (`loop-unroll-frozen-at-input-default`).

### `break` / `continue` — the no-unroll loop

A `break` cannot span unrolled iterations, so a `for` whose body contains a
`break` or `continue` **overrides** the unroll heuristic and is **always**
emitted as a real runtime `for (let i = a; i <= b; i++) { … }` with the jump
lowered inside it — never unrolled, never a stray top-level `break;`. The bound
still resolves from a literal or a frozen `input.int` default (the latter keeps
the `loop-unroll-frozen-at-input-default` info, since the count is fixed even
though the loop is real). Inside that loop body, a series indexed by the **loop
iterator** (`ms[i]`) is a legal runtime history read — not the
[`dynamic-series-index`](./diagnostics.md#dynamic-series-index) reject a free
`[i]` outside a loop hits — so the `MASM_Strat.md` consolidation counter

```pine
consol_count = 0
for i = 0 to consol_tolerance
    if (ma_slope[i] > consol_range_adj) or (ma_slope[i] < -consol_range_adj)
        consol_count := 0
        break
    consol_count += 1
```

converts to a compiling chartlang `for` (`ma_slope` is a `ta.*` series
history-indexed by `i`, so it promotes to a `state.series` slot — see
[History on a `var`](#history-on-a-var-state-series)). A body that is **both**
stateful **and** has a `break`/`continue` is unconvertible and rejects with
[`stateful-loop-with-break`](./diagnostics.md#stateful-loop-with-break); a
`break`/`continue` with no enclosing loop is dropped with
[`break-continue-outside-loop`](./diagnostics.md#break-continue-outside-loop).

### Compound assignment

`+=`, `-=`, `*=`, and `/=` parse and lower to a read-modify-write, both at the
top level and inside loop bodies — `consol_count += 1` becomes
`consol_count += 1` onto the local (or `<slot>.value += 1` onto a `state.*`
scalar slot). A compound assignment to a name that was never declared is an
`unknown-identifier` error (it is a reassignment, not a declaration).

## Multi-line expressions

Pine lets a single expression span several lines when a continuation line is
indented and **begins with a binary/boolean operator** — the dominant way real
scripts format long `and`/`or` condition stacks:

```pine
cond = maOk and rsiOk
    and not sw
    and close > 0
entry = maOk
    or rsiOk
    or (close > open ? maOk : rsiOk)
```

The converter's lexer joins these into one statement each, so the example above
lowers to two single-expression assignments
(`cond = ((maOk && rsiOk) && !inputs.sw) && (bar.close > 0)` and the matching
`entry = …`). Continuation is recognised for the binary-operator surface (the
arithmetic, comparison, and `and`/`or` operators) plus the ternary `?` / `:`,
on a line indented **strictly deeper** than the statement that starts the
expression. A `-`/`+` line at the **same** indent as the statement start is a
new (unary) statement, not a continuation, so leading-operator continuation
never silently swallows the next line. The eager paren-depth + trailing-comma
continuation (an expression left open inside `(` / `[` / `{` or after a `,`)
keeps working as before.

## User-defined functions

Pine user-defined functions (UDFs) — both the single-line
`f(a, b) => expr` form and the multi-line indented form (whose **last
statement is the implicit return**, Pine has no `return` keyword) — convert.
Parameters are bare identifiers; a typed param (`float x`) keeps the bare name
with a [`udf-typed-param-unsupported`](./diagnostics.md#udf-typed-param-unsupported)
warning.

How a UDF lowers depends on whether its body is **stateful** — i.e. whether it
(transitively) calls a stateful primitive (`ta.*` / `state.*` / `plot` /
`hline` / `alert` / `draw.*`):

- **Pure UDF → reusable arrow function.** A state-free helper hoists to a
  `const cf_limit = (input_val: number, upper_limit: number, lower_limit: number)
  => …` at the top of `compute` (after the state-slot allocations, ordered
  callee-before-caller), and every call site reuses it — a pure helper is
  referentially transparent, so one shared function equals Pine's per-call
  evaluation. Params are typed `: number` so the emitted arrow type-checks (an
  untyped param trips `noImplicitAny`); a `PriceSeries` argument like `bar.close`
  is assignable to `number`. A
  [`udf-emitted-function`](./diagnostics.md#udf-emitted-function) info marks each.

- **Stateful UDF → inlined per call site.** A stateful helper **cannot** be a
  shared function: chartlang keys every `ta.*` / `state` slot by the **lexical
  source position** of the call, so one shared body would make all callers share
  **one** slot and cross-contaminate state — Pine instead instances independent
  series per call site. The converter therefore **inline-expands** the body at
  each call site (params bound to their arguments, a non-trivial / call-bearing
  arg hoisted to an evaluate-once `const` temp, intermediate body locals lowered
  to uniquely-named `let`s, and the implicit-return expression spliced into the
  call's position). Each inlined `ta.*` lands at its own source position, so the
  compiler mints an **independent slot** per call — two calls to the same helper
  provably diverge. A [`udf-inlined`](./diagnostics.md#udf-inlined) info (plus
  [`udf-arg-hoisted`](./diagnostics.md#udf-arg-hoisted) when an arg is hoisted)
  marks each expansion.

```pine
cf_slope(ma, smoothing_amt) => ta.ema(((ma - ma[1]) / ma[1] * 100), smoothing_amt)
close_slope = cf_slope(close, 3)
open_slope  = cf_slope(open, 5)
```

becomes two independent inlined `ta.ema` slots:

```ts
let close_slope = ta.ema((((bar.close - bar.close[1]) / bar.close[1]) * 100), 3).current;
let open_slope = ta.ema((((bar.open - bar.open[1]) / bar.open[1]) * 100), 5).current;
```

A call whose argument count differs from the declaration warns
[`udf-arity-mismatch`](./diagnostics.md#udf-arity-mismatch). For the param forms
and **recursion** that reject, and the v1 limitation a faithful Trend Wizard
port still hits (a stateful helper that indexes a **param's history** when
applied to a derived series), see
[rejects](./rejects.md#user-defined-functions).

## State

A `var` / `varip` scalar becomes a chartlang `state.*` slot. The literal
initializer picks the factory (`int`→`state.int`, `float`→`state.float`,
`bool`→`state.bool`, `string`→`state.string`); a `varip` uses the
`state.tick.*` form. An un-inferable type (e.g. a `#RRGGBB` color literal or
an identifier initializer) defaults to `state.float` with a
`scalar-state-type-defaulted` info — the converter never silently guesses.

The one exception is a **numeric `var`/`varip` read with a literal `[n]`**: it
lowers to a writable, indexable `state.series` instead of a scalar slot so the
`x[n]` history converts directly — see
[History on a `var`](#history-on-a-var-state-series) above.

## Plots

`plot` maps its `title`, `color`, and `linewidth` (named or positional) onto
a chartlang `plot(value, { title, color, lineWidth })` options object.
`plotshape` / `plotchar` / `plotarrow` gate the value behind their condition
and select a `style.kind`; `plotcandle` / `plotbar` map to candle/bar
overrides; `bgcolor` / `barcolor` emit a background `plot`. `hline(price, …)`
maps to chartlang `hline`.

Pine's bidirectional `plot(series, offset=N)` maps **when the plotted value
is a direct `ta.*` call** — the signed offset threads onto that call's opts,
where chartlang's offset lives:

```pine
plot(ta.sma(close, 20), offset=5)    // → plot(ta.sma(bar.close, 20, { offset: 5 }))
plot(ta.sma(close, 20), offset=-5)   // → plot(ta.sma(bar.close, 20, { offset: -5 }))
```

A positive offset shifts the series right (into the future), a negative one
left (into the past); a non-literal offset (`offset=shift`) threads verbatim,
and `offset=0` is byte-identical to the no-offset path. If the `ta.*` call
already carries its own `offset` argument, the plot-level offset wins and a
[`plot-offset-overrides-ta-offset`](./diagnostics.md#plot-offset-overrides-ta-offset)
warning is emitted. A plot whose value is **not** a direct `ta.*` call has no
representable offset target — see [rejects](./rejects.md#tables--passthrough).

## Color & transparency

Pine's transparency-carrying color forms — `color.new(base, transp)` and the
4-argument `color.rgb(r, g, b, transp)` — convert in **every** styling
position (a `plot` / `hline` color, a `bgcolor` / `barcolor`, and a `table`
cell's `bgcolor` / `text_color`). Pine's `transp` runs 0 (opaque) … 100
(transparent); chartlang carries opacity as a CSS alpha, so the converter maps
`alpha = (100 − transp)`:

```pine
plot(close, color=color.rgb(255, 153, 0, 60))   // → plot(bar.close, { color: "#FF990066" })
hline(0.0, color=color.new(color.white, 50))     // → hline(0.0, { color: "#FFFFFF80" })
```

- A **literal** `#RRGGBB` (or named) base **and** a literal `transp` fold to a
  quoted `#RRGGBBAA` hex string — no `color` import, byte-identical to a plain
  CSS color.
- A **dynamic** base **or** a dynamic `transp` emits
  `color.withAlpha(<base>, (100 − transp) / 100)` (core's `withAlpha` takes the
  alpha in the 0–1 range), and the generated module imports `color`.
- A 3-argument `color.rgb(r, g, b)` passes through unchanged, also importing
  `color`.

Every transparency fold raises a
[`color-transp-approximated`](./diagnostics.md#color-transp-approximated)
info — the alpha preserves the Pine transparency, so no action is needed. The
`color` import is added (and never destructured — `color` is a module-scope
namespace) only when a `color.*` member actually survives in the output.

## `ta.*` / `math.*` / `str.*`

A substantial `ta.*` subset passes through (moving averages, oscillators,
momentum, trend, volatility, volume, support/resistance, and statistical
helpers — `ema`, `sma`, `rsi`, `macd`, `bb`, `atr`, `stoch`, `crossover`,
`crossunder`, `pivothigh`/`pivotlow`, `vwap`, and more). A handful of names
differ in signature (e.g. Pine `ta.rma` → chartlang `ta.smma`) and emit a
`ta-signature-divergence` warning so you can check the arguments.

A `ta.*` call may appear **anywhere in an expression**, not only as the whole
right-hand side of an assignment. A `ta.*` in a **scalar** position — an
operator operand, a ternary arm, or a `math.*` / `Math.*` argument — is
projected to its per-bar `.current` scalar so the surrounding arithmetic
type-checks, and a `nested-ta-lowered` **info** marks the projection (deduped
to one per script):

```pine
r = ta.rsi(close, 14) * scale            // → ta.rsi(bar.close, 14).current * (inputs.scale as number)
s = close > open ? ta.ema(close, 8) : ta.sma(close, 8)
```

A `ta.*` in a **series** position stays a `Series` (no `.current`): a source
argument to another `ta.*` (`ta.sma(ta.atr(14), 5)` keeps the inner `ta.atr`
bare — chartlang `ta.*` sources are `Series<number>`), a direct `plot` / `hline`
value, a `request.security` callback body, or a history-access receiver
(`ta.sma(close, 20)[1]`). If an **unmapped** `ta.*` lands in a scalar position
it cannot be projected and stays a bare `Series`; a `nested-ta-not-lowered`
**warning** flags that the generated arithmetic may not type-check.

A `ta.*` / `math.*` / `str.*` member with no chartlang analogue is **left
as-is** and flagged:

- `ta-not-mapped` — unmapped `ta.*` (e.g. `ta.kcw`); call passed through.
- `math-not-mapped` — unmapped or rejected `math.*` (e.g. `math.random`,
  `math.round_to_mintick`).
- `str-not-mapped` / `str-format-not-mapped` — unmapped `str.*` or an
  un-lowerable `str.format` precision string.

These are **warnings**, not errors: the converter emits the call verbatim
(often with a `/* TODO unmapped */` marker) so you can finish the port by
hand. `fill(plot1, plot2, ...)` is the exception — it **errors**
(`fill-not-mapped`), since chartlang has no *plot-level* series fill in
v1. For a drawing-level band, `draw.fillBetween` fills the ribbon between
two anchor lists (the same primitive `linefill.new` lowers to); a
`plot`-level series fill is a planned follow-up.

## Multi-timeframe and multi-symbol

`request.security(<symbol>, "<timeframe>", <source>)` with a string-literal
timeframe converts to a chartlang security read. The **first** argument decides
the symbol and the **third** decides the chartlang form:

- **Symbol.** `syminfo.tickerid` (the chart's own symbol) omits `symbol`,
  lowering byte-identically to the single-symbol form
  `request.security({ interval })`. A **string-literal** ticker (e.g.
  `"AMEX:SPY"`) lowers to the multi-symbol form
  `request.security({ symbol: "AMEX:SPY", interval })` and emits the
  `request-security-different-symbol` **info** — the chart adapter must
  advertise the `multiSymbol` capability or that series degrades to NaN.
- A bare OHLCV source (`close`, `high`, `hl2`, …) lowers to the **data** form
  `request.security({ … }).<field>`.
- A `ta.*` / expression source lowers to the **callback** form
  `request.security({ … }, (bar) => …)`, which runs the expression on
  the higher-timeframe clock the way Pine does — the source's OHLCV reads are
  rewritten to `bar.close` / `bar.hl2` / … inside the callback. For example
  `request.security(syminfo.tickerid, "D", ta.ema(close, 9))` becomes
  `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))`.

A **computed** (non-literal) symbol, a non-literal timeframe, or an otherwise
unmapped form rejects (`request-security-not-mapped`); a `lookahead` argument
rejects (`request-security-lookahead-not-supported`).

## Calendar and sessions

Pine's calendar built-ins lower onto chartlang's
[`time.*`](../primitives/time.md) accessor namespace — pure functions of a
`Time` epoch, so the script never touches `Date`/`Intl`:

| Pine | chartlang |
|---|---|
| `dayofweek` (bare) | `time.dayofweek(bar.time)` |
| `dayofweek(t)` / `dayofweek(t, tz)` | `time.dayofweek(t)` / `time.dayofweek(t, tz)` |
| `time()` | `bar.time` (the no-arg current-bar open epoch) |
| `time_close()` | `time.timeClose(bar.time)` (bar start + the current bar's interval) |

`dayofweek` follows Pine's `1=Sunday .. 7=Saturday` convention. The
timezone-resolved `time(timeframe)` and `time(timeframe, session)` membership
forms are **not** mapped in v1 — they warn
[`time-builtin-not-mapped`](./diagnostics.md#time-builtin-not-mapped); use the
bare epoch with [`session.isOpen`](../primitives/session.md) /
[`time.*`](../primitives/time.md) directly. Determinism is UTC + fixed-offset
only — a real DST zone resolves to UTC plus a one-time `tz-dst-unsupported`
diagnostic (see [Time and sessions](../language/time-and-sessions.md)).
