# Adapter contract

An adapter is the integration layer between chartlang and a concrete
chart library. It feeds candles into the runtime, declares which
emission families the chart can render, and translates each
`RunnerEmissions` batch into chart operations. This page is the
reference for the `Adapter` interface itself; see
[Writing an adapter](./writing-an-adapter.md) for the step-by-step
authoring tutorial and [Capabilities](./capabilities.md) for the
capability bag.

The wire shapes the adapter consumes are normative in
[Emission payloads](../spec/emissions.md). Adapters never see script
source; they see the wire batch the runtime drains.

## The `Adapter` interface

`@invinite-org/chartlang-adapter-kit` exports `Adapter`:

```ts
import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

export type Adapter = {
    readonly id: string;
    readonly name: string;
    readonly capabilities: Capabilities;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly resolvePlotOverrides?: (
        scriptId: string,
    ) => Readonly<Record<string, PlotOverride>>;
    readonly symInfo?: AdapterSymInfo;
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    onEmissions(emissions: RunnerEmissions): void;
    dispose(): void;
};
```

`defineAdapter(opts)` builds the frozen `Adapter` object from these
fields. Adapter packages always ship a default export shaped like this.

| Field | Purpose |
| --- | --- |
| `id` | Stable adapter identifier. Surfaces in error reports. |
| `name` | Human-readable adapter name. |
| `capabilities` | The adapter's capability bag. The runtime gates every emission against this — see [Capabilities](./capabilities.md). |
| `resolveInputs?` | Optional callback that returns per-script input overrides at mount. Merged over manifest defaults by the runtime. |
| `resolvePlotOverrides?` | Optional callback that returns per-script, `slotId`-keyed presentation overrides at mount. See [Plot overrides](#plot-overrides). |
| `symInfo?` | Optional per-mount symbol metadata. Populates `syminfo.*` in scripts; still gated by `capabilities.symInfoFields`. |
| `candles` | Async iterable of `history`, `close`, and `tick` events. The runtime consumes them in delivery order. |
| `onEmissions` | The runtime hands each drained `RunnerEmissions` batch here. Translate into chart operations. |
| `dispose` | Tear down chart subscriptions, series instances, DOM handles, workers, and timers. Called exactly once. |

## The candle stream

`candles(opts)` is the only data path into the runtime:

```ts
import { defineAdapter, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Adapter, CandleEvent } from "@invinite-org/chartlang-adapter-kit";

const _bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar> = [];

async function* mainStream(): AsyncIterable<CandleEvent> {
    yield { kind: "history", bars: _bars };
    // for await (const bar of liveClosedBars()) yield { kind: "close", bar };
}

export const adapter: Adapter = defineAdapter({
    id: "demo",
    name: "Demo",
    capabilities: {
        plots: new Set(["line"]),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5_000,
        maxTickHz: 10,
    },
    candles: ({ interval }) => (interval === "chart" ? mainStream() : mockCandleSource([])),
    onEmissions: () => {},
    dispose: () => {},
});
```

`opts.interval` is `"chart"` for the main stream. Secondary streams use
the exact interval values declared in `capabilities.intervals` — those
are what `request.security` and `request.lowerTf` ask for.

| Event kind | Meaning |
| --- | --- |
| `history` | Batched warmup bars in source order. The runtime processes each one as a close event. |
| `close` | A finalised bar. The runtime advances its bar index after compute. |
| `tick` | An in-progress update for the current bar's head slot. `compute` runs but the bar index does not advance. |

Multi-timeframe events carry the requested `streamKey`:

```ts
const evt: CandleEvent = {
    kind: "close",
    streamKey: "1D",
    bar: {} as import("@invinite-org/chartlang-core").Bar,
};
void evt;
```

If the runtime sees a `streamKey` not registered in
`manifest.requestedIntervals`, it drops the event and emits
`unknown-secondary-stream`.

## The emission batch

`onEmissions` receives the runtime's drained batch:

```ts
import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

function handle(emissions: RunnerEmissions): void {
    for (const plot of emissions.plots) {
        void plot; // translate by plot.style.kind, key by plot.slotId
    }
    for (const drawing of emissions.drawings) {
        void drawing; // create / update / remove by drawing.op
    }
    for (const alert of emissions.alerts) {
        void alert; // dispatch per alert.channels, idempotent on alert.dedupeKey
    }
    // also: emissions.alertConditions, emissions.logs, emissions.diagnostics
    void emissions.fromBar;
    void emissions.toBar;
}
```

The batch is atomic for the covered `[fromBar, toBar]` range. Inside
one batch:

- Plots dedupe by `(slotId, bar)` with last-write-wins.
- Alerts dedupe by `(slotId, bar)` with last-write-wins; adapters route
  by `alert.channels` and idempotency on `alert.dedupeKey` for async
  delivery.
- Drawings dedupe by `(handleId, bar)` with last-write-wins. Each
  drawing carries an `op: "create" | "update" | "remove"`; `create` and
  `update` carry the full state (not a patch).
- Alert conditions and logs preserve append order and are not
  queue-deduped.
- Diagnostics carry capability mismatches and other non-rendered
  signals. Surface them in dev tooling; do not render them as user
  alerts.

The complete schema and ordering rules:
[Execution semantics § Emission ordering](../spec/semantics.md#emission-ordering)
and [Emission payloads](../spec/emissions.md).

## Plot overrides

A **plot override** lets the embedder recolor or show/hide an individual
plot of a running script **without editing the script source** — the
TradingView "Style tab" model. Overrides are:

- **Keyed by `slotId`.** Every plotted value carries a stable,
  compiler-issued `slotId`. The static [`manifest.plots`](../spec/manifest.md#plot-slot-descriptors)
  list gives the embedder every slot (id, kind, title) the moment the
  script compiles — before the first candle — so it can render a Style-tab
  row per plot and key its overrides by `slotId`.
- **Presentation-only.** A `PlotOverride` carries
  `{ visible?, color?, lineWidth?, lineStyle? }`. `visible: false` sets
  `PlotEmission.visible = false` (adapters skip render + scale inclusion;
  the slot stays listed); `color` overwrites `PlotEmission.color`;
  `lineWidth` / `lineStyle` merge into the `style` object for the
  line-family kinds (`line`, `step-line`, `horizontal-line`, `area`) and
  are a silent no-op on other kinds. Unlike `inputs` (which feed `compute`
  and are frozen at mount), overrides are applied at emit time.
- **Runtime-applied.** The runtime bakes the override into the drained
  emission, so an adapter just renders `emission.color` / `emission.visible`
  — it needs no override map of its own.
- **Live-updatable.** The host carries an initial map (resolved from
  `Adapter.resolvePlotOverrides`) in its `load` frame and can push live
  updates via `host.setPlotOverrides(...)` — no recompile, no remount. The
  next drain reflects the change. See [Worker host](../hosts/worker.md) and
  [Writing a host](../hosts/writing-a-host.md).

The full walkthrough — slot list → override → live `setPlotOverrides` — is
in [Plot overrides](./plot-overrides.md).

Separately from host overrides, a `PlotEmission` may carry an optional
`xShift` — a signed integer presentation display shift in bars (`+n`
right/future, `−n` left/past) the runtime threads from a plotted offset
`ta.*` series (see [`PlotEmission`](../spec/emissions.md#plotemission)).
It is display-only and never changes `value`; an adapter MAY render the
series displaced by that many bars or ignore it and render at the bar's
own time.

## Silent no-ops, not errors

If a script emits a primitive the adapter does not declare in
`capabilities`, the runtime drops the emission and emits a
diagnostic — it does not throw. The script keeps running; the unsupported
plot, drawing, or alert simply does not reach the chart.

This is capability honesty from the runtime side: a script written
against the full surface degrades gracefully on a minimal adapter. See
[Execution semantics § Capability Fallback](../spec/semantics.md#capability-fallback)
for the per-surface fallback table.

## Cross-links

- Step-by-step tutorial: [Writing an adapter](./writing-an-adapter.md).
- Capability bag: [Capabilities](./capabilities.md).
- Conformance suite: [Conformance](./conformance.md).
- Wire shapes: [Emission payloads](../spec/emissions.md).
