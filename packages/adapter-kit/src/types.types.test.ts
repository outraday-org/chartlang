// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertSeverity,
    Bar,
    DrawingKind as CoreDrawingKind,
    DrawingState,
    InputDescriptor,
} from "@invinite-org/chartlang-core";
import { expectTypeOf } from "expect-type";
import { describe, expect, it } from "vitest";

import { bucketFor } from ".";
import type {
    DrawingBucket,
    GroupedInputEntry,
    GroupedInputRow,
    GroupedInputSection,
} from ".";
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

    it("PlotEmission.colorValue is an optional Color | null", () => {
        expectTypeOf<PlotEmission["colorValue"]>().toEqualTypeOf<string | null | undefined>();
    });

    it("PlotEmission omitting colorValue still satisfies the type (byte-identity)", () => {
        // A no-dynamic-color emission carries no `colorValue` key — byte-
        // identical to the pre-feature wire, so existing plot-hashes hold.
        const e: PlotEmission = {
            kind: "plot",
            slotId: "x.ts:1:1#0",
            title: "X",
            style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
            bar: 0,
            time: 0,
            value: null,
            color: null,
            meta: {},
            pane: "overlay",
        };
        expect(Object.hasOwn(e, "colorValue")).toBe(false);
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
            | "multi-symbol-not-supported"
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

    it("CandleEvent accepts a composite feed-key streamKey", () => {
        // The composite `"<symbol>@<interval>"` key built by feedKey is a
        // plain string, so the wire type accepts it unchanged.
        const bar: Bar = {
            time: 0,
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            volume: 0,
            symbol: "AMEX:SPY",
            interval: "1D",
        };
        const evt: CandleEvent = { kind: "close", bar, streamKey: "AMEX:SPY@1D" };
        expect(evt.streamKey).toBe("AMEX:SPY@1D");
    });

    it("Capabilities.multiSymbol is a required boolean independent of multiTimeframe", () => {
        expectTypeOf<Capabilities["multiSymbol"]>().toEqualTypeOf<boolean>();
        // A Capabilities object missing multiSymbol is a type error — proven by
        // omitting it from this `@ts-expect-error`ed literal.
        // @ts-expect-error multiSymbol is required
        const missing: Capabilities = {
            plots: new Set<PlotKind>(),
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
            maxTickHz: 0,
        };
        void missing;
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

    it("GroupedInputEntry carries a name and a core InputDescriptor", () => {
        expectTypeOf<GroupedInputEntry["name"]>().toEqualTypeOf<string>();
        expectTypeOf<GroupedInputEntry["descriptor"]>().toEqualTypeOf<InputDescriptor<unknown>>();
    });

    it("GroupedInputRow is a readonly array of entries", () => {
        expectTypeOf<GroupedInputRow>().toEqualTypeOf<readonly GroupedInputEntry[]>();
    });

    it("GroupedInputSection has a nullable title and readonly rows", () => {
        expectTypeOf<GroupedInputSection["title"]>().toEqualTypeOf<string | null>();
        expectTypeOf<GroupedInputSection["rows"]>().toEqualTypeOf<readonly GroupedInputRow[]>();
    });

    it("bucketFor is re-exported as a runtime function from the barrel", () => {
        expect(typeof bucketFor).toBe("function");
        expect(bucketFor("line")).toBe("lines");
        expect(bucketFor("rectangle")).toBe("boxes");
        expect(bucketFor("fib-retracement")).toBe("other");
    });
});
