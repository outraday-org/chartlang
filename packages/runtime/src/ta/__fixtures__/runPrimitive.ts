// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, MutableRunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../../runtimeContext";
import { inMemoryStateStore } from "../../stateStore";
import { createStreamState } from "../../streamState";

const TEST_CAPABILITIES: Capabilities = {
    plots: capabilities.allLines(),
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
    maxLookback: 0,
    maxTickHz: 10,
};

/**
 * Lightweight harness for unit-testing a single `ta.*` primitive without
 * involving the full `createScriptRunner` lifecycle. Constructs a minimal
 * `RuntimeContext`, drives a list of bars through `step(bar)` (defaults to
 * close-side advances), and returns whatever the step closure produced
 * each bar.
 */
export function harness<T>(
    bars: ReadonlyArray<Bar>,
    capacity: number,
    step: (bar: Bar, ctx: RuntimeContext) => T,
): T[] {
    const stream = createStreamState({ interval: "1m", capacity, symbol: "TEST" });
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    let barIdx = 0;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: TEST_CAPABILITIES,
        emissions,
        barIndex: () => barIdx,
        isTick: false,
    };
    const out: T[] = [];
    ACTIVE_RUNTIME_CONTEXT.current = ctx;
    try {
        for (const bar of bars) {
            const hl2 = (bar.high + bar.low) / 2;
            const hlc3 = (bar.high + bar.low + bar.close) / 3;
            const ohlc4 = (bar.open + bar.high + bar.low + bar.close) / 4;
            const hlcc4 = (bar.high + bar.low + bar.close + bar.close) / 4;
            stream.ohlcv.time.append(bar.time);
            stream.ohlcv.open.append(bar.open);
            stream.ohlcv.high.append(bar.high);
            stream.ohlcv.low.append(bar.low);
            stream.ohlcv.close.append(bar.close);
            stream.ohlcv.volume.append(bar.volume);
            stream.ohlcv.hl2.append(hl2);
            stream.ohlcv.hlc3.append(hlc3);
            stream.ohlcv.ohlc4.append(ohlc4);
            stream.ohlcv.hlcc4.append(hlcc4);
            stream.bar.time = bar.time;
            stream.bar.open = bar.open;
            stream.bar.high = bar.high;
            stream.bar.low = bar.low;
            stream.bar.close = bar.close;
            stream.bar.volume = bar.volume;
            stream.bar.hl2 = hl2;
            stream.bar.hlc3 = hlc3;
            stream.bar.ohlc4 = ohlc4;
            stream.bar.hlcc4 = hlcc4;
            ctx.isTick = false;
            out.push(step(bar, ctx));
            barIdx += 1;
        }
    } finally {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
    return out;
}

/**
 * Drive a single tick onto the most recent bar without advancing the
 * stream length. Mirrors `onBarTick`'s mutation set (no `time` / `open`).
 */
export function tick<T>(ctxRef: { ctx: RuntimeContext }, tickBar: Bar, step: () => T): T {
    const { ctx } = ctxRef;
    const stream = ctx.stream;
    const hl2 = (tickBar.high + tickBar.low) / 2;
    const hlc3 = (tickBar.high + tickBar.low + tickBar.close) / 3;
    const ohlc4 = (tickBar.open + tickBar.high + tickBar.low + tickBar.close) / 4;
    const hlcc4 = (tickBar.high + tickBar.low + tickBar.close + tickBar.close) / 4;
    stream.ohlcv.close.replaceHead(tickBar.close);
    stream.ohlcv.high.replaceHead(tickBar.high);
    stream.ohlcv.low.replaceHead(tickBar.low);
    stream.ohlcv.volume.replaceHead(tickBar.volume);
    stream.ohlcv.hl2.replaceHead(hl2);
    stream.ohlcv.hlc3.replaceHead(hlc3);
    stream.ohlcv.ohlc4.replaceHead(ohlc4);
    stream.ohlcv.hlcc4.replaceHead(hlcc4);
    stream.bar.close = tickBar.close;
    stream.bar.high = tickBar.high;
    stream.bar.low = tickBar.low;
    stream.bar.volume = tickBar.volume;
    stream.bar.hl2 = hl2;
    stream.bar.hlc3 = hlc3;
    stream.bar.ohlc4 = ohlc4;
    stream.bar.hlcc4 = hlcc4;
    ACTIVE_RUNTIME_CONTEXT.current = ctx;
    ctx.isTick = true;
    try {
        return step();
    } finally {
        ctx.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
}

/**
 * Variant of `harness` that exposes the live `RuntimeContext` so callers
 * can drive subsequent ticks via `tick()`. The active context slot is
 * cleared after the loop; `tick()` re-installs it for the call window.
 */
export function harnessWithCtx<T>(
    bars: ReadonlyArray<Bar>,
    capacity: number,
    step: (bar: Bar, ctx: RuntimeContext) => T,
): { results: T[]; ctxRef: { ctx: RuntimeContext } } {
    const stream = createStreamState({ interval: "1m", capacity, symbol: "TEST" });
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    let barIdx = 0;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: TEST_CAPABILITIES,
        emissions,
        barIndex: () => barIdx,
        isTick: false,
    };
    const out: T[] = [];
    ACTIVE_RUNTIME_CONTEXT.current = ctx;
    try {
        for (const bar of bars) {
            const hl2 = (bar.high + bar.low) / 2;
            const hlc3 = (bar.high + bar.low + bar.close) / 3;
            const ohlc4 = (bar.open + bar.high + bar.low + bar.close) / 4;
            const hlcc4 = (bar.high + bar.low + bar.close + bar.close) / 4;
            stream.ohlcv.time.append(bar.time);
            stream.ohlcv.open.append(bar.open);
            stream.ohlcv.high.append(bar.high);
            stream.ohlcv.low.append(bar.low);
            stream.ohlcv.close.append(bar.close);
            stream.ohlcv.volume.append(bar.volume);
            stream.ohlcv.hl2.append(hl2);
            stream.ohlcv.hlc3.append(hlc3);
            stream.ohlcv.ohlc4.append(ohlc4);
            stream.ohlcv.hlcc4.append(hlcc4);
            stream.bar.time = bar.time;
            stream.bar.open = bar.open;
            stream.bar.high = bar.high;
            stream.bar.low = bar.low;
            stream.bar.close = bar.close;
            stream.bar.volume = bar.volume;
            stream.bar.hl2 = hl2;
            stream.bar.hlc3 = hlc3;
            stream.bar.ohlc4 = ohlc4;
            stream.bar.hlcc4 = hlcc4;
            ctx.isTick = false;
            out.push(step(bar, ctx));
            barIdx += 1;
        }
    } finally {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
    return { results: out, ctxRef: { ctx } };
}
