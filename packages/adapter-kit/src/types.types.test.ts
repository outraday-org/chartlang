// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertSeverity, Bar } from "@invinite-org/chartlang-core";
import { describe, it } from "vitest";
import { expectTypeOf } from "expect-type";

import type { defineAdapter } from "./defineAdapter";
import type { mockCandleSource } from "./mocks";
import type {
    Adapter,
    AlertChannel,
    AlertEmission,
    Capabilities,
    CandleEvent,
    DiagnosticCode,
    DrawingEmission,
    PlotEmission,
    PlotKind,
    PlotStyle,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "./types";

describe("type assertions", () => {
    it("Adapter.candles returns AsyncIterable<CandleEvent>", () => {
        expectTypeOf<ReturnType<Adapter["candles"]>>().toEqualTypeOf<AsyncIterable<CandleEvent>>();
    });

    it("Capabilities.plots is ReadonlySet<PlotKind>", () => {
        expectTypeOf<Capabilities["plots"]>().toEqualTypeOf<ReadonlySet<PlotKind>>();
    });

    it("PlotEmission.value is number | null", () => {
        expectTypeOf<PlotEmission["value"]>().toEqualTypeOf<number | null>();
    });

    it("PlotEmission.color is string | null", () => {
        expectTypeOf<PlotEmission["color"]>().toEqualTypeOf<string | null>();
    });

    it("PlotStyle is a discriminated union of three line variants", () => {
        expectTypeOf<PlotStyle["kind"]>().toEqualTypeOf<"line" | "step-line" | "horizontal-line">();
    });

    it("AlertEmission.severity is AlertSeverity", () => {
        expectTypeOf<AlertEmission["severity"]>().toEqualTypeOf<AlertSeverity>();
    });

    it("AlertEmission.channels is ReadonlyArray<AlertChannel>", () => {
        expectTypeOf<AlertEmission["channels"]>().toEqualTypeOf<ReadonlyArray<AlertChannel>>();
    });

    it("RunnerEmissions arrays are readonly", () => {
        expectTypeOf<RunnerEmissions["plots"]>().toEqualTypeOf<ReadonlyArray<PlotEmission>>();
        expectTypeOf<RunnerEmissions["drawings"]>().toEqualTypeOf<ReadonlyArray<DrawingEmission>>();
        expectTypeOf<RunnerEmissions["alerts"]>().toEqualTypeOf<ReadonlyArray<AlertEmission>>();
        expectTypeOf<RunnerEmissions["diagnostics"]>().toEqualTypeOf<
            ReadonlyArray<RuntimeDiagnostic>
        >();
    });

    it("DiagnosticCode contains every Phase-1 code", () => {
        type ExpectedCodes =
            | "unsupported-plot-kind"
            | "unsupported-drawing-kind"
            | "unsupported-alert-channel"
            | "unsupported-pane"
            | "unsupported-interval"
            | "multi-timeframe-not-supported"
            | "lookback-exceeded"
            | "drawing-budget-exceeded"
            | "dropped-by-policy"
            | "input-coercion-failed"
            | "alert-rate-limited"
            | "runtime-cpu-budget-exceeded"
            | "runtime-memory-budget-exceeded"
            | "malformed-emission";
        expectTypeOf<DiagnosticCode>().toEqualTypeOf<ExpectedCodes>();
    });

    it("defineAdapter returns Adapter", () => {
        expectTypeOf<ReturnType<typeof defineAdapter>>().toEqualTypeOf<Adapter>();
    });

    it("mockCandleSource returns AsyncIterable<CandleEvent>", () => {
        expectTypeOf<ReturnType<typeof mockCandleSource>>().toEqualTypeOf<
            AsyncIterable<CandleEvent>
        >();
    });

    it("CandleEvent.history carries ReadonlyArray<Bar>", () => {
        expectTypeOf<Extract<CandleEvent, { kind: "history" }>["bars"]>().toEqualTypeOf<
            ReadonlyArray<Bar>
        >();
    });
});
