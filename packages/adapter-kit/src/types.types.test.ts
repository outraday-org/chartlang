// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertSeverity,
    Bar,
    DrawingKind as CoreDrawingKind,
    DrawingState,
} from "@invinite-org/chartlang-core";
import { expectTypeOf } from "expect-type";
import { describe, expect, it } from "vitest";

import { bucketFor } from ".";
import type { DrawingBucket } from ".";
import type { defineAdapter } from "./defineAdapter.js";
import type { mockCandleSource } from "./mocks/index.js";
import type {
    Adapter,
    AdapterSymInfo,
    AlertChannel,
    AlertConditionEmission,
    AlertEmission,
    CandleEvent,
    Capabilities,
    DiagnosticCode,
    DrawingEmission,
    DrawingKind,
    LogEmission,
    PlotEmission,
    PlotKind,
    PlotStyle,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "./types.js";

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

    it("PlotEmission.xShift is an optional number", () => {
        expectTypeOf<PlotEmission["xShift"]>().toEqualTypeOf<number | undefined>();
    });

    it("PlotStyle is keyed by adapter PlotKind", () => {
        expectTypeOf<PlotStyle["kind"]>().toEqualTypeOf<PlotKind>();
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
        expectTypeOf<RunnerEmissions["alertConditions"]>().toEqualTypeOf<
            ReadonlyArray<AlertConditionEmission>
        >();
        expectTypeOf<RunnerEmissions["logs"]>().toEqualTypeOf<ReadonlyArray<LogEmission>>();
        expectTypeOf<RunnerEmissions["diagnostics"]>().toEqualTypeOf<
            ReadonlyArray<RuntimeDiagnostic>
        >();
    });

    it("DiagnosticCode contains every Phase-1 + Phase-7 code", () => {
        type ExpectedCodes =
            | "unsupported-plot-kind"
            | "unsupported-drawing-kind"
            | "unsupported-alert-channel"
            | "unsupported-pane"
            | "unsupported-interval"
            | "multi-timeframe-not-supported"
            | "unknown-secondary-stream"
            | "lookback-exceeded"
            | "drawing-budget-exceeded"
            | "dropped-by-policy"
            | "input-coercion-failed"
            | "alert-conditions-not-supported"
            | "unknown-alert-condition"
            | "alert-rate-limited"
            | "runtime-cpu-budget-exceeded"
            | "runtime-memory-budget-exceeded"
            | "runtime-log-budget-exceeded"
            | "malformed-log-meta"
            | "runtime-error-thrown"
            | "session-info-missing"
            | "fixed-range-inverted"
            | "state-snapshot-restored"
            | "state-snapshot-future-dated"
            | "state-snapshot-malformed"
            | "state-snapshot-save-failed"
            | "malformed-emission"
            | "dep-error"
            | "dep-cycle"
            | "dep-unknown-output"
            | "dep-invalid-input-override"
            | "dep-dynamic"
            | "dep-output-not-titled";
        expectTypeOf<DiagnosticCode>().toEqualTypeOf<ExpectedCodes>();
    });

    it("defineAdapter returns Adapter", () => {
        expectTypeOf<ReturnType<typeof defineAdapter>>().toEqualTypeOf<Adapter>();
    });

    it("Adapter exposes optional sym-info metadata", () => {
        expectTypeOf<Adapter["symInfo"]>().toEqualTypeOf<AdapterSymInfo | undefined>();
    });

    it("Adapter exposes an optional input override resolver", () => {
        expectTypeOf<Adapter["resolveInputs"]>().toEqualTypeOf<
            ((scriptId: string) => Readonly<Record<string, unknown>>) | undefined
        >();
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

    it("CandleEvent variants accept an optional secondary stream key", () => {
        expectTypeOf<Extract<CandleEvent, { kind: "history" }>["streamKey"]>().toEqualTypeOf<
            string | undefined
        >();
        expectTypeOf<Extract<CandleEvent, { kind: "close" }>["streamKey"]>().toEqualTypeOf<
            string | undefined
        >();
        expectTypeOf<Extract<CandleEvent, { kind: "tick" }>["streamKey"]>().toEqualTypeOf<
            string | undefined
        >();
    });

    it("DrawingKind matches the core 61-entry union", () => {
        expectTypeOf<DrawingKind>().toEqualTypeOf<CoreDrawingKind>();
    });

    it("DrawingEmission.state is DrawingState (no longer unknown)", () => {
        expectTypeOf<DrawingEmission["state"]>().toEqualTypeOf<DrawingState>();
    });

    it("DrawingBucket is the 5-bucket string union", () => {
        expectTypeOf<DrawingBucket>().toEqualTypeOf<
            "lines" | "labels" | "boxes" | "polylines" | "other"
        >();
    });

    it("bucketFor is re-exported as a runtime function from the barrel", () => {
        expect(typeof bucketFor).toBe("function");
        expect(bucketFor("line")).toBe("lines");
        expect(bucketFor("rectangle")).toBe("boxes");
        expect(bucketFor("fib-retracement")).toBe("other");
    });
});
