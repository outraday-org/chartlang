// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { SnapshotError } from "@invinite-org/chartlang-core";
import type { CreateQuickJsHostOpts, ScriptHost } from "@invinite-org/chartlang-host-quickjs";
import { QuickJsStepAbortedError } from "@invinite-org/chartlang-host-quickjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSUMER, CROSS, UP_BAR_ALERT, compiled, walk } from "./__fixtures__/scripts.js";
import { createAlertRunner } from "./runner.js";
import type { AlertBar, AlertRunnerDiagnostic, CreateAlertRunnerOpts } from "./types.js";

// Real scripts compile through esbuild and run in QuickJS; a loaded CI box
// needs more than the default 5 s.
vi.setConfig({ testTimeout: 60_000 });

// Host behaviours real QuickJS cannot be made to show on demand: a sandbox
// that cannot capture its state, an out-of-memory push, a failing rollback.
type Script = {
    push?: (event: CandleEvent, opts: CreateQuickJsHostOpts) => void;
    drain?: () => RunnerEmissions;
    exportSnapshot?: () => Awaited<ReturnType<ScriptHost["exportSnapshot"]>>;
    importSnapshot?: () => void;
    load?: () => void;
    setExternalSeries?: (feeds: unknown) => void;
};

const EMPTY: RunnerEmissions = {
    plots: [],
    drawings: [],
    alerts: [],
    alertConditions: [],
    orders: [],
    logs: [],
    diagnostics: [],
    fromBar: 0,
    toBar: 0,
};

let scripts: Script[] = [];
const created: CreateQuickJsHostOpts[] = [];

vi.mock("@invinite-org/chartlang-host-quickjs", async (importOriginal) => {
    const original = await importOriginal<typeof import("@invinite-org/chartlang-host-quickjs")>();
    return {
        ...original,
        createQuickJsHost: (opts: CreateQuickJsHostOpts): ScriptHost => {
            created.push(opts);
            const script = scripts.shift() ?? {};
            return {
                async load() {
                    script.load?.();
                },
                async push(event) {
                    script.push?.(event, opts);
                },
                async drain() {
                    return script.drain?.() ?? EMPTY;
                },
                async exportSnapshot() {
                    return script.exportSnapshot === undefined
                        ? { key: null, snapshot: {} as never }
                        : script.exportSnapshot();
                },
                async importSnapshot() {
                    script.importSnapshot?.();
                    return { barIndex: 0 };
                },
                setPlotOverrides: () => undefined,
                setExternalSeries: (feeds) => script.setExternalSeries?.(feeds),
                dispose: () => undefined,
                limits: {
                    maxHeapBytes: 0,
                    maxCpuMsPerStep: 0,
                    maxRingBufferBars: 0,
                    maxLoadTimeoutMs: 0,
                },
            };
        },
    };
});

const BARS = walk(5);

async function make(extra: Partial<CreateAlertRunnerOpts> = {}) {
    return createAlertRunner({
        compiled: await compiled(UP_BAR_ALERT),
        interval: "1h",
        frequency: "every_time",
        ...extra,
    });
}

beforeEach(() => {
    scripts = [];
    created.length = 0;
});

describe("createAlertRunner against a scripted host", () => {
    it("forwards the session calendar and the QuickJS factory", async () => {
        const quickJsLike = vi.fn();
        await make({ sessionCalendar: [], quickJsLike, symInfo: { ticker: "X" } });
        expect(created[0]).toMatchObject({
            sessionCalendar: [],
            quickJsLike,
            symInfo: { ticker: "X" },
        });
        expect(created[0]?.resolveInputs?.("ignored")).toEqual({});
    });

    it("reports a thrown non-Error load failure", async () => {
        scripts = [
            {
                load: () => {
                    throw "plain string";
                },
            },
        ];
        await expect(make()).rejects.toMatchObject({
            code: "load-failed",
            message: "script load failed: plain string",
        });
    });

    it("fails the runner on an out-of-memory push", async () => {
        scripts = [{ push: (_event, opts) => opts.onHostError?.("quickjs-oom: out of memory") }];
        const r = await make();
        await expect(r.onBarClose(BARS[0] as AlertBar)).rejects.toMatchObject({
            code: "out-of-memory",
        });
        await expect(r.onBarClose(BARS[1] as AlertBar)).rejects.toMatchObject({
            code: "runner-failed",
        });
    });

    it("uses the abort message when the host reported nothing", async () => {
        scripts = [
            {
                drain: () => {
                    throw new QuickJsStepAbortedError("cut", "time");
                },
            },
        ];
        const r = await make();
        await expect(r.onBarClose(BARS[0] as AlertBar)).rejects.toMatchObject({
            code: "aborted",
            reason: "time",
            message: "cut",
        });
    });

    it("rethrows an unexpected drain error without failing the runner", async () => {
        let calls = 0;
        scripts = [
            {
                drain: () => {
                    calls += 1;
                    if (calls === 1) throw new TypeError("odd");
                    return EMPTY;
                },
            },
        ];
        const r = await make();
        await expect(r.onBarClose(BARS[0] as AlertBar)).rejects.toThrow(TypeError);
        await expect(r.onBarClose(BARS[0] as AlertBar)).resolves.toEqual([]);
    });

    it("forwards host messages and runtime diagnostics", async () => {
        const seen: AlertRunnerDiagnostic[] = [];
        const diagnostic = {
            kind: "diagnostic" as const,
            severity: "warning" as const,
            code: "input-coercion-failed" as const,
            message: "bad",
            slotId: null,
            bar: 0,
        };
        scripts = [
            {
                push: (_event, opts) => opts.onHostError?.("step overshoot 3.00ms"),
                drain: () => ({ ...EMPTY, diagnostics: [diagnostic] }),
            },
        ];
        const r = await make({ onDiagnostic: (d) => seen.push(d) });
        await r.onBarClose(BARS[0] as AlertBar);
        expect(seen).toEqual([
            { source: "host", message: "step overshoot 3.00ms" },
            { source: "runtime", message: "bad", diagnostic },
        ]);
    });

    it("refuses a pre-close when the state cannot be captured", async () => {
        let exported = 0;
        scripts = [
            {
                exportSnapshot: () => {
                    exported += 1;
                    return null;
                },
            },
        ];
        const r = await make();
        await r.onBarClose(BARS[0] as AlertBar);
        await expect(r.onPreClose(BARS[1] as AlertBar, 0)).rejects.toMatchObject({
            code: "snapshot-unavailable",
            message: "could not capture state for the pre-close copy",
        });
        expect(exported).toBe(1);
        await expect(r.exportSnapshot()).rejects.toMatchObject({ code: "snapshot-unavailable" });
    });

    it("reports a failed pre-close copy and keeps the runner usable", async () => {
        scripts = [
            {},
            {
                importSnapshot: () => {
                    throw new Error("import broke");
                },
            },
        ];
        const r = await make();
        await r.onBarClose(BARS[0] as AlertBar);
        await expect(r.onPreClose(BARS[1] as AlertBar, 0)).rejects.toMatchObject({
            code: "snapshot-unavailable",
            message: "pre-close copy failed: import broke",
        });
        await expect(r.onBarClose(BARS[1] as AlertBar)).resolves.toEqual([]);
    });

    it("keeps an AlertRunnerError from the pre-close copy", async () => {
        scripts = [
            {},
            {
                importSnapshot: () => {
                    throw new QuickJsStepAbortedError("never", "time");
                },
            },
        ];
        const r = await make();
        await r.onBarClose(BARS[0] as AlertBar);
        await expect(r.onPreClose(BARS[1] as AlertBar, 0)).rejects.toMatchObject({
            code: "snapshot-unavailable",
        });
        scripts = [
            {
                load: () => {
                    throw new Error("no wasm");
                },
            },
        ];
        await expect(r.onPreClose(BARS[1] as AlertBar, 0)).rejects.toMatchObject({
            code: "load-failed",
        });
        // A replay that aborts inside the copy keeps its own code.
        const lossy = await createAlertRunner({
            compiled: await compiled(CROSS),
            interval: "1h",
            frequency: "every_time",
        });
        await lossy.onBarClose(BARS[0] as AlertBar);
        scripts = [
            {
                drain: () => {
                    throw new QuickJsStepAbortedError("replay cut", "steps");
                },
            },
        ];
        await expect(lossy.onPreClose(BARS[1] as AlertBar, 0)).rejects.toMatchObject({
            code: "aborted",
            reason: "steps",
        });
        await expect(lossy.onBarClose(BARS[1] as AlertBar)).resolves.toEqual([]);
    });

    it("rethrows a non-snapshot import error during restore", async () => {
        const first = await make();
        const stored = await first.exportSnapshot();
        scripts = [
            {
                importSnapshot: () => {
                    throw new RangeError("wasm trap");
                },
            },
        ];
        await expect(make({ snapshot: stored })).rejects.toThrow(RangeError);
    });

    it("restores the cooldown with the gate state", async () => {
        const first = await make({ cooldownBars: 2 });
        const stored = await first.exportSnapshot();
        scripts = [{ importSnapshot: () => undefined }];
        const r = await make({ cooldownBars: 2, snapshot: stored });
        expect(r.snapshotStatus).toBe("restored");
        scripts = [
            {
                importSnapshot: () => {
                    throw new SnapshotError("refused");
                },
            },
        ];
        expect((await make({ cooldownBars: 2, snapshot: stored })).snapshotStatus).toBe("invalid");
    });

    it("sends the warm-up window once, then one value per bar (O(1)), and replays both", async () => {
        const main: unknown[] = [];
        const scratch: unknown[] = [];
        scripts = [
            { setExternalSeries: (f) => main.push(f) },
            { setExternalSeries: (f) => scratch.push(f) },
        ];
        const r = await createAlertRunner({
            compiled: await compiled(CONSUMER),
            interval: "1h",
            frequency: "every_time",
            externalSeries: { names: ["signal"] },
            warmUpChunkBars: 2,
        });
        const bars = walk(8);
        await r.warmUp(bars.slice(0, 3), { externalSeries: { signal: [1, 2, 3] } });
        await r.onBarClose(bars[3] as AlertBar, { externalSeries: { signal: 4 } });
        await r.onBarClose(bars[4] as AlertBar);
        await r.onBarClose(bars[4] as AlertBar, { externalSeries: { signal: 9 } });
        await r.onBarClose(bars[5] as AlertBar, { externalSeries: { signal: 6 } });
        const windows = [
            { "producer-feed": { values: [1, 2, 3], offset: 0 } },
            { "producer-feed": { values: [4], offset: 3 } },
            { "producer-feed": { values: [Number.NaN], offset: 4 } },
            { "producer-feed": { values: [6], offset: 5 } },
        ];
        expect(main).toEqual(windows);
        await r.onPreClose(bars[6] as AlertBar, 0, { externalSeries: { signal: 7 } });
        expect(scratch).toEqual([...windows, { "producer-feed": { values: [7], offset: 6 } }]);
        expect(main).toHaveLength(4);
    });
});
