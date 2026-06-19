# Language overview

chartlang is a small TypeScript-embedded DSL for technical-analysis
scripts. A chartlang script is one `.chart.ts` module that default-exports
a call to `defineIndicator`, `defineDrawing`, `defineAlert`, or
`defineAlertCondition`. The compiler turns it into a self-contained ESM
bundle plus a JSON manifest plus a `.d.ts` declaration; the runtime
executes the bundle once per bar against whatever chart adapter is
mounted.

## A minimal script

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

Three details carry the contract:

- **Top-level imports come from `@invinite-org/chartlang-core` only.**
  The compiler walks the named-import list to derive
  `manifest.capabilities` and to confirm every primitive a script touches
  is part of the frozen `apiVersion: 1` surface.
- **The `compute` callback destructures from the per-bar context.** The
  runtime hands `compute({ bar, ta, plot, alert, draw, ... })` slot-aware
  implementations on each invocation. Top-level `ta`/`plot`/`alert`
  identifiers are compile-time holes that throw when called outside the
  runtime; the destructured callables are the real implementations.
- **`apiVersion: 1` is a numeric literal.** It selects the frozen
  language contract every chartlang v1 implementation honours. See
  [Version pinning](./version-pinning.md).

## The four script kinds

The spec section on the [grammar](../spec/grammar.md#source-form) is
normative; the short version:

| Constructor | Default-exported by | Emits |
| --- | --- | --- |
| `defineIndicator` | indicator scripts | plots, drawings, alerts |
| `defineDrawing` | drawing-oriented scripts | drawings, alerts |
| `defineAlert` | headless alert scripts | alerts only |
| `defineAlertCondition` | scripts that declare named user-wireable conditions | alert-condition signals |

Every constructor accepts `name: string`, `apiVersion: 1`, optional
`inputs`, and a `compute` function. Constructor-specific fields (overlay,
maxDrawings, requiresIntervals, conditions, ...) are listed in the
[grammar spec](../spec/grammar.md#defineindicator).

## The module surface

Scripts may import from two specifiers and no others:

- `@invinite-org/chartlang-core` — every script-visible primitive.
- `@invinite-org/chartlang-core/time` — pure time helpers.

The frozen primitive namespaces are:

| Namespace | Purpose | Reference |
| --- | --- | --- |
| `ta.*` | technical-analysis primitives (EMA, RSI, MACD, ...) | [TA primitives](../primitives/ta/) |
| `plot`, `hline` | per-bar value plots and horizontal lines | [plot](../primitives/plot/plot.md), [hline](../primitives/plot/hline.md) |
| `draw.*` | imperative drawing primitives (line, label, fib, ...) | [Draw primitives](../primitives/draw/) |
| `alert` | immediate-fire alerts | [Alerts](./alerts.md) |
| `input.*` | declarative input descriptors | [Inputs](./inputs.md) |
| `state.*` | persistent and tick-mutable state slots | [state](../primitives/state/float.md) |
| `barstate`, `syminfo`, `timeframe` | per-step views | [bar state](../primitives/barstate.md), [symbol info](../primitives/syminfo.md), [timeframe](../primitives/timeframe.md) |
| `request.security`, `request.lowerTf` | higher- and lower-timeframe data | [security](../primitives/request/security.md), [lowerTf](../primitives/request/lowerTf.md) |
| `runtime.log.*`, `runtime.error` | debug logs and fatal halt | [Alerts § logs](./alerts.md#runtime-logs) |
| `color`, `rgb`, `hsl`, `withAlpha`, `fromGradient` | color helpers | core export |

### Bands and fills

`draw.fillBetween(edgeA, edgeB, opts?)` fills the ribbon between two
edges, each a list of `WorldPoint`s. The filled region is the closed
polygon `edgeA` forward then `edgeB` reversed, so the two edges need not
share x-coordinates or length — the same primitive the Pine converter
lowers `linefill.new` to.

```ts
// Two edges accumulate one vertex per bar and the band is re-emitted
// from the same callsite every step, so the ribbon simply extends.
const upperEdge: WorldPoint[] = [];
const lowerEdge: WorldPoint[] = [];

compute({ bar, ta, draw }) {
    const upper = ta.ema(bar.high, 20);
    const lower = ta.ema(bar.low, 20);
    if (Number.isFinite(upper) && Number.isFinite(lower)) {
        upperEdge.push({ time: bar.time, price: upper });
        lowerEdge.push({ time: bar.time, price: lower });
    }
    if (upperEdge.length >= 2) {
        draw.fillBetween(upperEdge, lowerEdge, { fill: "#3b82f6", fillAlpha: 0.2 });
    }
}
```

`FillBetweenStyle` carries `fill` / `fillAlpha` plus an optional stroke.
Each edge needs at least two finite anchors: guard warmup in-script (the
`Number.isFinite` + `length >= 2` checks above) — an edge with fewer than
two points or a `NaN` price is dropped with a `malformed-emission`
diagnostic for that frame. See
[`draw.fillBetween`](../primitives/draw/fill-between) for the full
signature.

## The `compute` contract

The runtime calls `compute(ctx)` once per main-stream `history` /
`close` / `tick` event in delivery order. Execution is single-threaded
and non-reentrant: one `compute` call finishes before the next begins.

Inside one step you may:

- Read `bar`, `inputs`, `barstate`, `syminfo`, `timeframe`.
- Read `Series<T>` values via `series.current` or numeric lookback
  (`series[1]`, `series[5]`, ...).
- Call `ta.*` primitives — every call site allocates one stable runtime
  slot identified by `<sourcePath>:<line>:<col>#0`.
- Emit through `plot`, `hline`, `draw.*`, `alert`, `runtime.log.*`.
- Read and write `state.*` / `state.tick.*` slots.

You may not read `Date`, `Math.random`, `fetch`, dynamic `import()`, or
any other host global. See [Forbidden constructs](./forbidden-constructs.md).

## Where to go next

- [Series and indexing](./series-and-indexing.md) — the `Series<T>`
  model and warmup behaviour.
- [Inputs](./inputs.md) — declaring user-tunable parameters.
- [Alerts](./alerts.md) — immediate `alert()`, `defineAlertCondition`,
  and runtime logs.
- [Version pinning](./version-pinning.md) — how `apiVersion: 1` keeps
  old scripts running unchanged.
- [Forbidden constructs](./forbidden-constructs.md) — the diagnostic
  table.
- The [grammar spec](../spec/grammar.md) and
  [execution semantics spec](../spec/semantics.md) are the normative
  source for everything on this page.
