# Plot overrides

A **plot override** lets an embedder recolor or show/hide an individual
plot of a running script **without editing the script source** — the
TradingView "Style tab" model. The only way a plot otherwise gets its
color / width / line style is the author's literal `plot(value, { color,
... })` call (or an author-wired `input.color`); plot overrides add a
host-side channel on top, keyed by the compiler-issued `slotId`.

Overrides are **presentation-only** (visibility / color / line cosmetics),
applied by the runtime at emit time, and **live-updatable** without a
recompile or remount. They are the counterpart to
[inputs](../language/inputs.md): inputs feed `compute` and are frozen at
mount; overrides never touch `compute`.

## The flow

### 1. Read the slot list from the manifest

The compiler emits a static
[`manifest.plots`](../spec/manifest.md#plot-slot-descriptors) — one
descriptor per `plot()` / `hline()` callsite — so you can build a Style-tab
row per plot **before the first candle**:

```ts
import type { ScriptManifest } from "@invinite-org/chartlang-core";

declare const manifest: ScriptManifest;

for (const slot of manifest.plots ?? []) {
    // slot.slotId  — stable id to key your override row
    // slot.kind    — e.g. "line", "horizontal-line", "histogram"
    // slot.title   — present only when the callsite had a literal title
    void slot;
}
```

### 2. Resolve overrides at mount

A `PlotOverride` is `{ visible?, color?, lineWidth?, lineStyle? }`. Supply
the initial map through `Adapter.resolvePlotOverrides` (mirrors
`resolveInputs`). The host carries the resolved record in its `load` frame:

```ts
import { defineAdapter } from "@invinite-org/chartlang-adapter-kit";
import type { Adapter, PlotOverride } from "@invinite-org/chartlang-adapter-kit";

const overrides: Readonly<Record<string, PlotOverride>> = {
    "my-script.chart.ts:7:9#0": { visible: false },
    "my-script.chart.ts:8:9#0": { color: "#ff0000", lineWidth: 3 },
};

declare const base: Omit<Adapter, "resolvePlotOverrides">;
const adapter: Adapter = defineAdapter({
    ...base,
    resolvePlotOverrides: () => overrides,
});
void adapter;
```

The runtime bakes each override into the drained emission: `visible: false`
sets `PlotEmission.visible = false` (your adapter skips render + scale
inclusion, keeping the slot listed); `color` overwrites
`PlotEmission.color`; `lineWidth` / `lineStyle` merge into the `style`
object for the line-family kinds (`line`, `step-line`, `horizontal-line`,
`area`) and are a silent no-op on other kinds.

### 3. Update live with `setPlotOverrides`

When the user toggles a Style-tab row, push the new full map through the
host — no recompile, no remount. The next `drain()` reflects it:

```ts
import type { PlotOverride } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptHost } from "@invinite-org/chartlang-host-worker";

declare const host: ScriptHost;
const next: Readonly<Record<string, PlotOverride>> = {
    "my-script.chart.ts:8:9#0": { color: "#00aa00", lineWidth: 2 },
};
host.setPlotOverrides(next);
```

`setPlotOverrides` **replaces** the whole override map (it does not merge),
so send the complete desired state each time. Because overrides are
applied at emit time and never reach `compute`, changing them mid-run is
safe and does not break the frozen-input determinism guarantee.

## Why `slotId`, not title or input id

`slotId` is the compiler-issued, stable, unique callsite id already on
every emission. Titles are optional and non-unique; input ids only exist
for author-wired inputs. `slotId` is the one identifier that always exists
for every plotted value — so it is the override key for both the static
slot list and the runtime emission.

## Cross-links

- The `Adapter` field + model: [Adapter contract § Plot overrides](./contract.md#plot-overrides).
- The static slot list: [Script manifest § Plot Slot Descriptors](../spec/manifest.md#plot-slot-descriptors).
- The `visible` wire field: [Emission payloads § PlotEmission](../spec/emissions.md#plotemission).
- Host plumbing: [Worker host](../hosts/worker.md), [Writing a host](../hosts/writing-a-host.md).
- The frozen-input counterpart: [Inputs](../language/inputs.md).
