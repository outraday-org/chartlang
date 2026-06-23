// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";

// The three script colours the `sma-offset` sample emits, in declaration
// order: an unshifted SMA(20), a `+5` copy displaced right, a `−5` copy
// displaced left. Matched byte-for-byte to canvas2d's `sma-offset` fixture
// (`examples/canvas2d-adapter/src/integration.test.ts`).
export const UNSHIFTED_COLOR = "#26a69a";
export const SHIFT_RIGHT_COLOR = "#ef5350";
export const SHIFT_LEFT_COLOR = "#42a5f5";

/** Signed display shift each coloured series carries. */
export const SHIFT_BARS = 5;

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

// A candle-feed input bar is a PLAIN, structured-cloneable data object — it
// crosses the worker `MessageChannel` via `postMessage`, which cannot clone a
// method, so it deliberately carries no `Bar.point` (the runtime installs its
// own offset-resolving `bar.point` on the compute context, never reading one
// off the wire bar). This is the exact shape every adapter's
// `integration.test.ts` feeds; the `Bar` annotation documents intent at the
// fixture boundary without smuggling an un-cloneable method onto the wire.
type WireBar = Omit<Bar, "point">;

function makeBar(i: number, close: number): WireBar {
    const open = close - 0.5;
    const high = close + 1;
    const low = close - 1;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i,
        symbol: "OFFSET-X",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

// A fixed, deterministic 60-bar trending history. 60 bars warms the SMA(20)
// with wide margin and gives every interior bar room for a ±5 display shift
// to land on a real (non-clipped) column. A monotonic ramp keeps the three
// SMA copies finite and the geometry easy to reason about.
//
// Typed as `Bar` at the boundary (what `mockCandleSource` accepts) even though
// each value is a method-less `WireBar`: the runtime resolves `bar.point` from
// the compute context, never from the wire bar (see `WireBar` above), so the
// missing method is never invoked. This widening is the same one every
// adapter's `integration.test.ts` relies on implicitly.
const WIRE_BARS: ReadonlyArray<WireBar> = Array.from({ length: 60 }, (_, i) => makeBar(i, 100 + i));
export const OFFSET_BARS: ReadonlyArray<Bar> = WIRE_BARS as ReadonlyArray<Bar>;

export const OFFSET_MANIFEST: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "SMA offset (cross-adapter guardrail)",
    inputs: {},
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: { ohlcv: 64 },
    maxLookback: 20,
};

// A hand-crafted compiled-bundle source equivalent to the `sma-offset`
// example: three line plots of the SAME underlying SMA(20) — one unshifted,
// one `offset: +5` (drawn right/future), one `offset: −5` (drawn left/past).
// Calls the runtime's slot-aware `ctx.ta.sma` / `ctx.plot` directly so the
// bundle has NO static imports — the worker `data:` URL import path cannot
// resolve workspace specifiers, so (like every adapter's integration test)
// the compute is inlined rather than produced by `compileFile`.
export const OFFSET_MODULE_SOURCE = `
export default {
    manifest: ${JSON.stringify(OFFSET_MANIFEST)},
    compute: (ctx) => {
        const sma = ctx.ta.sma("sma-offset.chart.ts:10:21#0", ctx.bar.close, 20);
        ctx.plot("sma-offset.chart.ts:11:9#0", sma, { color: "${UNSHIFTED_COLOR}", title: "SMA(20)" });
        ctx.plot(
            "sma-offset.chart.ts:18:14#0",
            ctx.ta.sma("sma-offset.chart.ts:18:19#0", ctx.bar.close, 20, { offset: ${SHIFT_BARS} }),
            { color: "${SHIFT_RIGHT_COLOR}", title: "SMA(20) +5" },
        );
        ctx.plot(
            "sma-offset.chart.ts:19:14#0",
            ctx.ta.sma("sma-offset.chart.ts:19:19#0", ctx.bar.close, 20, { offset: -${SHIFT_BARS} }),
            { color: "${SHIFT_LEFT_COLOR}", title: "SMA(20) −5" },
        );
    },
};
`;

/** The three colours, in declaration order, for adapters whose mock does not
 * record the per-series colour (lightweight-charts) and must key by ordinal. */
export const COLORS_IN_ORDER = [UNSHIFTED_COLOR, SHIFT_RIGHT_COLOR, SHIFT_LEFT_COLOR] as const;
