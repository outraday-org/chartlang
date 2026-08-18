// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { HOVER_REGISTRY } from "./hoverRegistry.generated.js";

describe("HOVER_REGISTRY", () => {
    it("contains the apiVersion 1 language-service symbol set", () => {
        expect(Object.keys(HOVER_REGISTRY)).toHaveLength(609);
    });

    it("contains the order.* namespace, its four members, and its four types (1.12)", () => {
        // Nine entries, not five: the generator emits the frozen namespace plus
        // one entry per member AND one per exported type, so a `+4 members`
        // count bump would have been wrong by the four `Order*` type aliases.
        expect(HOVER_REGISTRY.order).toMatchObject({
            fqn: "order",
            kind: "namespace",
            since: "1.12",
        });
        for (const member of ["buy", "sell", "close", "position"]) {
            expect(HOVER_REGISTRY[`order.${member}`]).toMatchObject({
                fqn: `order.${member}`,
                kind: "function",
                since: "1.12",
                stability: "stable",
            });
        }
        // The three emitters take an `OrderOpts` parameter; `order.position()`
        // takes none, so it carries no `paramTable` at all.
        expect(HOVER_REGISTRY["order.buy"].paramTable).toEqual([
            { name: "_opts", type: "OrderOpts", doc: "" },
        ]);
        expect(HOVER_REGISTRY["order.position"].paramTable).toBeUndefined();
        for (const type of ["OrderAction", "OrderOpts", "OrderPosition", "OrderNamespace"]) {
            expect(HOVER_REGISTRY[type]).toMatchObject({ fqn: type, kind: "type" });
        }
    });

    it("contains the session-calendar entries (1.11)", () => {
        expect(HOVER_REGISTRY.createSessionCalendar).toMatchObject({
            fqn: "createSessionCalendar",
            kind: "function",
            since: "1.11",
        });
        expect(HOVER_REGISTRY.SessionCalendar).toMatchObject({
            fqn: "SessionCalendar",
            kind: "type",
            since: "1.11",
        });
        expect(HOVER_REGISTRY.SessionCalendarDay).toMatchObject({
            fqn: "SessionCalendarDay",
            kind: "type",
            since: "1.11",
        });
    });

    it("contains the state-store key + snapshot-error helper entries (1.11)", () => {
        expect(HOVER_REGISTRY.stateStoreKeyId).toMatchObject({
            fqn: "stateStoreKeyId",
            kind: "function",
            since: "1.11",
        });
        expect(HOVER_REGISTRY.stateStoreKeysEqual).toMatchObject({
            fqn: "stateStoreKeysEqual",
            kind: "function",
            since: "1.11",
        });
        expect(HOVER_REGISTRY.isSnapshotError).toMatchObject({
            fqn: "isSnapshotError",
            kind: "function",
            since: "1.11",
        });
    });

    it("contains external-series feed entries (1.9)", () => {
        expect(HOVER_REGISTRY.ExternalSeriesFeed).toMatchObject({
            fqn: "ExternalSeriesFeed",
            kind: "type",
            since: "1.9",
        });
        expect(HOVER_REGISTRY.ExternalSeriesFeedMap).toMatchObject({
            fqn: "ExternalSeriesFeedMap",
            kind: "type",
            since: "1.9",
        });
        expect(HOVER_REGISTRY["input.externalSeries"]).toMatchObject({
            fqn: "input.externalSeries",
            kind: "function",
            since: "0.4",
        });
    });

    it("contains the deterministic str formatter helper entries (1.4)", () => {
        expect(HOVER_REGISTRY.formatNumber).toMatchObject({
            fqn: "formatNumber",
            kind: "property",
            since: "1.4",
        });
        expect(HOVER_REGISTRY.applyFormat).toMatchObject({
            fqn: "applyFormat",
            kind: "property",
            since: "1.4",
        });
    });

    it("contains the chart-aware scalar math helper entries (1.4)", () => {
        expect(HOVER_REGISTRY.roundToMintick).toMatchObject({
            fqn: "roundToMintick",
            kind: "property",
            since: "1.4",
        });
        expect(HOVER_REGISTRY.nz).toMatchObject({ fqn: "nz", kind: "property", since: "1.4" });
        expect(HOVER_REGISTRY.clamp).toMatchObject({
            fqn: "clamp",
            kind: "property",
            since: "1.4",
        });
    });

    it("contains the render-order ZOrdered mixin type entry (1.4)", () => {
        expect(HOVER_REGISTRY.ZOrdered).toMatchObject({
            fqn: "ZOrdered",
            kind: "type",
            since: "1.4",
        });
    });

    it("contains the directly-indexable bar series type entries (1.3)", () => {
        expect(HOVER_REGISTRY.PriceSeries).toMatchObject({ fqn: "PriceSeries", kind: "type" });
        expect(HOVER_REGISTRY.VolumeSeries).toMatchObject({ fqn: "VolumeSeries", kind: "type" });
        expect(HOVER_REGISTRY.BarSeries).toMatchObject({ fqn: "BarSeries", kind: "type" });
    });

    it("contains the writable user series entries (state.series, 1.2)", () => {
        expect(HOVER_REGISTRY.NumberSeriesSlot).toMatchObject({
            fqn: "NumberSeriesSlot",
            kind: "type",
        });
        expect(HOVER_REGISTRY["state.series"]).toMatchObject({
            fqn: "state.series",
            kind: "function",
        });
    });

    it("contains the bounded-collection entries (state.array, 1.3)", () => {
        expect(HOVER_REGISTRY.MutableArraySlot).toMatchObject({
            fqn: "MutableArraySlot",
            kind: "type",
        });
        expect(HOVER_REGISTRY["state.array"]).toMatchObject({
            fqn: "state.array",
            kind: "function",
        });
    });

    it("contains the calendar / session accessor entries (1.5)", () => {
        expect(HOVER_REGISTRY["time.dayofweek"]).toMatchObject({
            fqn: "time.dayofweek",
            kind: "function",
            since: "1.5",
        });
        expect(HOVER_REGISTRY["time.timeClose"]).toMatchObject({
            fqn: "time.timeClose",
            kind: "function",
            since: "1.5",
        });
        expect(HOVER_REGISTRY["session.isOpen"]).toMatchObject({
            fqn: "session.isOpen",
            kind: "function",
            since: "1.5",
        });
        expect(HOVER_REGISTRY["input.session"]).toMatchObject({
            fqn: "input.session",
            kind: "function",
            since: "1.5",
        });
    });

    it("contains indicator-composition (Phase 0.7) type entries", () => {
        expect(HOVER_REGISTRY.DependencyDeclaration).toMatchObject({
            fqn: "DependencyDeclaration",
            kind: "type",
            since: "0.7",
        });
        expect(HOVER_REGISTRY.OutputDeclaration).toMatchObject({
            fqn: "OutputDeclaration",
            kind: "type",
            since: "0.7",
        });
        expect(HOVER_REGISTRY.CompiledScriptBundle).toMatchObject({
            fqn: "CompiledScriptBundle",
            kind: "type",
            since: "0.7",
        });
        expect(HOVER_REGISTRY.isCompiledScriptBundle).toMatchObject({
            fqn: "isCompiledScriptBundle",
            since: "0.7",
        });
    });

    it("contains core hover entries required by editor tier 1", () => {
        expect(HOVER_REGISTRY["ta.ema"]).toMatchObject({
            fqn: "ta.ema",
            kind: "function",
            title: "ta.ema(source, length, opts?)",
            since: "0.1",
        });
        expect(HOVER_REGISTRY["state.float"]).toMatchObject({
            fqn: "state.float",
            kind: "function",
            since: "0.4",
            stability: "stable",
        });
        expect(HOVER_REGISTRY["input.interval"]).toMatchObject({
            fqn: "input.interval",
            title: "input.interval(defaultValue, opts?)",
        });
        expect(HOVER_REGISTRY["request.security"]).toMatchObject({
            fqn: "request.security",
            title: "request.security(opts)",
        });
    });
});
