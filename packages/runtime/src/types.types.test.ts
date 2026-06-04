// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertEmission,
    Capabilities,
    DrawingEmission,
    PlotEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar, CompiledScriptObject, Series } from "@invinite-org/chartlang-core";
import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type {
    CreateScriptRunnerArgs,
    ScriptRunner,
    createScriptRunner,
} from "./createScriptRunner";
import type { Float64RingBuffer, RingBuffer, RingBufferLike } from "./ringBuffer";
import type {
    ACTIVE_RUNTIME_CONTEXT,
    MutableRunnerEmissions,
    RuntimeContext,
} from "./runtimeContext";
import type { makeSeriesView } from "./seriesView";
import type { StateStore, inMemoryStateStore } from "./stateStore";
import type { BarView, OhlcvBuffers, StreamState, createStreamState } from "./streamState";

describe("type assertions", () => {
    it("RingBufferLike<T> declares the §6.6 surface", () => {
        expectTypeOf<RingBufferLike<number>["append"]>().toEqualTypeOf<(v: number) => void>();
        expectTypeOf<RingBufferLike<number>["at"]>().toEqualTypeOf<
            (n: number) => number | undefined
        >();
        expectTypeOf<RingBufferLike<number>["capacity"]>().toEqualTypeOf<number>();
        expectTypeOf<RingBufferLike<number>["length"]>().toEqualTypeOf<number>();
    });

    it("RingBuffer<T>.at narrows to T | undefined", () => {
        expectTypeOf<RingBuffer<string>["at"]>().toEqualTypeOf<(n: number) => string | undefined>();
    });

    it("Float64RingBuffer.at narrows to plain number (NaN OOR)", () => {
        expectTypeOf<Float64RingBuffer["at"]>().toEqualTypeOf<(n: number) => number>();
    });

    it("makeSeriesView returns Series<T>", () => {
        expectTypeOf<ReturnType<typeof makeSeriesView<number>>>().toEqualTypeOf<Series<number>>();
        expectTypeOf<ReturnType<typeof makeSeriesView<{ x: number }>>>().toEqualTypeOf<
            Series<{ x: number }>
        >();
    });

    it("StreamState exposes 10 cached Series<number> views", () => {
        expectTypeOf<StreamState["seriesViews"]["close"]>().toEqualTypeOf<Series<number>>();
        expectTypeOf<StreamState["seriesViews"]["hlcc4"]>().toEqualTypeOf<Series<number>>();
        expectTypeOf<StreamState["taSlots"]>().toEqualTypeOf<Map<string, unknown>>();
    });

    it("OhlcvBuffers carries readonly Float64RingBuffer fields", () => {
        expectTypeOf<OhlcvBuffers["close"]>().toEqualTypeOf<Float64RingBuffer>();
        expectTypeOf<OhlcvBuffers["hl2"]>().toEqualTypeOf<Float64RingBuffer>();
    });

    it("BarView fields are mutable scalars", () => {
        expectTypeOf<BarView["close"]>().toEqualTypeOf<number>();
        expectTypeOf<BarView["symbol"]>().toEqualTypeOf<string>();
        expectTypeOf<BarView["interval"]>().toEqualTypeOf<string>();
    });

    it("createStreamState returns StreamState", () => {
        expectTypeOf<ReturnType<typeof createStreamState>>().toEqualTypeOf<StreamState>();
    });

    it("StateStore declares get/set/has/clear", () => {
        expectTypeOf<StateStore["get"]>().toEqualTypeOf<<T>(slotId: string) => T | undefined>();
        expectTypeOf<StateStore["set"]>().toEqualTypeOf<<T>(slotId: string, value: T) => void>();
        expectTypeOf<StateStore["has"]>().toEqualTypeOf<(slotId: string) => boolean>();
        expectTypeOf<StateStore["clear"]>().toEqualTypeOf<() => void>();
    });

    it("inMemoryStateStore returns StateStore", () => {
        expectTypeOf<ReturnType<typeof inMemoryStateStore>>().toEqualTypeOf<StateStore>();
    });

    it("MutableRunnerEmissions arrays are writable", () => {
        expectTypeOf<MutableRunnerEmissions["plots"]>().toEqualTypeOf<PlotEmission[]>();
        expectTypeOf<MutableRunnerEmissions["drawings"]>().toEqualTypeOf<DrawingEmission[]>();
        expectTypeOf<MutableRunnerEmissions["alerts"]>().toEqualTypeOf<AlertEmission[]>();
        expectTypeOf<MutableRunnerEmissions["diagnostics"]>().toEqualTypeOf<RuntimeDiagnostic[]>();
        expectTypeOf<MutableRunnerEmissions["fromBar"]>().toEqualTypeOf<number>();
        expectTypeOf<MutableRunnerEmissions["toBar"]>().toEqualTypeOf<number>();
    });

    it("RuntimeContext exposes runtime handles + isTick discriminator", () => {
        expectTypeOf<RuntimeContext["stream"]>().toEqualTypeOf<StreamState>();
        expectTypeOf<RuntimeContext["stateStore"]>().toEqualTypeOf<StateStore>();
        expectTypeOf<RuntimeContext["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<RuntimeContext["emissions"]>().toEqualTypeOf<MutableRunnerEmissions>();
        expectTypeOf<RuntimeContext["barIndex"]>().toEqualTypeOf<() => number>();
        expectTypeOf<RuntimeContext["isTick"]>().toEqualTypeOf<boolean>();
    });

    it("ACTIVE_RUNTIME_CONTEXT is a mutable singleton slot", () => {
        expectTypeOf<typeof ACTIVE_RUNTIME_CONTEXT>().toEqualTypeOf<{
            current: RuntimeContext | null;
        }>();
    });

    it("ScriptRunner declares the §6.1 lifecycle surface", () => {
        expectTypeOf<ScriptRunner["onHistory"]>().toEqualTypeOf<
            (bars: ReadonlyArray<Bar>) => Promise<void>
        >();
        expectTypeOf<ScriptRunner["onBarClose"]>().toEqualTypeOf<(bar: Bar) => Promise<void>>();
        expectTypeOf<ScriptRunner["onBarTick"]>().toEqualTypeOf<(bar: Bar) => Promise<void>>();
        expectTypeOf<ScriptRunner["drain"]>().toEqualTypeOf<() => RunnerEmissions>();
        expectTypeOf<ScriptRunner["dispose"]>().toEqualTypeOf<() => void>();
    });

    it("CreateScriptRunnerArgs requires compiled + capabilities; stateStore is optional", () => {
        expectTypeOf<CreateScriptRunnerArgs["compiled"]>().toEqualTypeOf<CompiledScriptObject>();
        expectTypeOf<CreateScriptRunnerArgs["capabilities"]>().toEqualTypeOf<Capabilities>();
        expectTypeOf<CreateScriptRunnerArgs["stateStore"]>().toEqualTypeOf<
            StateStore | undefined
        >();
    });

    it("createScriptRunner returns ScriptRunner", () => {
        expectTypeOf<ReturnType<typeof createScriptRunner>>().toEqualTypeOf<ScriptRunner>();
    });
});
