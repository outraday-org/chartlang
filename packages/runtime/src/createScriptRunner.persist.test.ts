// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, StateStoreKey } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner";
import { inMemoryPersistentStateStore } from "./persistentStateStore";
import type { PersistentStateStore } from "./persistentStateStore";
import { ACTIVE_RUNTIME_CONTEXT } from "./runtimeContext";
import { StateSlot } from "./state";

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
        maxLookback: 50,
        maxTickHz: 10,
    };
}

function key(): StateStoreKey {
    return {
        scriptHash: "script",
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "caps",
        symbol: "AAPL",
        mainInterval: "1m",
        requestedIntervals: [],
    };
}

function makeBar(i: number): Bar {
    const open = 100 + i;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open,
        high: open + 2,
        low: open - 2,
        close: open + 1,
        volume: 1_000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

function withLookback<T extends ReturnType<typeof defineIndicator>>(compiled: T): T {
    return {
        ...compiled,
        manifest: { ...compiled.manifest, maxLookback: 50 },
    };
}

describe("createScriptRunner persistence", () => {
    it("warmStart no-ops when no persistent store is configured", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "no-store",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
            },
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
        });
        await runner.warmStart(makeBar(0).time);
        await runner.onBarClose(makeBar(0));
        expect(seen).toEqual([101]);
    });

    it("loads a saved snapshot before new bars and skips caller-side history replay", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "restore-stream",
            apiVersion: 1,
            compute: () => {},
        });
        const cold = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1_700_000_120_000,
        });
        await cold.onHistory(Array.from({ length: 10 }, (_unused, i) => makeBar(i)));
        await cold.dispose();
        const saved = await store.load();
        expect(saved?.streams["1m"]?.filled).toBe(10);

        const observedPrevious: number[] = [];
        const warmCompiled = defineIndicator({
            name: "restore-stream",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx !== null) {
                    observedPrevious.push(ctx.stream.seriesViews.close[1]);
                }
            },
        });
        const warm = createScriptRunner({
            compiled: withLookback(warmCompiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await warm.warmStart(makeBar(10).time);
        await warm.onBarClose(makeBar(10));
        await warm.onBarClose(makeBar(11));

        expect(observedPrevious).toEqual([110, 111]);
        expect(warm.drain().diagnostics).toEqual([]);
    });

    it("warmStart ignores malformed loaded snapshots", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return JSON.parse('{"snapshotVersion":2}');
            },
            async save() {},
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "malformed-load",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 60_000,
            now: () => 0,
        });

        await runner.warmStart(makeBar(0).time);

        expect(runner.drain().diagnostics).toEqual([]);
    });

    it("warmStart tolerates valid snapshots with no stream entries", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return {
                    lastBarTime: makeBar(0).time,
                    streams: {},
                    slots: {},
                    savedAt: 1,
                    snapshotVersion: 1,
                };
            },
            async save() {},
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "no-stream",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 60_000,
            now: () => 0,
        });

        await runner.warmStart(makeBar(1).time);

        expect(runner.drain().diagnostics.map((d) => d.code)).toEqual(["state-snapshot-restored"]);
    });

    it("warmStart can restore a matching direct stream interval", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "direct-stream",
            apiVersion: 1,
            compute: () => {},
        });
        const source = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1_700_000_120_000,
        });
        await source.onHistory([makeBar(0), makeBar(1)]);
        await source.dispose();

        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 60_000,
            now: () => 0,
        });
        await runner.onBarClose(makeBar(20));
        await runner.warmStart(makeBar(2).time);

        expect(runner.drain().diagnostics.map((d) => d.code)).toEqual(["state-snapshot-restored"]);
    });

    it("clears future-dated snapshots and emits a diagnostic", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "future",
            apiVersion: 1,
            compute: () => {},
        });
        const source = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1_700_000_120_000,
        });
        await source.onBarClose(makeBar(4));
        await source.dispose();

        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });
        await runner.warmStart(makeBar(4).time);

        expect(runner.drain().diagnostics.map((d) => d.code)).toEqual([
            "state-snapshot-future-dated",
        ]);
        expect(await store.load()).toBeNull();
    });

    it("emits a diagnostic when clearing a future-dated snapshot fails", async () => {
        const source = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "future-clear-fail",
            apiVersion: 1,
            compute: () => {},
        });
        const seed = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: source,
            now: () => 1_700_000_120_000,
        });
        await seed.onBarClose(makeBar(3));
        await seed.dispose();
        const saved = await source.load();
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return saved;
            },
            async save() {},
            async clear() {
                throw new Error("clear failed");
            },
        };
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });

        await runner.warmStart(makeBar(3).time);

        expect(runner.drain().diagnostics.map((d) => d.code)).toEqual([
            "state-snapshot-future-dated",
            "state-snapshot-save-failed",
        ]);
    });

    it("stringifies non-Error future-dated clear failures", async () => {
        const source = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "future-clear-string",
            apiVersion: 1,
            compute: () => {},
        });
        const seed = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: source,
            now: () => 1_700_000_120_000,
        });
        await seed.onBarClose(makeBar(3));
        await seed.dispose();
        const saved = await source.load();
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return saved;
            },
            async save() {},
            async clear() {
                throw "clear failed";
            },
        };
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });

        await runner.warmStart(makeBar(3).time);

        expect(runner.drain().diagnostics[1]?.message).toBe("clear failed");
    });

    it("saves after the configured wall-clock cadence on close", async () => {
        const saves: number[] = [];
        let currentTime = 0;
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save(snapshot) {
                saves.push(snapshot.savedAt);
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "cadence",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 60_000,
            now: () => currentTime,
        });

        await runner.onBarClose(makeBar(0));
        currentTime = 60_000;
        await runner.onBarClose(makeBar(1));

        expect(saves).toEqual([60_000]);
    });

    it("dispose flushes one final snapshot", async () => {
        let saveCount = 0;
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save() {
                saveCount += 1;
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "dispose-save",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 60_000,
            now: () => 0,
        });
        await runner.onBarClose(makeBar(0));
        await runner.dispose();
        expect(saveCount).toBe(1);
    });

    it("drops malformed slot snapshots and emits a diagnostic", async () => {
        let saveCount = 0;
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save() {
                saveCount += 1;
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "malformed",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx !== null) {
                    ctx.stateSlots.set("bad:state", new StateSlot(() => 1, false));
                }
            },
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 0,
            now: () => 1,
        });

        await runner.onBarClose(makeBar(0));

        expect(saveCount).toBe(0);
        expect(runner.drain().diagnostics.map((d) => d.code)).toEqual(["state-snapshot-malformed"]);
    });

    it("emits a diagnostic when persistent save rejects", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save() {
                throw "save failed";
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "save-fail",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 0,
            now: () => 1,
        });

        await runner.onBarClose(makeBar(0));

        const diagnostics = runner.drain().diagnostics;
        expect(diagnostics.map((d) => d.code)).toEqual(["state-snapshot-save-failed"]);
        expect(diagnostics[0]?.message).toBe("save failed");
    });

    it("uses Error messages when persistent save rejects with Error", async () => {
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save() {
                throw new Error("save error");
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "save-error",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            persistenceIntervalMs: 0,
            now: () => 1,
        });

        await runner.onBarClose(makeBar(0));

        expect(runner.drain().diagnostics[0]?.message).toBe("save error");
    });

    it("dispose before the first bar saves an empty main snapshot", async () => {
        let streamKey = "";
        const store: PersistentStateStore = {
            key: key(),
            async load() {
                return null;
            },
            async save(snapshot) {
                streamKey = Object.keys(snapshot.streams)[0] ?? "";
            },
            async clear() {},
        };
        const compiled = defineIndicator({
            name: "empty-dispose",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled: withLookback(compiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });

        await runner.dispose();

        expect(streamKey).toBe("main");
    });

    it("saves and restores registered secondary stream snapshots", async () => {
        const store = inMemoryPersistentStateStore({ key: key() });
        const compiled = defineIndicator({
            name: "secondary-persist",
            apiVersion: 1,
            compute: () => {},
        });
        const customCompiled = {
            manifest: { ...compiled.manifest, requestedIntervals: ["1D"] },
            compute: compiled.compute,
        };
        const source = createScriptRunner({
            compiled: withLookback(customCompiled),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
            now: () => 1,
        });
        await source.push({
            kind: "close",
            bar: { ...makeBar(0), interval: "1D", close: 201 },
            streamKey: "1D",
        });
        await source.onBarClose(makeBar(0));
        await source.dispose();
        const saved = await store.load();
        expect(saved?.streams["1D"]?.buffers.close[0]).toBe(201);

        const observed: number[] = [];
        const warmCompiled = defineIndicator({
            name: "secondary-persist",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                const daily = ctx?.secondaryStreams.get("1D");
                if (daily !== undefined) observed.push(daily.seriesViews.close.current);
            },
        });
        const warm = createScriptRunner({
            compiled: withLookback({
                manifest: { ...warmCompiled.manifest, requestedIntervals: ["1D"] },
                compute: warmCompiled.compute,
            }),
            capabilities: makeCapabilities(),
            persistentStateStore: store,
        });

        await warm.warmStart(makeBar(1).time);
        await warm.onBarClose(makeBar(1));

        expect(observed).toEqual([201]);
    });
});
