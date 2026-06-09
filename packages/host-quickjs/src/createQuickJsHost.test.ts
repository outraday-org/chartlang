// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createQuickJsHost, type CreateQuickJsHostOpts } from "./createQuickJsHost";
import type {
    QuickJsContextLike,
    QuickJsHandleLike,
    QuickJsHostLimits,
    QuickJsLike,
    ScriptHost,
} from "./types";

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allPhase3Drawings(),
        alerts: new Set(["default"]),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 10,
            labels: 10,
            boxes: 10,
            polylines: 10,
            other: 10,
        },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(name = "quickjs-test"): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name,
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 16 },
        maxLookback: 0,
    };
}

function bar(time: number, close: number): Bar {
    const high = close + 1;
    const low = close - 1;
    return {
        time,
        open: close,
        high,
        low,
        close,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (close + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        volume: close * 10,
        symbol: "X",
        interval: "1m",
    };
}

function compiled(moduleSource: string, m = manifest()): Parameters<ScriptHost["load"]>[0] {
    return { moduleSource, manifest: m };
}

function plotSource(m = manifest()): string {
    return `
export default {
    manifest: ${JSON.stringify(m)},
    compute: ({ bar, plot }) => {
        plot("quick.chart.ts:1:1#0", bar.close, {});
    },
};
`;
}

class FakeHandle implements QuickJsHandleLike {
    constructor(readonly value: unknown) {}
    dispose(): void {}
}

class FakeContext implements QuickJsContextLike {
    readonly global = new FakeHandle(globalThis);
    readonly undefined = new FakeHandle(undefined);
    readonly calls: Array<string> = [];
    loadReply: unknown = { kind: "loaded" };
    drainReply: unknown | null = null;
    disposeReply: unknown = { kind: "loaded" };
    pushThrow: string | null = null;
    pushThrowValue: unknown = null;
    onPush: (() => void) | null = null;
    lastLoadFrame: unknown = null;

    evalCode(code: string, filename?: string): unknown {
        this.calls.push(`${filename ?? "eval"}:${code.length}`);
        return { value: new FakeHandle(undefined) };
    }

    getProp(_handle: QuickJsHandleLike, key: string): QuickJsHandleLike {
        if (key === "__chartlang_drain") {
            return new FakeHandle((json?: string) =>
                JSON.stringify(
                    this.drainReply ?? {
                        kind: "emissions",
                        nonce: JSON.parse(json ?? "{}").nonce,
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
                    },
                ),
            );
        }
        if (key === "__chartlang_dispose") {
            return new FakeHandle(() => JSON.stringify(this.disposeReply));
        }
        const fn = async (json?: string) => {
            if (key === "__chartlang_load") {
                this.lastLoadFrame = JSON.parse(json ?? "{}");
                return JSON.stringify(this.loadReply);
            }
            if (key === "__chartlang_push") {
                this.onPush?.();
                if (this.pushThrow !== null) throw new Error(this.pushThrow);
                if (this.pushThrowValue !== null) throw this.pushThrowValue;
                return JSON.stringify({ kind: "loaded" });
            }
            return JSON.stringify({ kind: "loaded" });
        };
        return new FakeHandle(fn);
    }

    newString(value: string): QuickJsHandleLike {
        return new FakeHandle(value);
    }

    callFunction(
        fn: QuickJsHandleLike,
        _thisVal: QuickJsHandleLike,
        ...args: ReadonlyArray<QuickJsHandleLike>
    ): unknown {
        const callable = fn.value;
        if (typeof callable !== "function") throw new Error("not callable");
        return { value: new FakeHandle(callable(...args.map((arg) => arg.value))) };
    }

    unwrapResult(result: unknown): QuickJsHandleLike {
        if (result instanceof FakeHandle) return result;
        if (result !== null && typeof result === "object" && "value" in result) {
            return (result as { readonly value: QuickJsHandleLike }).value;
        }
        throw new Error("bad fake result");
    }

    getString(handle: QuickJsHandleLike): string {
        return String((handle as FakeHandle).value);
    }

    async resolvePromise(handle: QuickJsHandleLike): Promise<unknown> {
        return { value: new FakeHandle(await (handle as FakeHandle).value) };
    }

    dispose(): void {
        this.calls.push("dispose");
    }
}

describe("createQuickJsHost", () => {
    it("is exported with the ScriptHost constructor signature", () => {
        expect(typeof createQuickJsHost).toBe("function");
        expectTypeOf(createQuickJsHost).parameter(0).toEqualTypeOf<CreateQuickJsHostOpts>();
        expectTypeOf(createQuickJsHost).returns.toEqualTypeOf<ScriptHost>();
        expectTypeOf<CreateQuickJsHostOpts["quickJsLike"]>().toEqualTypeOf<
            QuickJsLike | undefined
        >();
        expectTypeOf<CreateQuickJsHostOpts["limits"]>().toEqualTypeOf<
            Partial<QuickJsHostLimits> | undefined
        >();
    });

    it("returns a frozen ScriptHost and reports host-worker-shaped limits", () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        expect(Object.isFrozen(host)).toBe(true);
        expect(host.limits).toEqual({
            maxHeapBytes: 64 * 1024 * 1024,
            maxCpuMsPerStep: 1,
            maxRingBufferBars: 5_000,
        });
        host.dispose();
    });

    it("configures memory and interrupt limits on lazy load", async () => {
        const context = new FakeContext();
        let memoryLimit = 0;
        let interrupt: (() => boolean) | null = null;
        const quickJsLike: QuickJsLike = () => ({
            newRuntime: () => ({
                setMemoryLimit(value) {
                    memoryLimit = value;
                },
                setInterruptHandler(cb) {
                    interrupt = cb;
                },
                executePendingJobs: () => undefined,
                newContext: () => context,
            }),
        });
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike,
            limits: { maxHeapBytes: 123, maxStepMs: 99 },
        });

        await host.load(compiled(plotSource()));

        expect(memoryLimit).toBe(123);
        expect(interrupt).toEqual(expect.any(Function));
        expect(context.calls[0]).toContain("chartlang-dispatcher.js");
        host.dispose();
    });

    it("serializes sym-info, input overrides, and Set capabilities through the JSON membrane", async () => {
        const context = new FakeContext();
        const quickJsLike: QuickJsLike = () => ({
            newRuntime: () => ({
                setMemoryLimit: () => undefined,
                setInterruptHandler: () => undefined,
                executePendingJobs: () => undefined,
                newContext: () => context,
            }),
        });
        const host = createQuickJsHost({
            capabilities: { ...makeCapabilities(), symInfoFields: new Set(["ticker"]) },
            symInfo: { ticker: "DEMO" },
            resolveInputs: () => ({ length: 20 }),
            quickJsLike,
        });

        await host.load(compiled(plotSource()));

        expect(context.lastLoadFrame).toMatchObject({
            symInfo: { ticker: "DEMO" },
            inputOverrides: { length: 20 },
            capabilities: {
                plots: expect.any(Array),
                drawings: expect.any(Array),
                alerts: expect.any(Array),
                inputs: expect.any(Array),
                symInfoFields: ["ticker"],
            },
        });
        host.dispose();
    });

    it("rejects and reports fatal load replies", async () => {
        const context = new FakeContext();
        context.loadReply = { kind: "fatal", message: "load fatal" };
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });

        await expect(host.load(compiled(plotSource()))).rejects.toThrow("load fatal");

        expect(lastError).toBe("load fatal");
        host.dispose();
    });

    it("maps push memory failures to quickjs-oom", async () => {
        const context = new FakeContext();
        context.pushThrow = "out of memory";
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(compiled(plotSource()));

        await host.push({ kind: "close", bar: bar(1, 1) });

        expect(lastError).toBe("quickjs-oom: out of memory");
        host.dispose();
    });

    it("stringifies non-Error membrane throws", async () => {
        const context = new FakeContext();
        context.pushThrowValue = "plain push failure";
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(compiled(plotSource()));

        await host.push({ kind: "close", bar: bar(1, 1) });

        expect(lastError).toBe("plain push failure");
        host.dispose();
    });

    it("reports generic push membrane failures", async () => {
        const context = new FakeContext();
        context.pushThrow = "push blew up";
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(compiled(plotSource()));

        await host.push({ kind: "close", bar: bar(1, 1) });

        expect(lastError).toBe("push blew up");
        host.dispose();
    });

    it("uses the interrupt flag during a step and reports step overshoots", async () => {
        const context = new FakeContext();
        let interrupt: (() => boolean) | null = null;
        const errors: Array<string> = [];
        context.onPush = () => {
            expect(interrupt?.()).toBe(true);
        };
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: (cb) => {
                        interrupt = cb;
                    },
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            limits: { maxStepMs: -1 },
            onHostError: (message) => {
                errors.push(message);
            },
        });
        await host.load(compiled(plotSource()));

        await host.push({ kind: "close", bar: bar(1, 1) });

        expect(errors.some((message) => message.startsWith("step overshoot"))).toBe(true);
        host.dispose();
    });

    it("validates malformed drain emissions and keeps diagnostics", async () => {
        const context = new FakeContext();
        context.drainReply = {
            kind: "emissions",
            nonce: 0,
            emissions: {
                plots: [{ kind: "plot", slotId: "bad", bar: 0, value: "nope" }],
                alerts: [
                    {
                        kind: "alert",
                        slotId: "good-alert",
                        severity: "info",
                        message: "ok",
                        bar: 0,
                        time: 1,
                        meta: {},
                        channels: ["log"],
                        dedupeKey: "good-alert:0",
                    },
                    { kind: "alert", slotId: "bad-alert", bar: 0, message: 1 },
                ],
                drawings: [],
                alertConditions: [
                    {
                        kind: "alert-condition",
                        conditionId: "good-condition",
                        title: "Good",
                        description: "ok",
                        defaultMessage: "ok",
                        fired: true,
                        bar: 0,
                        time: 1,
                    },
                    { kind: "alert-condition", conditionId: 1, bar: 0 },
                ],
                logs: [
                    {
                        kind: "log",
                        level: "info",
                        message: "ok",
                        meta: {},
                        bar: 0,
                        time: 1,
                    },
                    { kind: "log", level: "loud", message: "bad", bar: 0, time: 1 },
                ],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            },
        };
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
        });
        await host.load(compiled(plotSource()));

        const emissions = await host.drain();

        expect(emissions.plots).toEqual([]);
        expect(emissions.alerts).toHaveLength(1);
        expect(emissions.alertConditions).toHaveLength(1);
        expect(emissions.logs).toHaveLength(1);
        expect(emissions.diagnostics.map((d) => d.code)).toEqual([
            "malformed-emission",
            "malformed-emission",
            "malformed-emission",
            "malformed-emission",
        ]);
        host.dispose();
    });

    it("reuses the in-flight QuickJS initialization promise", async () => {
        const context = new FakeContext();
        let runtimeCount = 0;
        const quickJsLike: QuickJsLike = async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            return {
                newRuntime: () => {
                    runtimeCount += 1;
                    return {
                        setMemoryLimit: () => undefined,
                        setInterruptHandler: () => undefined,
                        executePendingJobs: () => undefined,
                        newContext: () => context,
                    };
                },
            };
        };
        const host = createQuickJsHost({ capabilities: makeCapabilities(), quickJsLike });

        await Promise.all([host.load(compiled(plotSource())), host.load(compiled(plotSource()))]);

        expect(runtimeCount).toBe(1);
        host.dispose();
    });

    it("reports fatal drain replies and resolves with empty emissions", async () => {
        const context = new FakeContext();
        context.drainReply = { kind: "fatal", message: "drain fatal" };
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(compiled(plotSource()));

        const emissions = await host.drain();

        expect(lastError).toBe("drain fatal");
        expect(emissions).toEqual({
            plots: [],
            drawings: [],
            alerts: [],
            alertConditions: [],
            logs: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        });
        host.dispose();
    });

    it("reports dispose fatal replies", async () => {
        const context = new FakeContext();
        context.disposeReply = { kind: "fatal", message: "dispose fatal" };
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            quickJsLike: () => ({
                newRuntime: () => ({
                    setMemoryLimit: () => undefined,
                    setInterruptHandler: () => undefined,
                    executePendingJobs: () => undefined,
                    newContext: () => context,
                }),
            }),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(compiled(plotSource()));

        host.dispose();

        expect(lastError).toBe("dispose fatal");
    });

    it("loads, pushes, and drains a plot through real QuickJS", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load(compiled(plotSource()));
        await host.push({ kind: "close", bar: bar(1, 7) });

        const emissions = await host.drain();

        expect(emissions.plots).toHaveLength(1);
        expect(emissions.plots[0]).toMatchObject({
            kind: "plot",
            slotId: "quick.chart.ts:1:1#0",
            value: 7,
        });
        host.dispose();
    });

    it("keeps push fire-and-forget; drain is the emission resolution path", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load(compiled(plotSource()));

        await expect(host.push({ kind: "close", bar: bar(1, 3) })).resolves.toBeUndefined();
        const emissions = await host.drain();

        expect(emissions.plots[0]?.value).toBe(3);
        host.dispose();
    });

    it("rejects load when the module source has a syntax error", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });

        await expect(host.load(compiled("export default {"))).rejects.toThrow();
        host.dispose();
    });

    it("surfaces runtime throws through onHostError", async () => {
        let lastError = "";
        const host = createQuickJsHost({
            capabilities: makeCapabilities(),
            onHostError: (message) => {
                lastError = message;
            },
        });
        await host.load(
            compiled(`
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: () => { throw new Error("compute boom"); },
};
`),
        );

        await host.push({ kind: "close", bar: bar(1, 1) });

        expect(lastError).toContain("compute boom");
        host.dispose();
    });

    it("calls context dispose and clears pending drains", async () => {
        const context = new FakeContext();
        const quickJsLike: QuickJsLike = () => ({
            newRuntime: () => ({
                setMemoryLimit: () => undefined,
                setInterruptHandler: () => undefined,
                executePendingJobs: () => undefined,
                newContext: () => context,
            }),
        });
        const host = createQuickJsHost({ capabilities: makeCapabilities(), quickJsLike });
        await host.load(compiled(plotSource()));

        host.dispose();

        expect(context.calls).toContain("dispose");
    });
});
