# Task 10 — `examples/canvas2d-adapter`: Reference Adapter Renderer

> **Status: TODO**

## Goal

Ship the ~200-line reference adapter that renders Phase-1
`PlotEmission`s (line + horizontal-line) and `AlertEmission`s to a
`<canvas>` element via the 2D context. It declares the
`Capabilities` Phase-1 scripts exercise, consumes
`@invinite-org/chartlang-adapter-kit` (Task 4) and
`@invinite-org/chartlang-host-worker` (Task 9), and is the
"prove the contract works end-to-end" piece every later phase
extends. Phase 3 adds drawing rendering on top; Phase 4 adds inputs.

## Prerequisites

- Task 4 (adapter-kit: `defineAdapter`, capability builders,
  emission types).
- Task 9 (host-worker: `createWorkerHost`, `ScriptHost`).

## Desired Behavior

After this task:

- A consumer writes:
  ```ts
  import { createCanvas2dAdapter } from "chartlang-example-canvas2d-adapter";
  const adapter = createCanvas2dAdapter({
      canvas: document.querySelector("#chart"),
      candleSource: myCandles,
  });
  ```
- The adapter renders OHLC candles, all `plot` line series, and
  all `hline` horizontal lines onto the canvas.
- Alerts fire visible badges (small dots above/below the candle
  where the alert was emitted) and are also passed to a consumer
  callback.
- Capabilities declared exactly cover the 12 Phase-1 stateful
  primitives: `plots: { "line", "horizontal-line" }`, `alerts:
  { "log", "toast" }`, etc.
- The adapter passes the `validateEmission` boundary check on
  every incoming emission.
- 100% coverage. The DOM canvas API is shimmed via the OffscreenCanvas
  fallback in `node-canvas` (a devDep) or by a hand-rolled
  `MockCanvas` implementing the 2D context subset we use.

## Requirements

### 1. `examples/canvas2d-adapter/src/capabilities.ts`

```ts
import {
    capabilities, type Capabilities,
} from "@invinite-org/chartlang-adapter-kit";

export const CANVAS2D_CAPABILITIES: Capabilities = Object.freeze({
    plots: capabilities.union(
        capabilities.line(),
        capabilities.horizontalLine(),
    ),
    drawings: new Set(),                       // Phase 3
    alerts: capabilities.alerts("log", "toast"),
    alertConditions: false,
    logs: false,
    inputs: new Set(),                         // Phase 4
    intervals: [
        { value: "1D", label: "1 day", group: "daily" },
        { value: "1h", label: "1 hour", group: "intraday" },
        { value: "5m", label: "5 minutes", group: "intraday" },
    ],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),                  // Phase 4
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
});
```

### 2. `examples/canvas2d-adapter/src/index.ts` — main entry (~120 LOC)

```ts
export type CreateCanvas2dAdapterOpts = {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    candleSource: AsyncIterable<CandleEvent>;
    capabilities?: Capabilities;
    interval?: string;       // default "1D"
    palette?: Palette;
    onAlert?: (a: AlertEmission) => void;
};

export function createCanvas2dAdapter(opts: CreateCanvas2dAdapterOpts): Adapter & {
    /** Returns a connected host the consumer can `load` a CompiledScript into. */
    readonly host: ScriptHost;
};
```

Internal flow:

1. Construct the `Adapter` via `defineAdapter`.
2. Build a `ScriptHost` via `createWorkerHost({ capabilities })`.
3. The adapter's `onEmissions` callback is the canvas2d renderer
   loop (see Requirement 3).
4. The adapter's `candles()` method returns `opts.candleSource`
   directly (the consumer is the source of truth).
5. The consumer's code:
   - Calls `adapter.host.load(compiled)`.
   - Iterates `adapter.candles({ interval: opts.interval ?? "1D" })`
     and `await adapter.host.push(event)` for each.
   - Periodically calls `await adapter.host.drain()` and feeds the
     result into `adapter.onEmissions`.

Provide a `runRendererLoop(adapter)` helper that wires the above
into a single async function the consumer can `await` to start
playback.

### 3. `examples/canvas2d-adapter/src/render/` — rendering helpers

Pure functions taking `{ ctx: CanvasRenderingContext2D, ... }`.
No DOM mutation outside `ctx`.

| File | Renders |
|---|---|
| `render/candles.ts` | OHLC candles (body + wick). Uses time → x mapping and price → y mapping helpers. |
| `render/line.ts` | `PlotEmission` whose `style.kind === "line"`. Polyline drawn through `(time, value)` pairs collected across drained emissions. |
| `render/horizontalLine.ts` | `PlotEmission` whose `style.kind === "horizontal-line"`. Full-width horizontal stroke at `value` price. |
| `render/alertBadge.ts` | Small circle marker rendered above/below the bar of the alert, color-coded by `severity`. |
| `render/coords.ts` | `priceToY` / `timeToX` / `yToPrice` mappings. Auto-scale price domain to the visible range; auto-scale time domain to the bar window. |
| `render/clear.ts` | `ctx.clearRect(0, 0, canvas.width, canvas.height)`. |

Renderer loop:

```ts
function renderFrame(adapterState: AdapterState): void {
    const ctx = adapterState.ctx;
    clear(ctx);
    drawCandles(ctx, adapterState.bars, adapterState.viewport);
    for (const [slotId, series] of adapterState.plotSeries) {
        drawLine(ctx, series, adapterState.viewport);
    }
    for (const [slotId, hline] of adapterState.hlines) {
        drawHorizontalLine(ctx, hline, adapterState.viewport);
    }
    for (const alert of adapterState.recentAlerts) {
        drawAlertBadge(ctx, alert, adapterState.viewport, adapterState.palette);
    }
}
```

`adapterState`:

```ts
type AdapterState = {
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    canvas: HTMLCanvasElement | OffscreenCanvas;
    bars: Bar[];                              // accumulated history
    plotSeries: Map<string, Array<{ time: number; value: number | null; color: string | null }>>;
    hlines: Map<string, { price: number; color: string | null; lineWidth: number; lineStyle: LineStyle }>;
    recentAlerts: AlertEmission[];            // last N alerts retained for badge fade
    viewport: Viewport;
    palette: Palette;
};

type Viewport = {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    pxWidth: number; pxHeight: number;
};
```

### 4. Emission ingestion

`onEmissions(emissions)` is the adapter's hot path:

```ts
function onEmissions(state: AdapterState, e: RunnerEmissions): void {
    for (const plot of e.plots) {
        const check = validateEmission(plot);
        if (!check.ok) continue;            // silent drop per §7.4
        if (plot.style.kind === "line" || plot.style.kind === "step-line") {
            const series = state.plotSeries.get(plot.slotId) ?? [];
            series.push({ time: plot.time, value: plot.value, color: plot.color });
            state.plotSeries.set(plot.slotId, series);
        } else if (plot.style.kind === "horizontal-line") {
            state.hlines.set(plot.slotId, {
                price: plot.value ?? 0,
                color: plot.color,
                lineWidth: plot.style.lineWidth,
                lineStyle: plot.style.lineStyle,
            });
        }
    }

    for (const alert of e.alerts) {
        const check = validateEmission(alert);
        if (!check.ok) continue;
        state.recentAlerts.push(alert);
        opts.onAlert?.(alert);
    }

    // Phase-1: diagnostics are surfaced via console.warn for visibility.
    for (const d of e.diagnostics) {
        if (d.severity === "warning" || d.severity === "error") {
            console.warn(`[chartlang ${d.code}]`, d.message);
        }
    }

    renderFrame(state);
}
```

Drawings are ignored — Phase-1 adapter's `capabilities.drawings`
is empty so no drawing emissions should arrive. If one does
(malformed script), the runtime drops it upstream.

### 5. Palette

```ts
// examples/canvas2d-adapter/src/palette.ts
export type Palette = {
    background: string;
    candleBullBody: string;
    candleBearBody: string;
    candleWick: string;
    gridLine: string;
    plotDefault: string;
    alertInfo: string;
    alertWarning: string;
    alertCritical: string;
};

export const DEFAULT_PALETTE: Palette = Object.freeze({
    background: "#0e1218",
    candleBullBody: "#26a69a",
    candleBearBody: "#ef5350",
    candleWick: "#cccccc",
    gridLine: "#2a2f3a",
    plotDefault: "#90caf9",
    alertInfo: "#2196f3",
    alertWarning: "#ff9800",
    alertCritical: "#f44336",
});
```

Ported from `../invinite/src/components/trading-chart/webgl/colors.ts`
(per §3.1 reference list).

### 6. Tests

§16.3 row: unit + golden (visual) + conformance + type.

Canvas testing strategy: ship a hand-rolled `MockCanvas2DContext`
implementing only the methods the adapter calls
(`clearRect`, `beginPath`, `moveTo`, `lineTo`, `stroke`,
`fillRect`, `fill`, `arc`, `closePath`, `set strokeStyle`, `set
fillStyle`, `set lineWidth`, `setLineDash`). Each method appends
a typed record to an internal call log. Tests inspect the log to
assert the renderer's draw sequence.

The mock lives at `src/testing.ts` (NOT `src/__fixtures__/`) so:

- It is **coverage-covered** like the rest of `src/`.
- It is **importable** from sibling packages — Task 12's
  conformance harness imports `MockCanvas2DContext` to build a
  headless adapter in `examples/canvas2d-adapter/src/index.ts`'s
  default export.
- It is **package-public** via an explicit `"./testing"` sub-path
  entry in `examples/canvas2d-adapter/package.json`'s `exports`
  map, so consumers can write
  `import { MockCanvas2DContext } from "chartlang-example-canvas2d-adapter/testing"`.

```ts
// src/testing.ts — public test-helper sub-path.
export class MockCanvas2DContext {
    readonly calls: Array<RecordedCall> = [];
    clearRect(x: number, y: number, w: number, h: number): void {
        this.calls.push({ kind: "clearRect", x, y, w, h });
    }
    // … one method per used op
}

export type RecordedCall =
    | { kind: "clearRect"; x: number; y: number; w: number; h: number }
    | { kind: "moveTo"; x: number; y: number }
    | { kind: "lineTo"; x: number; y: number }
    | { kind: "stroke" }
    | { kind: "set"; prop: "strokeStyle" | "fillStyle" | "lineWidth"; value: string | number }
    /* etc. */;
```

Unit + golden tests:
- `coords.ts`: priceToY / timeToX / inverse round-tripping
  property test.
- `clear.ts`: emits one `clearRect` call covering the canvas.
- `candles.ts`: 10-bar fixture renders to a predictable call
  sequence — pin the hash of the call log as the golden assertion.
- `line.ts`: a 50-point series produces 1 `beginPath`,
  `moveTo`, 49 `lineTo`, 1 `stroke`. NaN points break the line
  (begin new sub-path).
- `horizontalLine.ts`: produces 1 `beginPath`, `moveTo` to
  `(0, y)`, `lineTo` to `(width, y)`, `stroke`.
- `alertBadge.ts`: produces one `arc` per alert.
- `onEmissions`: dispatch coverage — each style.kind branch +
  alert branch + diagnostic branch.
- `createCanvas2dAdapter`: integration test against the worker host
  using a `MessageChannel` shim (Task 9) and the EMA-cross compiled
  bundle (Task 3) — asserts the final canvas call log matches a
  pinned hash.
- Type tests: `expect-type` over `createCanvas2dAdapter`'s return
  type.

Add `node-canvas` is NOT used (heavy native dep). The hand-rolled
mock is sufficient and stays portable. The `examples/canvas2d-
adapter/vitest.config.ts` excludes nothing beyond the §16.1
defaults; `src/render/` lives under `src/` so it counts toward
coverage.

### 7. README

≤100 lines, §17.1 structure:

- Title: "chartlang-example-canvas2d-adapter".
- Stability label: `experimental`.
- Purpose: "Reference adapter — copy from this template when
  writing your own".
- Public surface: `createCanvas2dAdapter`, `Palette`,
  `DEFAULT_PALETTE`, `CANVAS2D_CAPABILITIES`.
- MV API call:
  ```ts
  import { createCanvas2dAdapter } from "chartlang-example-canvas2d-adapter";
  import { compile } from "@invinite-org/chartlang-compiler";

  const adapter = createCanvas2dAdapter({
      canvas: document.querySelector("#chart"),
      candleSource: myCandles,
  });
  const compiled = await compile(scriptSource, { apiVersion: 1 });
  await adapter.host.load(compiled);
  ```
- Docs link: `docs/adapters/reference/canvas2d.md` (Phase-0 stub).
- License: MIT.

### 8. Remove `PACKAGE_VERSION`

Delete the Phase-0 placeholder export + the Task-3 JSDoc shim from
`examples/canvas2d-adapter/src/index.ts`.

### 9. Manual browser smoke test (out-of-CI)

Add `examples/canvas2d-adapter/playground/index.html` plus a tiny
`playground/main.ts` that wires up a `<canvas>`, fetches the
EMA-cross compiled bundle (built by Task 11's CLI run), and
invokes the adapter. Not part of CI — exists so the README's
"open in a browser" verification step has a concrete entry point.
The playground is gitignored from coverage but checked into the
repo. Documentation-style only — no build step in this task.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/capabilities.ts` | Create | Declared capability bag. |
| `examples/canvas2d-adapter/src/palette.ts` | Create | DEFAULT_PALETTE + type. |
| `examples/canvas2d-adapter/src/render/clear.ts` | Create | Frame clear. |
| `examples/canvas2d-adapter/src/render/candles.ts` | Create | OHLC candle render. |
| `examples/canvas2d-adapter/src/render/line.ts` | Create | Plot-line render. |
| `examples/canvas2d-adapter/src/render/horizontalLine.ts` | Create | hline render. |
| `examples/canvas2d-adapter/src/render/alertBadge.ts` | Create | Alert badge render. |
| `examples/canvas2d-adapter/src/render/coords.ts` | Create | priceToY / timeToX. |
| `examples/canvas2d-adapter/src/render/index.ts` | Create | Barrel. |
| `examples/canvas2d-adapter/src/index.ts` | Modify | `createCanvas2dAdapter` + remove placeholder. |
| `examples/canvas2d-adapter/src/testing.ts` | Create | Public `MockCanvas2DContext` (also re-exported by Task 12's headless conformance default). |
| `examples/canvas2d-adapter/src/__fixtures__/sampleBars.ts` | Create | Tiny fixture for unit tests. |
| `examples/canvas2d-adapter/src/render/*.test.ts` | Create | Per-renderer tests. |
| `examples/canvas2d-adapter/src/index.test.ts` | Modify | Integration test driving a compiled script through the worker shim. |
| `examples/canvas2d-adapter/src/types.types.test.ts` | Create | `expect-type` over public types. |
| `examples/canvas2d-adapter/package.json` | Modify | Add workspace deps: adapter-kit, host-worker, compiler. Add a `"./testing"` entry to the `exports` map pointing at `dist/testing.js` + `dist/testing.d.ts` so the mock canvas is reachable from sibling packages (Task 12 imports it). |
| `examples/canvas2d-adapter/README.md` | Modify | Replace placeholder. |
| `examples/canvas2d-adapter/playground/index.html` | Create | Manual smoke-test HTML. |
| `examples/canvas2d-adapter/playground/main.ts` | Create | Playground entry. |

## Acceptance Criteria

- `pnpm -F chartlang-example-canvas2d-adapter typecheck && pnpm
  -F chartlang-example-canvas2d-adapter test` pass with 100%
  coverage on every metric.
- The integration test drives the EMA-cross compiled bundle from
  Task 3 through the worker shim (Task 9) into the canvas2d
  renderer and asserts:
  - The canvas call log contains candles + 1 EMA polyline +
    ≥1 alert badge.
  - The pinned SHA-256 of the call log matches the golden hash.
- `createCanvas2dAdapter`'s output satisfies the
  `Adapter & { host: ScriptHost }` type per `expect-type`.
- Opening `playground/index.html` in a browser (manual step,
  not CI) renders the EMA-cross example end-to-end.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check`,
  `conformance` (still 0 scenarios) all pass.
- All earlier phases' gates remain green.
