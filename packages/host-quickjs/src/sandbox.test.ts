// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost";

type RunResult = Readonly<{
    emissions: RunnerEmissions;
    hostErrors: ReadonlyArray<string>;
}>;

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allPhase3Drawings(),
        alerts: capabilities.alerts("toast"),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 10, labels: 10, boxes: 10, polylines: 10, other: 10 },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(name: string): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name,
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 32 },
        maxLookback: 10,
    };
}

function bar(index = 0): Bar {
    const close = index + 1;
    const open = close - 0.25;
    const high = close + 0.5;
    const low = close - 0.5;
    return {
        time: 1_700_000_000_000 + index * 60_000,
        open,
        high,
        low,
        close,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        volume: close * 100,
        symbol: "X",
        interval: "1m",
    };
}

function source(name: string, compute: string): { manifest: ScriptManifest; moduleSource: string } {
    const m = manifest(name);
    return {
        manifest: m,
        moduleSource: `
export default {
    manifest: ${JSON.stringify(m)},
    compute: ${compute},
};
`,
    };
}

async function run(
    name: string,
    compute: string,
    opts: { readonly maxHeapBytes?: number; readonly maxStepMs?: number } = {},
): Promise<RunResult> {
    const hostErrors: string[] = [];
    const compiled = source(name, compute);
    const host = createQuickJsHost({
        capabilities: makeCapabilities(),
        limits: opts,
        onHostError: (message) => {
            hostErrors.push(message);
        },
    });
    await host.load(compiled);
    await host.push({ kind: "close", bar: bar() });
    const emissions = await host.drain();
    host.dispose();
    return { emissions, hostErrors };
}

function expectNoNonTimingHostErrors(hostErrors: ReadonlyArray<string>): void {
    expect(hostErrors.filter((message) => !message.startsWith("step overshoot "))).toEqual([]);
}

describe("host-quickjs sandbox escapes", () => {
    it("blocks Function constructor reach", async () => {
        const result = await run(
            "function constructor",
            `() => {
                const F = (0, eval)("Function");
                F("return 1")();
            }`,
        );

        expect(result.hostErrors.join("\n")).toMatch(/eval|ReferenceError|not defined/i);
        expect(result.emissions.plots).toEqual([]);
        expect(result.emissions.alerts).toEqual([]);
    });

    it("blocks eval", async () => {
        const result = await run("eval", `() => { eval("1"); }`);

        expect(result.hostErrors.join("\n")).toMatch(/eval|ReferenceError|not defined/i);
        expect(result.emissions.plots).toEqual([]);
    });

    it("removes Function and eval from the guest global after hardening", async () => {
        const result = await run(
            "global hardening",
            `({ plot }) => {
                const fnGone = typeof Function === "undefined" ? 1 : 0;
                const evalGone = typeof eval === "undefined" ? 1 : 0;
                plot("sandbox.hardening:1:1#0", fnGone + evalGone, {});
            }`,
        );

        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.plots[0]).toMatchObject({
            slotId: "sandbox.hardening:1:1#0",
            value: 2,
        });
    });

    it("blocks dynamic import", async () => {
        const result = await run(
            "dynamic import",
            `async () => {
                await import("./malicious");
            }`,
        );

        expect(result.hostErrors.join("\n")).toMatch(/import|module|malicious/i);
        expect(result.emissions.plots).toEqual([]);
    });

    it("blocks globalThis access from leaking to the host realm", async () => {
        Reflect.deleteProperty(globalThis, "leaked");
        const result = await run(
            "globalThis containment",
            `({ plot }) => {
                globalThis.leaked = 1;
                plot("sandbox.global:1:1#0", globalThis.leaked, {});
            }`,
        );

        expect(Reflect.get(globalThis, "leaked")).toBeUndefined();
        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.plots[0]).toMatchObject({ value: 1 });
    });

    it("blocks host-object capture through non-JsonValue alert meta", async () => {
        const result = await run(
            "structured clone capture",
            `({ alert, bar }) => {
                alert("sandbox.clone:1:1#0", "capture", { meta: { bar, fn: () => 1 } });
            }`,
        );

        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.alerts).toEqual([]);
        expect(result.emissions.diagnostics[0]).toMatchObject({
            code: "malformed-emission",
            slotId: "sandbox.clone:1:1#0",
        });
        expect(result.emissions.diagnostics[0]?.message).toContain("alert.meta.fn");
    });

    it("blocks infinite-loop DoS", async () => {
        const result = await run(
            "infinite loop",
            `() => {
                while (true) {}
            }`,
            { maxStepMs: 1 },
        );

        expect(result.hostErrors.join("\n")).toMatch(/interrupted|interrupt|step overshoot/i);
        expect(result.emissions.plots).toEqual([]);
    });

    it("blocks OOM exhaustion", async () => {
        const result = await run(
            "oom",
            `() => {
                Array(50_000_000).fill(0);
            }`,
            { maxHeapBytes: 16 * 1024 * 1024 },
        );

        expect(result.hostErrors.join("\n")).toMatch(/quickjs-oom|out of memory|memory/i);
        expect(result.emissions.plots).toEqual([]);
    });

    it("blocks realm leak via Reflect", async () => {
        const result = await run(
            "reflect realm",
            `({ alert }) => {
                const proto = Reflect.getPrototypeOf(Reflect);
                alert("sandbox.reflect:1:1#0", "realm", {
                    meta: { hasHostMethod: typeof proto?.postMessage },
                });
            }`,
        );

        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.alerts[0]?.meta).toEqual({ hasHostMethod: "undefined" });
    });

    it("blocks Symbol.iterator hijack from breaking emission serialization", async () => {
        const result = await run(
            "iterator hijack",
            `({ bar, plot }) => {
                Object.defineProperty(Object.prototype, Symbol.iterator, {
                    get() { throw new Error("hijacked"); },
                    configurable: true,
                });
                plot("sandbox.iterator:1:1#0", bar.close, {});
            }`,
        );

        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.plots[0]).toMatchObject({
            slotId: "sandbox.iterator:1:1#0",
            value: 1,
        });
    });

    it("blocks Proxy revoke after emit from corrupting drain output", async () => {
        const result = await run(
            "proxy revoke",
            `({ alert }) => {
                const pair = Proxy.revocable({ ok: true }, {});
                alert("sandbox.proxy:1:1#0", "proxy", { meta: pair.proxy });
                pair.revoke();
            }`,
        );

        expectNoNonTimingHostErrors(result.hostErrors);
        expect(result.emissions.alerts[0]).toMatchObject({
            slotId: "sandbox.proxy:1:1#0",
            message: "proxy",
            meta: { ok: true },
        });
    });
});
