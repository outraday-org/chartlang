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
| `linefill.new` | `draw.rotatedRectangle` — a filled quad over the two referenced lines' endpoints (best-effort; chartlang has no fill-between-series primitive) |

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

## Inputs

| Pine input | chartlang input |
|---|---|
| `input.int` | `input.int` |
| `input.float` | `input.float` |
| `input.bool` | `input.bool` |
| `input.string` | `input.string` |
| `input.color` | `input.color` |
| `input.source` | `input.source` (OHLCV built-in default only) |
| `input.symbol` | `input.symbol` |
| `input.time` | `input.time` |
| `input.price` | `input.price` |
| `input.timeframe` | `input.interval` |
| `input.enum` | **rejected** (`input-enum-rejected`) — Pine v6 enums are UDT-backed |

Input defaults and option literals must be **compile-time literals** (a
unary `+`/`-` on a numeric literal is allowed, e.g. `input.int(-1)`). A
computed default rejects with `non-literal-input-default`. Unmapped named
args (`tooltip`/`group`/`inline`/`confirm`) are dropped with an
`input-arg-not-mapped` warning, but the input still emits. An inline input
(`ta.ema(close, input.int(20))`) is promoted to a named top-level input
(`inline-input-promoted`).

## Control flow

| Pine construct | Converts? |
|---|---|
| `if` / `else if` / `else` | ✅ |
| Ternary `a ? b : c` | ✅ (chained ternary → an `chained-ternary-warning` info) |
| `switch` (subjected and subjectless) | ✅ |
| `for i = a to b [by s]` with **literal-resolvable** bounds | ✅ |
| `for` with a non-literal bound and a stateful body | ❌ `loop-bounds-not-literal-for-stateful-body` |
| `for ... in` | ❌ `unsupported-for-in` — rewrite as a literal `for i = a to b` |
| `while` | ❌ `unsupported-while` — rewrite as a literal `for i = a to b` |

A `for` whose body calls a **stateful** primitive (`plot` / `hline` /
`alert` / `ta.*` / `draw.*`) is **unrolled** at convert time (the compiler
forbids a stateful call inside a loop), so its bound must resolve to a
compile-time integer. A bound from an `input.int` default unrolls but
freezes the count at the default (`loop-unroll-frozen-at-input-default`).

## State

A `var` / `varip` scalar becomes a chartlang `state.*` slot. The literal
initializer picks the factory (`int`→`state.int`, `float`→`state.float`,
`bool`→`state.bool`, `string`→`state.string`); a `varip` uses the
`state.tick.*` form. An un-inferable type (e.g. a `#RRGGBB` color literal or
an identifier initializer) defaults to `state.float` with a
`scalar-state-type-defaulted` info — the converter never silently guesses.

## `ta.*` / `math.*` / `str.*`

A substantial `ta.*` subset passes through (moving averages, oscillators,
momentum, trend, volatility, volume, support/resistance, and statistical
helpers — `ema`, `sma`, `rsi`, `macd`, `bb`, `atr`, `stoch`, `crossover`,
`crossunder`, `pivothigh`/`pivotlow`, `vwap`, and more). A handful of names
differ in signature (e.g. Pine `ta.rma` → chartlang `ta.smma`) and emit a
`ta-signature-divergence` warning so you can check the arguments.

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
(`fill-not-mapped`), since chartlang has no plot-fill primitive in v1.

## Multi-timeframe

`request.security(syminfo.tickerid, "<timeframe>", <source>)` with a
**same-symbol** string-literal timeframe converts to a chartlang MTF read. The
third argument decides the chartlang form:

- A bare OHLCV source (`close`, `high`, `hl2`, …) lowers to the **data** form
  `request.security({ interval }).<field>`.
- A `ta.*` / expression source lowers to the **callback** form
  `request.security({ interval }, (bar) => …)`, which runs the expression on
  the higher-timeframe clock the way Pine does — the source's OHLCV reads are
  rewritten to `bar.close` / `bar.hl2` / … inside the callback. For example
  `request.security(syminfo.tickerid, "D", ta.ema(close, 9))` becomes
  `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))`.

A cross-symbol request, a non-literal timeframe, or a `lookahead` argument is
outside the v1 subset and warns/rejects (`request-security-different-symbol`,
`request-security-not-mapped`, `request-security-lookahead-not-supported`).
