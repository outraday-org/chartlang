// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptBundle, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import type { RunnerState } from "../createScriptRunner.js";
import { createStreamState } from "../streamState.js";
import { createDepOutputStore } from "./DepOutputStore.js";
import { createDepRunner, createSiblingRunner, runDepStep, runSiblingStep } from "./DepRunner.js";

function makeCapabilities(): Capabilities {
    return {
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
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeBar(close = 1): Bar {
    return {
        time: 0,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        symbol: "X",
        interval: "1m",
    };
}

function withTitledOutput(title: string, compiled: CompiledScriptObject): CompiledScriptObject {
    return Object.freeze({
        manifest: { ...compiled.manifest, outputs: [{ title, kind: "series-number" as const }] },
        compute: compiled.compute,
        output: compiled.output,
        withInputs: compiled.withInputs,
    });
}

function depBase(value: number): CompiledScriptObject {
    return withTitledOutput(
        "line",
        defineIndicator({
            name: "base",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("base:1:1#0", value, { title: "line" });
            },
        }),
    );
}

function fakeMainStream(): never {
    // Construction tests below only inspect the runner's slotIdPrefix /
    // isDep / declaredOutputs — the mainStream is never read, so a
    // minimal sentinel suffices.
    return createStreamState({ interval: "", capacity: 1, symbol: "" }) as never;
}

describe("createDepRunner / createSiblingRunner — shape", () => {
    it("createDepRunner sets dep slot-id prefix and isDep=true", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "x", outputs: [{ title: "line" }] }],
            capacity: 4,
        });
        const dep = createDepRunner({
            compiled: depBase(1),
            localId: "x",
            parentCapabilities: makeCapabilities(),
            chartSymbol: "",
            mainStream: fakeMainStream(),
            secondaryStreams: new Map(),
            depOutputStore: store,
            inputOverrides: Object.freeze({}),
            now: () => 0,
        });
        expect(dep.kind).toBe("dep");
        expect(dep.localId).toBe("x");
        expect(dep.slotIdPrefix).toBe("dep:x/");
        expect(dep.state.runtimeContext.isDep).toBe(true);
        expect(dep.state.runtimeContext.slotIdPrefix).toBe("dep:x/");
        expect(dep.declaredOutputs).toEqual(["line"]);
    });

    it("createSiblingRunner sets export slot-id prefix and isDep=false", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "slow", outputs: [{ title: "line" }] }],
            capacity: 4,
        });
        const sib = createSiblingRunner({
            compiled: depBase(2),
            exportName: "slow",
            parentCapabilities: makeCapabilities(),
            chartSymbol: "",
            mainStream: fakeMainStream(),
            secondaryStreams: new Map(),
            depOutputStore: store,
            inputOverrides: Object.freeze({}),
            now: () => 0,
        });
        expect(sib.kind).toBe("sibling");
        expect(sib.exportName).toBe("slow");
        expect(sib.slotIdPrefix).toBe("export:slow/");
        expect(sib.state.runtimeContext.isDep).toBe(false);
        expect(sib.state.runtimeContext.slotIdPrefix).toBe("export:slow/");
    });
});

describe("runDepStep / runSiblingStep — end-to-end via createScriptRunner", () => {
    function bundleWithDep(): CompiledScriptBundle {
        const dep = depBase(42);
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot }) => {
                const fn = (globalThis as Record<string, unknown>).__chartlang_depOutput as (
                    s: string,
                    l: string,
                    t: string,
                ) => { current: number };
                const dv = fn("p.chart.ts:1:1#0", "fast", "line");
                plot("primary:1:1#0", dv.current, { title: "out" });
            },
        });
        return Object.freeze({
            primary,
            dependencies: [{ localId: "fast", compiled: dep }],
            siblings: [],
        });
    }

    it("dep plot output flows into consumer via depOutputStore", async () => {
        const runner = createScriptRunner({
            compiled: bundleWithDep(),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        const out = drained.plots.find((p) => p.title === "out");
        expect(out?.value).toBe(42);
        expect(drained.plots.find((p) => p.title === "line")).toBeUndefined();
        await runner.dispose();
    });

    function bundleWithDepThatHalts(): CompiledScriptBundle {
        const dep = withTitledOutput(
            "line",
            defineIndicator({
                name: "bad",
                apiVersion: 1,
                compute: ({ runtime }) => {
                    runtime.error("dep boom");
                },
            }),
        );
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("primary:1:1#0", 99, { title: "out" });
            },
        });
        return Object.freeze({
            primary,
            dependencies: [{ localId: "bad", compiled: dep }],
            siblings: [],
        });
    }

    it("dep halt sets dep-error diagnostic and clears primary visuals", async () => {
        const runner = createScriptRunner({
            compiled: bundleWithDepThatHalts(),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        expect(drained.plots).toHaveLength(0);
        const depErr = drained.diagnostics.find((d) => d.code === "dep-error");
        expect(depErr).toBeDefined();
        expect(depErr?.slotId).toBe("dep:bad/");
        await runner.dispose();
    });

    function bundleWithSibling(): CompiledScriptBundle {
        const sibling = withTitledOutput(
            "line",
            defineIndicator({
                name: "slow",
                apiVersion: 1,
                compute: ({ plot }) => {
                    plot("slow:1:1#0", 10, { title: "line" });
                },
            }),
        );
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("primary:2:1#0", 1, { title: "out" });
            },
        });
        return Object.freeze({
            primary,
            dependencies: [],
            siblings: [{ exportName: "slow", compiled: sibling }],
        });
    }

    it("sibling plot is forwarded with export prefix in slot id", async () => {
        const runner = createScriptRunner({
            compiled: bundleWithSibling(),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        const siblingPlot = drained.plots.find(
            (p) => p.slotId.startsWith("export:slow/") && p.title === "line",
        );
        expect(siblingPlot?.value).toBe(10);
        await runner.dispose();
    });

    function bundleWithSiblingThatHalts(): CompiledScriptBundle {
        const sibling = withTitledOutput(
            "line",
            defineIndicator({
                name: "slow",
                apiVersion: 1,
                compute: ({ runtime }) => {
                    runtime.error("sibling boom");
                },
            }),
        );
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("primary:3:1#0", 7, { title: "out" });
            },
        });
        return Object.freeze({
            primary,
            dependencies: [],
            siblings: [{ exportName: "slow", compiled: sibling }],
        });
    }

    it("sibling halt does NOT clear the primary's emissions", async () => {
        const runner = createScriptRunner({
            compiled: bundleWithSiblingThatHalts(),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        expect(drained.plots.find((p) => p.title === "out")?.value).toBe(7);
        const depErr = drained.diagnostics.find((d) => d.code === "dep-error");
        expect(depErr?.slotId).toBe("export:slow/");
        await runner.dispose();
    });

    it("non-halt throw from a dep is also captured as dep-error", async () => {
        const dep = withTitledOutput(
            "line",
            defineIndicator({
                name: "broken",
                apiVersion: 1,
                compute: () => {
                    throw new Error("raw throw");
                },
            }),
        );
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: () => undefined,
        });
        const bundle: CompiledScriptBundle = Object.freeze({
            primary,
            dependencies: [{ localId: "broken", compiled: dep }],
            siblings: [],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        const err = drained.diagnostics.find(
            (d) => d.code === "dep-error" && d.message.includes("raw throw"),
        );
        expect(err).toBeDefined();
        await runner.dispose();
    });

    it("non-halt throw from a sibling is also captured as dep-error", async () => {
        const sibling = withTitledOutput(
            "line",
            defineIndicator({
                name: "broken",
                apiVersion: 1,
                compute: () => {
                    throw new Error("sibling raw");
                },
            }),
        );
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("primary:2:1#0", 1, { title: "out" });
            },
        });
        const bundle: CompiledScriptBundle = Object.freeze({
            primary,
            dependencies: [],
            siblings: [{ exportName: "broken", compiled: sibling }],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        const err = drained.diagnostics.find(
            (d) => d.code === "dep-error" && d.message.includes("sibling raw"),
        );
        expect(err).toBeDefined();
        expect(drained.plots.find((p) => p.title === "out")?.value).toBe(1);
        await runner.dispose();
    });
});

describe("runDepStep / runSiblingStep — additional cases", () => {
    it("dep without declared outputs still mounts and runs", async () => {
        const noOutputsDep = defineIndicator({
            name: "no-out",
            apiVersion: 1,
            compute: () => undefined,
        });
        const primary = defineIndicator({
            name: "p",
            apiVersion: 1,
            compute: () => undefined,
        });
        const bundle: CompiledScriptBundle = Object.freeze({
            primary,
            dependencies: [{ localId: "x", compiled: noOutputsDep }],
            siblings: [],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        expect(runner.drain().diagnostics.find((d) => d.code === "dep-error")).toBeUndefined();
        await runner.dispose();
    });

    it("captures dep-error when dep throws a non-Error value", async () => {
        const badDep = withTitledOutput(
            "line",
            defineIndicator({
                name: "throw-string",
                apiVersion: 1,
                compute: () => {
                    throw "raw string";
                },
            }),
        );
        const primary = defineIndicator({
            name: "p",
            apiVersion: 1,
            compute: () => undefined,
        });
        const bundle: CompiledScriptBundle = Object.freeze({
            primary,
            dependencies: [{ localId: "y", compiled: badDep }],
            siblings: [],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        const drained = runner.drain();
        const err = drained.diagnostics.find(
            (d) => d.code === "dep-error" && d.message === "raw string",
        );
        expect(err).toBeDefined();
        await runner.dispose();
    });

    it("onBarTick walks dep + sibling runners and clears primary on dep halt", async () => {
        const haltingDep = withTitledOutput(
            "line",
            defineIndicator({
                name: "halt",
                apiVersion: 1,
                compute: ({ runtime }) => {
                    runtime.error("tick halt");
                },
            }),
        );
        const sibling = withTitledOutput(
            "line",
            defineIndicator({
                name: "slow",
                apiVersion: 1,
                compute: ({ plot }) => {
                    plot("slow:1:1#0", 5, { title: "line" });
                },
            }),
        );
        const primary = defineIndicator({
            name: "p",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("p:1:1#0", 9, { title: "out" });
            },
        });
        const bundle: CompiledScriptBundle = Object.freeze({
            primary,
            dependencies: [{ localId: "halt", compiled: haltingDep }],
            siblings: [{ exportName: "slow", compiled: sibling }],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar());
        runner.drain(); // discard close emissions
        await runner.onBarTick(makeBar(2));
        const drained = runner.drain();
        // Primary's emissions were cleared due to dep halt.
        expect(drained.plots.find((p) => p.title === "out")).toBeUndefined();
        const depErr = drained.diagnostics.find((d) => d.code === "dep-error");
        expect(depErr?.slotId).toBe("dep:halt/");
        await runner.dispose();
    });
});

describe("runDepStep / runSiblingStep — error guards", () => {
    function parentWithoutStore(): RunnerState {
        return {
            emissions: {
                plots: [],
                drawings: [],
                alerts: [],
                alertConditions: [],
                logs: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            },
            depErroredThisBar: false,
            depOutputStore: null,
        } as unknown as RunnerState;
    }

    it("runDepStep throws when parent has no dep output store", async () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "x", outputs: [{ title: "line" }] }],
            capacity: 4,
        });
        const dep = createDepRunner({
            compiled: depBase(1),
            localId: "x",
            parentCapabilities: makeCapabilities(),
            chartSymbol: "",
            mainStream: fakeMainStream(),
            secondaryStreams: new Map(),
            depOutputStore: store,
            inputOverrides: Object.freeze({}),
            now: () => 0,
        });
        await expect(
            runDepStep(dep, parentWithoutStore(), makeBar(), "close", false),
        ).rejects.toThrow(/no dep output store/);
    });

    it("runSiblingStep throws when parent has no dep output store", async () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "slow", outputs: [{ title: "line" }] }],
            capacity: 4,
        });
        const sib = createSiblingRunner({
            compiled: depBase(1),
            exportName: "slow",
            parentCapabilities: makeCapabilities(),
            chartSymbol: "",
            mainStream: fakeMainStream(),
            secondaryStreams: new Map(),
            depOutputStore: store,
            inputOverrides: Object.freeze({}),
            now: () => 0,
        });
        await expect(
            runSiblingStep(sib, parentWithoutStore(), makeBar(), "close", false),
        ).rejects.toThrow(/no dep output store/);
    });
});
