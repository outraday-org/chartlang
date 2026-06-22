---
name: chartlang-coding
description: >-
  Write chartlang `.chart.ts` indicator, drawing, and alert scripts.
  Use this skill whenever the user is editing a `.chart.ts` file, asks
  to write or fix a chartlang indicator, mentions `defineIndicator`,
  `ta.*`, `plot`, `draw.*`, `alert`, or `input.*`, or wires AI into an
  editor to author chartlang scripts. Covers the import+destructure
  contract, the four script kinds, forbidden constructs, inputs, and
  the full `ta.*`/`draw.*` primitive surface.
---

# chartlang-coding

You are writing chartlang. chartlang is an open-source TypeScript
embedded DSL for technical-analysis scripts. Authors write `.chart.ts`
files using a small frozen set of primitives; a compiler emits a
sandboxable bundle; a runtime executes it bar-by-bar; an adapter
renders the emissions on whatever chart vendor the embedder picked.

Use the references in this skill for surface detail:

- [`references/primitives.md`](./references/primitives.md) — the full
  `ta.*`/`draw.*` signature table, generated from JSDoc.
- [`references/forbidden.md`](./references/forbidden.md) — the constructs
  the compiler rejects and the chartlang-idiomatic replacements.
- [`references/examples.md`](./references/examples.md) — complete worked
  scripts to scan for patterns.
- [`references/translating-from-pine.md`](./references/translating-from-pine.md)
  — port a Pine Script v6 indicator to chartlang (or interpret a
  `pine-converter` diagnostic): the three drawing camps, the hard-reject
  patterns, and their Pine rewrites.

## 1. The contract in one screen

Every chartlang script is a TypeScript module that default-exports one
call to `defineIndicator`, `defineDrawing`, `defineAlert`, or
`defineAlertCondition`. The minimal indicator:

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const ema = ta.ema(bar.close, 20);
        plot(ema, { color: "#26a69a", title: "EMA(20)" });
    },
});
```

Two rules carry the contract — both must hold at the same time:

1. **Top-level imports come from `@invinite-org/chartlang-core` only.**
   The compiler walks the named-import list to derive
   `manifest.capabilities` and to confirm every primitive the script
   touches is part of the frozen `apiVersion: 1` surface. The only
   other allowed import is `@invinite-org/chartlang-core/time` for
   pure time helpers.
2. **`compute({ bar, ta, plot, ... })` destructures the per-bar
   context.** The destructured callables are the real slot-aware
   implementations the runtime hands you each step. Top-level
   `ta`/`plot`/`alert`/`hline`/`draw`/`request`/`state`/`runtime`
   identifiers are compile-time holes that throw if called outside
   the runtime.

If you import `ta` at the top but forget to destructure it inside
`compute` (or vice versa), the script breaks. **Both forms appear
together, always.** `apiVersion: 1` is a numeric literal, never a
variable.

## 2. The four script kinds

| Constructor | Use it for | Emits |
|---|---|---|
| `defineIndicator` | per-bar indicators (the common case) | plots, drawings, alerts |
| `defineDrawing` | drawing-oriented scripts | drawings, alerts |
| `defineAlert` | headless alert scripts | alerts only |
| `defineAlertCondition` | user-wireable named conditions | alert-condition signals |

Every constructor accepts `name: string` (literal), `apiVersion: 1`
(numeric literal), optional `inputs`, and a `compute` function.
Constructor-specific fields (`overlay`, `maxDrawings`,
`requiresIntervals`, `conditions`, ...) are listed in the
[grammar spec](https://docs.chartlang.invinite.com/spec/grammar).

## 3. Series and indexing

Most `ta.*` primitives take a `Series<number>` (an OHLCV source such as
`bar.close`) and return a `Series<number>`. Read values via:

- `series.current` (or `series[0]`) — the value at the current bar.
- `series[n]` for a positive integer literal — the value `n` bars ago.
- `series.length` — the count of filled slots so far.

The bar's OHLCV + derived fields (`bar.close`, `bar.open`, `bar.high`,
`bar.low`, `bar.volume`, `bar.hl2`, `bar.hlc3`, `bar.ohlc4`, `bar.hlcc4`)
are themselves price series — index them directly (`bar.close[1]` is the
close one bar ago) **and** use them as plain numbers (`bar.close * 2`,
`plot(bar.close)`, `ta.ema(bar.close, 20)`). No moving-average helper is
needed to make a price indexable. Because the field is an object,
`Number.isFinite(bar.close)` is always `false` and `bar.close === 42` is
`false` — use `bar.close.current` (or `+bar.close`) when you need the raw
scalar, e.g. storing it in a `state.*` slot or a drawing anchor.

**Warmup.** `ta.ema(_, 14)` returns `NaN` for the first 13 bars;
`ta.rsi(_, n)` warms over its `n`-bar window; `ta.macd` warms over the
longer of its two EMAs. Plots whose value is `NaN`/`±Infinity` render
as gaps, not zeroes. Each primitive's `@warmup` is in
[`references/primitives.md`](./references/primitives.md).

**Provably-bounded indices size precisely.** A series index the compiler
can prove bounded at compile time — a literal (`series[1]`), a
bounded-loop induction variable (`for (let i = 0; i < N; i++) series[i]`),
a `const` numeric literal (`const k = 4; series[k]`), or an affine
combination of those (`series[i + 1]`, `series[K - i]`) — is sized to the
exact `maxLookback` with **no** warning. Only a genuinely dynamic index
(an unbounded variable, an unsupported operator, a value the compiler
cannot bound) emits the `dynamic-series-index` warning and forces the
runtime to allocate a 5000-slot fallback buffer.

**Anchoring drawings by bar offset — `bar.point(offset, price)`.**
Drawing anchors are always a `WorldPoint` (`{ time, price }`); writing
absolute timestamps for offset-relative anchors is awkward, so
`bar.point` resolves an integer bar offset to the real (or extrapolated)
time and returns that `WorldPoint`. It composes directly with every
`draw.*` anchor argument:

- `bar.point(0, bar.close)` — the current bar.
- `bar.point(-n, price)` — `n` bars back; resolves the real historical
  timestamp (or `NaN` time when `n` exceeds retained history — it never
  throws). A **negative literal** offset extends the script's lookback
  exactly like `series[n]`, so the buffer retains enough depth.
- `bar.point(n, price)` — `n` bars into the future; the time is
  extrapolated from the recent bar spacing. Future offsets need no
  lookback.

```ts
// Tracking line from 10 bars ago to the current close.
draw.line(bar.point(-10, bar.close), bar.point(0, bar.close));
```

### Layering / draw order

Three levers control which mark renders on top of which:

- **Call order within a band.** Marks of the same kind paint in the order you
  call them, last on top. To put series A over series B, call `plot(B)`
  **before** `plot(A)`. The same rule holds for two `draw.*` calls.
- **Drawings render above plots by default.** A `draw.*()` mark paints on top
  of every `plot()` series unless an explicit `z` says otherwise.
- **The `z` option crosses bands.** `plot()` and every `draw.*()` call take an
  optional `z?: number` render-order key: default `0`, higher renders on top,
  lower behind, any finite number (fractional like `z: 1.5` is fine). It is
  presentation-only — it never changes `value`, alerts, or `state.*`, and
  `z: 0` is byte-identical to omitting it. Because plots default to a lower
  band than drawings, a **negative** drawing `z` is the only way to push a
  drawing beneath a plot: `draw.fillBetween(a, b, { z: -1 })` renders below a
  default `plot(...)`. See the `z-layering` example.

## 4. Inputs

Declare user-tunable parameters in the `inputs:` field. The compiler
serialises descriptors into `manifest.inputs`; the host renders a
settings form. Defaults and option literals MUST be literals.

```ts
import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA",
    apiVersion: 1,
    overlay: true,
    inputs: {
        length: input.int(20, { min: 2, max: 200, title: "EMA length" }),
        color: input.color("#26a69a", { title: "Line color" }),
    },
    compute({ bar, inputs, ta, plot }) {
        const ema = ta.ema(bar.close, inputs.length as number);
        plot(ema, { color: inputs.color as string, title: "EMA" });
    },
});
```

Twelve input kinds ship in `apiVersion: 1`: `int`, `float`, `bool`,
`string`, `enum`, `color`, `source`, `time`, `price`, `symbol`,
`interval`, `externalSeries`. `inputs.X` arrives at `compute` as a JSON
value; the script narrows with `as number`/`as string`/`as boolean`.
Only one `input.interval` per script (the user-pickable main timeframe).

## 5. Indicator composition

Bind a producer indicator to a `const`, then read its plot output as a
`Series<number>` via `<binding>.output("title")`. The export form
determines what the host renders:

| Form | Renders? |
|---|---|
| `export default defineIndicator(...)` | Yes — primary |
| `export const foo = defineIndicator(...)` | Yes — sibling |
| `const foo = defineIndicator(...)` | No — private data dep |

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

const fastTrend = baseTrend.withInputs({ length: 20 });

export default defineIndicator({
    name: "Trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        if (ta.crossover(fast, bar.close).current) {
            plot(bar.close, { title: "cross" });
        }
    },
});
```

`.withInputs({ key: value })` overrides producer inputs without forking
its source. Every consumed `plot` must have a `title` — an untitled
producer output fails compile with `dep-output-not-titled`.

## 6. Forbidden constructs (hard rules)

The compiler rejects every TypeScript construct that breaks determinism,
the sandbox, or replay. There is **no escape hatch in
`apiVersion: 1`**. The full list with diagnostic codes and replacements
is in [`references/forbidden.md`](./references/forbidden.md). The hits
you will trip most often:

- **No nondeterministic globals** — `Date`, `Math.random`, `fetch`,
  `setTimeout`, `setInterval`, `queueMicrotask`, `Promise`,
  `requestAnimationFrame`, `eval`, `new Function(...)`, `require(...)`,
  dynamic `import(...)`. Diagnostic: `hostile-global`. Time comes from
  `bar.time` (UTC ms); randomness is not supported.
- **No unbounded loops.** `while`, `do…while`, `for…of`, `for…in` are
  rejected. The only allowed shape is `for (let i = <literal>; i </<=
  <literal>; i++)`. Diagnostic: `unbounded-loop`. Reading a series at the
  loop variable (or an affine expression of it) inside this shape —
  `for (let i = 0; i < N; i++) sum += bar.close[i]` — is sized precisely,
  so a bounded loop is a first-class way to express a rolling window.
- **No stateful calls inside loops.** `ta.*`/`plot`/`alert`/`draw.*`/`state.*`
  callsites own a slot keyed by `<sourcePath>:<line>:<col>#0`. Calling
  them inside a loop body silently merges per-iteration state.
  Diagnostic: `stateful-call-inside-loop`. Move the call to module-
  or `compute`-top level.
- **No recursion.** A function that calls itself fails compile with
  `recursion-not-allowed`.

## 7. Primitive surface

The complete `ta.*` / `draw.*` reference — every signature, `@formula`,
`@warmup`, `@since`, and stability marker — is in
[`references/primitives.md`](./references/primitives.md). That file is
generated from the same JSDoc the docs site uses; it is authoritative.
Do not improvise primitive names from memory — look them up there.

Highlights of the surface:

- `ta.*` — moving averages, oscillators, momentum, trend, volatility,
  volume, support/resistance, and statistical helpers (`ema`, `sma`,
  `rsi`, `macd`, `bb`, `atr`, `stoch`, `crossover`, `crossunder`, ...).
- `draw.*` — lines, boxes, curves, fills/bands, Fibonacci, Gann,
  pitchforks, harmonic patterns, Elliott waves, cycles.
- `plot(value, opts?)` and `hline(level, opts?)` for per-bar value plots
  and horizontal lines.
- `alert(message, opts?)` with `severity: "info" | "warning" | "critical"`.
- `request.security({ interval })` and `request.lowerTf({ interval })`
  for higher- and lower-timeframe data. The interval must be a
  compile-time string literal.
- `request.security({ interval }, (bar) => …)` — the **expression form**,
  which runs the callback on the higher-timeframe clock (a true HTF
  indicator), unlike the data form whose `ta.*` count main bars. The
  callback may reference only the HTF `bar`, the ambient `ta` / `inputs`,
  safe `Math.*` globals (`Math.random` stays forbidden), and literals:
  `(bar) => ta.ema(bar.close, 20)` ✅. Capturing an outer local —
  `(bar) => ta.ema(bar.close, k)` where `k` is a `compute` local — fails
  compile with `request-security-expr-captures-local`; read the input
  inside the callback instead (`(bar) => ta.ema(bar.close, inputs.k as
  number)`). `request.lowerTf` stays **data-only** (no callback form).
- `state.float(initial)`, `state.bool(...)`, `state.int(...)`,
  `state.string(...)` for cross-bar **scalar** state (`s.value` get/set, no
  indexing). `state.series(initial)` is the one writable **series** slot —
  store an arbitrary value each bar (`s.value = expr`) and read its history
  back (`s.current` / `+s` / `s[0]` current, `s[1]` one bar ago, `s.length`
  filled count). It advances once per bar automatically; an unwritten bar is a
  `NaN` gap. Like `bar.close`, the handle is an object, so `Number.isFinite(s)`
  is `false` — use `s.current` / `+s` / `s.value` for the raw scalar. Reach for
  it only when you need the history of a value **you** compute that is not
  already a series (a self-referential or conditionally-updated value); index
  `bar.*` / `ta.*` directly otherwise. It is the lowering target for Pine's
  `var x := …; x[1]`.
- `state.array<number>(capacity)` is a persistent **bounded collection** — a
  fixed-capacity FIFO ring you **push** many values into across bars:
  `a.push(v)` appends (oldest evicted at capacity), `a.get(n)` reads the `n`-th
  element from newest (`a.get(0)` is newest; out-of-range ⇒ `NaN`), `a.last()`
  === `a.get(0)`, `a.size` is the filled count (≤ `a.capacity`), `a.clear()`
  empties it. `capacity` **must be a compile-time numeric literal** (a `const`
  numeric binding resolves; max `100_000`); a non-literal is
  `state-array-capacity-not-literal`. Like the other handles it is an object, so
  it is **not** number-coercible — `+a` is `NaN`; read with `a.get(n)` /
  `a.last()`. **Distinguish from `state.series`:** `state.series` is "the value
  `N` **bars** ago" (one value's bar history); `state.array` is "a bounded
  **bag** of the last `K` things I **pushed**" (a rolling window, an event-value
  log, a multi-push-per-bar accumulator). Only the allocation `state.array(...)`
  call is a stateful registry callsite — `push`/`get`/`last` are handle methods,
  so they ARE legal inside a bounded `for` loop (iterate elements with a
  **literal** bound + an inner `if (i < a.size)` guard):

  ```ts
  const win = state.array<number>(20);
  win.push(bar.close.current);
  let sum = 0;
  for (let i = 0; i < 20; i++) {
      if (i < win.size) sum += win.get(i);
  }
  plot(win.size > 0 ? sum / win.size : Number.NaN);
  ```

## 8. Worked examples

See [`references/examples.md`](./references/examples.md) for four
complete, compileable scripts:

- **EMA cross with alert** — the canonical indicator.
- **Bollinger bands** — multi-output plot bundle.
- **RSI divergence alert** — `hline` zones + `alert` on crossover.
- **Indicator composition** — producer + consumer in separate files
  with `.withInputs(...)` and `.output(...)`.

## 9. Common mistakes

- **Importing `ta` at the top but not destructuring it inside `compute`
  (or vice versa).** Both forms must appear together. The top-level
  import feeds capability extraction; the destructured parameter is the
  real implementation.
- **Calling a primitive outside `compute`.** Top-level `ta.ema(...)`
  throws — those identifiers are compile-time holes. Stateful calls
  must live in `compute`.
- **Using `Date.now()` or `Math.random()`.** Both are `hostile-global`.
  Use `bar.time` for time; randomness is not supported.
- **Forgetting `.current` on a crossover series.**
  `if (ta.crossover(fast, slow).current)` — the series itself is truthy,
  so `if (ta.crossover(fast, slow))` is always true. Always read
  `.current`.
- **An untitled `plot()` in a producer indicator.** If anything reads
  the producer via `.output("title")`, every `plot` must carry a
  `title`. The diagnostic is `dep-output-not-titled`.
- **A second `input.interval`.** Only one per script — the
  user-pickable main timeframe. The compiler rejects the second with
  `multiple-input-interval`.
- **A non-literal `apiVersion`.** It must be the numeric literal `1`,
  not a variable. The compiler reads it statically.
