// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

function makeManifest(overrides: Partial<ScriptManifest>): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "demo",
        inputs: {},
        capabilities: [],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
        ...overrides,
    };
}

import type { MutableRunnerEmissions, RuntimeContext } from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { resolveDefaultPane, resolvePane, resolveScriptPane } from "./paneResolver.js";

function makeCapabilities(subPanes = 0): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeCtx(
    subPanes = 0,
    overrides: { defaultPane?: string; scriptPane?: string } = {},
): {
    ctx: RuntimeContext;
    emissions: MutableRunnerEmissions;
} {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: makeCapabilities(subPanes),
        emissions,
        barIndex: () => 7,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        defaultPane: overrides.defaultPane ?? "overlay",
        scriptPane: overrides.scriptPane ?? "script:test",
    };
    return { ctx, emissions };
}

describe("resolvePane", () => {
    it("returns ctx.defaultPane and pushes no diagnostic when requested is undefined (overlay default)", () => {
        const { ctx, emissions } = makeCtx(0);
        const pane = resolvePane(undefined, ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("returns ctx.defaultPane (a subpane) when requested is undefined and the script default is a subpane", () => {
        const { ctx, emissions } = makeCtx(1, { defaultPane: "script:rsi" });
        const pane = resolvePane(undefined, ctx, "slot");
        expect(pane).toBe("script:rsi");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("returns 'overlay' for requested 'overlay' regardless of subPanes, no diagnostic", () => {
        const a = makeCtx(0);
        expect(resolvePane("overlay", a.ctx, "slot")).toBe("overlay");
        expect(a.emissions.diagnostics).toEqual([]);
        const b = makeCtx(1);
        expect(resolvePane("overlay", b.ctx, "slot")).toBe("overlay");
        expect(b.emissions.diagnostics).toEqual([]);
    });

    it("coalesces 'new' to ctx.scriptPane on an overlay-default ctx (subPanes 1)", () => {
        const { ctx, emissions } = makeCtx(1, { scriptPane: "script:demo" });
        const pane = resolvePane("new", ctx, "slot");
        expect(pane).toBe("script:demo");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("coalesces 'new' to ctx.scriptPane on a subpane-default ctx (subPanes 1)", () => {
        const { ctx, emissions } = makeCtx(1, {
            defaultPane: "script:rsi",
            scriptPane: "script:rsi",
        });
        const pane = resolvePane("new", ctx, "slot");
        expect(pane).toBe("script:rsi");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("returns a named pane unchanged when subPanes >= 1, no diagnostic", () => {
        const { ctx, emissions } = makeCtx(1);
        const pane = resolvePane("rsi", ctx, "slot");
        expect(pane).toBe("rsi");
        expect(emissions.diagnostics).toEqual([]);
    });

    it("folds a named pane to 'overlay' and pushes unsupported-pane when subPanes === 0", () => {
        const { ctx, emissions } = makeCtx(0);
        const pane = resolvePane("rsi", ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
        expect(emissions.diagnostics[0].slotId).toBe("slot");
        expect(emissions.diagnostics[0].bar).toBe(7);
        expect(emissions.diagnostics[0].message).toContain("subPanes: 0");
    });

    it("folds 'new' to 'overlay' and pushes unsupported-pane when subPanes === 0", () => {
        const { ctx, emissions } = makeCtx(0, { scriptPane: "script:demo" });
        const pane = resolvePane("new", ctx, "slot");
        expect(pane).toBe("overlay");
        expect(emissions.diagnostics).toHaveLength(1);
        expect(emissions.diagnostics[0].code).toBe("unsupported-pane");
        expect(emissions.diagnostics[0].message).toContain("script:demo");
    });
});

describe("resolveScriptPane", () => {
    it("sanitises a normal name (spaces → '-')", () => {
        expect(resolveScriptPane(makeManifest({ name: "RSI Cross" }))).toBe("script:RSI-Cross");
    });

    it("falls back to 'script:default' for an empty name", () => {
        expect(resolveScriptPane(makeManifest({ name: "" }))).toBe("script:default");
    });

    it("sanitises a name composed entirely of disallowed characters (no empty fallback)", () => {
        // Every character is replaced by '-', so the post-sanitise string
        // is non-empty and the empty-name fallback does NOT fire — the
        // result is the literal 'script:---' key.
        expect(resolveScriptPane(makeManifest({ name: "!@#" }))).toBe("script:---");
    });

    it("preserves [a-zA-Z0-9_-] characters", () => {
        expect(resolveScriptPane(makeManifest({ name: "RSI_14-v2" }))).toBe("script:RSI_14-v2");
    });
});

describe("resolveDefaultPane", () => {
    it("returns 'overlay' when manifest.overlay is absent", () => {
        expect(resolveDefaultPane(makeManifest({ name: "x" }))).toBe("overlay");
    });

    it("returns 'overlay' when manifest.overlay === true", () => {
        expect(resolveDefaultPane(makeManifest({ name: "x", overlay: true }))).toBe("overlay");
    });

    it("returns the script subpane key when manifest.overlay === false", () => {
        expect(resolveDefaultPane(makeManifest({ name: "x", overlay: false }))).toBe("script:x");
    });
});
