# Orders

`order.*` is chartlang's structured trade-signal surface: four calls inside an
ordinary `compute`, carried on their own `orders` emission channel, plus a
readable *nominal* position the script can branch on.

| Call | Meaning |
| --- | --- |
| `order.buy(opts?)` | market intent — open or add to a long, reversing a short it crosses through |
| `order.sell(opts?)` | market intent — open or add to a short, reversing a long it crosses through |
| `order.close(opts?)` | market intent — target flat from either side |
| `order.position()` | read the nominal position: `{ size, avgPrice, entryBar }` |

There is **no strategy script kind**. `order.*` is legal wherever `alert` is —
inside the `compute` of `defineIndicator`, `defineAlert`, and `defineDrawing` —
and the `orders` capability is derived from the callsites, exactly as `alert(...)`
derives `alerts`.

## Why a channel and not an alert message

Before this surface existed, a script that wanted to say *"go long here"* had
one door: `alert("Long entry")`. `AlertEmission` carries a severity, a message,
and metadata — nothing that names an action or a direction — so the direction
lived in the prose and every consumer re-derived it by matching English
prefixes.

That is not a tuning problem. Measured against one consumer's own 234-template
catalogue, **all six** alert-emitting strategy templates misclassified: three
opened with `"Close crossed…"`, whose literal `close` reads as an *exit*
prefix, and three matched no prefix at all. An order emission carries the
action as an enum, the bar index, the magnitude, and a label, so nothing
downstream has to guess. See
[RFC 0002](../rfcs/0002-order-namespace.md) for the full decision record.

## The four calls

```ts
type OrderAction = "buy" | "sell" | "close";

type OrderOpts = {
    qty?: number;     // unsigned magnitude; absent = the consumer's default
    label?: string;   // shown on the auto-marker and forwarded to consumers
    marker?: boolean; // default true — auto-arrow opt-out, render-side only
    meta?: Record<string, JsonValue>; // JSON payload for consumers
};

type OrderPosition = {
    size: number;            // signed: > 0 long, < 0 short, 0 flat
    avgPrice: number | null; // null when flat; nominal — the signal bar's close
    entryBar: number | null; // bar index the current position opened
};
```

`qty` is an **unsigned magnitude** — the action names the side, never the sign.
Only the tracked position is signed.

The canonical script is an EMA cross that guards its entries on its own
position:

```ts
import { defineIndicator, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA cross orders",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        // Hoist both crossing tests and the position read out of the `if`s: a
        // stateful `ta.*` callsite evaluated only on some bars desyncs its own
        // history.
        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;
        const flatOrShort = order.position().size <= 0;

        if (flatOrShort && up) {
            order.buy({ label: "Long" });
        }
        if (!flatOrShort && down) {
            order.close({ label: "Exit" });
        }
    },
});
```

No drawing code appears anywhere and the chart still shows entry and exit
arrows — see [auto-rendered markers](#auto-rendered-markers).

## Nominal position semantics

The runtime tracks one signed position per runner. Four rules define it, and
the first one explains the other three.

**Orders queue on any step; the position folds only at the end of a
*confirmed* step** (`history` or `close`).

- **`order.position()` reads the state as of the previous confirmed fold.** A
  read inside `compute` never sees the same bar's own orders, because the fold
  happens after `compute` returns. This reproduces Pine's
  `strategy.position_size` lag exactly, and it falls out of the fold timing
  rather than needing a special case.
- **A `tick` step emits but never folds.** The host receives the order (exactly
  as it receives a tick's alerts) and no markers are drawn, because ticks are
  replaced rather than accumulated — a folding tick would double-apply the
  moment the head bar is re-ticked.
- **A halted step discards its intents.** `runtime.error()` (and a dependency
  error) drops the bar's pending orders along with the visual queues. A halted
  bar's intents are not trustworthy, and folding one that never reached the
  wire would leave the position and the emitted stream disagreeing.

### Fold arithmetic

The nominal fill price is the **folding step's `bar.close`**. An absent `qty`
is one unit.

| Case | Result |
| --- | --- |
| `buy q` from flat, or a `buy`/`sell` that crosses zero | position restarts: `entryBar` = this bar, `avgPrice` = this close |
| `buy q` added to an existing long (same side, larger) | `size += q`; `avgPrice` becomes the size-weighted average of nominal prices; `entryBar` unchanged |
| Same side but **not larger** — a partial reduce | `size` moves; `avgPrice` and `entryBar` ride through unchanged (only added units move an average) |
| A fold that lands exactly on `size === 0` | **flat**: `avgPrice` and `entryBar` become `null` |
| `close` | `size = 0`, `avgPrice = null`, `entryBar = null`. A partial-close `qty` is carried on the wire but **ignored** by the v1 tracker — `close` always flattens fully |

Because the position is signed, a reversal needs no flag of your own:

```ts
import { defineIndicator, hline, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "RSI reversal orders",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline, order }) {
        const rsi = ta.rsi(bar.close, 14);

        plot(rsi, { color: "#2563eb", title: "RSI(14)" });
        hline(70, { title: "Overbought", color: "#ef4444", lineStyle: "dashed" });
        hline(30, { title: "Oversold", color: "#16a34a", lineStyle: "dashed" });

        // A buy while short crosses zero and REVERSES in one order rather than
        // stacking, so the guards only exclude "already on this side".
        const size = order.position().size;

        if (rsi.current < 30 && size <= 0) {
            order.buy({ qty: 2, label: "Long" });
        }
        if (rsi.current > 70 && size >= 0) {
            order.sell({ qty: 2, label: "Short" });
        }
    },
});
```

A `state.bool` flag maintained beside `order.position()` would eventually
disagree with it. Read the position instead.

## The consumer contract

**The runtime does not simulate fills, slippage, commission, or equity.** A
consumer receives `RunnerEmissions.orders` and owns the economics; the typical
policy is next-bar-open fills.

That makes `order.position().avgPrice` *nominal*: it prices every fold at the
signal bar's close, knows nothing of capital, and applies no slippage or
commission. A consumer that fills at the next bar's open **will** report a
different average price and a different P&L than a naive read of `avgPrice`
suggests.

This is intended, not a rounding error. `order.position()` exists so a *script*
can branch on its own state deterministically; a consumer's simulator is the
authority on economics. A divergence a reader discovers is a bug report; a
divergence a reader is told about is a contract.

## Auto-rendered markers

Every accepted order on a confirmed step additionally emits an `arrow` plot —
and, when the call passed a non-empty `label`, a `label` plot — through the
plot pipeline every adapter already renders. No adapter code, no new plot kind,
no new drawing kind.

| | Arrow | Label (only when `label !== ""`) |
| --- | --- | --- |
| Slot id | `${slotId}#marker` | `${slotId}#label` |
| Direction / position | `up` for `buy`; `down` for `sell` / `close` | `below` for `buy`; `above` for `sell` / `close` |
| Anchor | `bar.low` for `buy`; `bar.high` for `sell` / `close` | the same anchor |
| Colour | `#26a69a` (buy) / `#ef5350` (sell, close) | the same |

Three rules make the markers safe to be free:

- **They are silently pre-gated.** An adapter whose `Capabilities.plots` lacks
  `arrow` (or `label`) gets no marker and **no diagnostic**. The `orders`
  channel is the source of truth; markers are a courtesy, and an adapter that
  cannot draw an arrow has not failed to honour a promise it made.
- **`marker: false` suppresses both plots** — and nothing else. The order still
  rides the wire and still folds into the position, because `marker` is
  render-side only and is deliberately absent from `OrderEmission`: the wire
  records the intent, not how it was drawn.
- **The two dedup policies differ on purpose.** Marker plots ride the ordinary
  plot queue, which is `(slotId, bar)` last-write-wins, so a repeated same-bar
  fold collapses to one picture — while the `orders` channel stays append-only
  and keeps every event. The *event* must not be lost; the *picture* of it must
  not be doubled.

`OrderOpts` carries no `z`, deliberately: an author who wants layered control
opts out and draws their own glyph.

```ts
import { defineIndicator, draw, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Hand-drawn entry glyph",
    apiVersion: 1,
    overlay: true,
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, plot, draw, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;
        const flatOrShort = order.position().size <= 0;

        if (flatOrShort && up) {
            order.buy({ label: "Long", marker: false });
            draw.arrowMarkUp(bar.point(0, bar.low), {
                color: "#7c3aed",
                text: "Entry",
                z: 1,
            });
        }
        // The exit leg keeps its default marker.
        if (!flatOrShort && down) {
            order.close({ label: "Exit" });
        }
    },
});
```

## Capability gating

Adapters declare `Capabilities.orders: boolean`.

- `orders: true` — orders reach `onEmissions` on `RunnerEmissions.orders`.
- `orders: false` — the runtime drops the call, emits no markers, and pushes
  one `unsupported-orders` diagnostic **once per slot per mount**. (Per order
  per bar would be a denial-of-service on the diagnostic channel across a
  10 000-bar backfill.)

Declining is a supported posture, not a failure: a headless server evaluator
that only needs alerts may declare `orders: false` and ignore the channel,
exactly as it already ignores drawings.

Separately, the wire is the arbiter of shape. A `qty` that is not finite and
`> 0`, a non-string `label`, or non-JSON `meta` is rejected by the emission
validator with `malformed-emission`; the order is queued nowhere and does
**not** reach the position tracker. Nothing is silently clamped.

## Dependencies and siblings

Order emissions follow the **alert** side of the composition policy, not the
drawing side:

- **A private dep** (`const foo = defineIndicator(...)`, a data feed) has its
  orders **dropped**. A data dependency must not trade through its consumer;
  only diagnostics escape a private dep.
- **A sibling** (`export const foo = defineIndicator(...)`) has its orders
  **forwarded**, with the `export:<name>/` prefix on `slotId` — exactly as its
  alerts are prefixed. `dedupeKey` is left alone: it embeds the original,
  unprefixed slot id, and rewriting it would break host idempotency across a
  remount.

Each runner folds its own position, so a sibling's `order.position()` always
matches the stream that sibling emitted.

## What is deliberately absent

`apiVersion: 1` ships market intents and nothing that requires a fill model:

- **No limit, stop, or bracket orders**, and no resting-order lifecycle. Each
  would force the language to define *when* a resting order fills, which is a
  fill model, which belongs to the consumer.
- **No economic simulation** — no fills, slippage, commission, equity curve, or
  performance report.
- **No `qty` economics** in the nominal tracker. `qty` is carried on the wire
  and surfaced to consumers from day one; the tracker reads an absent `qty` as
  one unit and ignores it on `close`. A consumer may honour it fully.

All of these stay additive within `apiVersion: 1` if they ever land.

## Cross-links

- Wire shape: [Emission payloads § OrderEmission](../spec/emissions.md#orderemission).
- Fold timing and queue rules: [Execution semantics § Order semantics](../spec/semantics.md#order-semantics).
- Capability derivation: [Script manifest § Script kinds](../spec/manifest.md#script-kinds).
- Adapter side: [Adapter capabilities](../adapters/capabilities.md), [Adapter contract](../adapters/contract.md).
- Pine `strategy.*` mapping: [Pine migration § Strategy signals](../spec/pine-migration.md#strategy-signals).
- Auto-generated reference: [order.buy](../primitives/order/buy.md), [order.sell](../primitives/order/sell.md), [order.close](../primitives/order/close.md), [order.position](../primitives/order/position.md).
- The decision record: [RFC 0002](../rfcs/0002-order-namespace.md).
