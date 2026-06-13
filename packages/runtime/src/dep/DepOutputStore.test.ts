// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createDepOutputStore } from "./DepOutputStore.js";

describe("createDepOutputStore", () => {
    it("pushes and reads the head value", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        store.beginBar();
        store.push("p", "x", 42);
        expect(store.read("p", "x").current).toBe(42);
    });

    it("returns a stable Series identity across bars", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        const series = store.read("p", "x");
        store.beginBar();
        store.push("p", "x", 1);
        const sameSeries = store.read("p", "x");
        expect(sameSeries).toBe(series);
        expect(series.current).toBe(1);
    });

    it("supports lookback via series indexing", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        store.beginBar();
        store.push("p", "x", 1);
        store.beginBar();
        store.push("p", "x", 2);
        store.beginBar();
        store.push("p", "x", 3);
        const series = store.read("p", "x");
        expect(series.current).toBe(3);
        expect(series[1]).toBe(2);
        expect(series[2]).toBe(1);
    });

    it("deduplicates duplicate declarations", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }, { title: "x" }] }],
            capacity: 4,
        });
        store.push("p", "x", 7);
        expect(store.read("p", "x").current).toBe(7);
    });

    it("clamps capacity to at least 1", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 0,
        });
        store.push("p", "x", 9);
        expect(store.read("p", "x").current).toBe(9);
    });

    it("throws when reading an undeclared output", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        expect(() => store.read("p", "missing")).toThrowError(/not declared/);
    });

    it("throws when pushing an undeclared output", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        expect(() => store.push("p", "missing", 1)).toThrowError(/not declared/);
    });

    it("dispose empties buffers and rejects subsequent reads", () => {
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        store.push("p", "x", 1);
        store.dispose();
        expect(() => store.read("p", "x")).toThrowError(/not declared/);
    });

    it("supports multiple producers and titles in isolation", () => {
        const store = createDepOutputStore({
            producers: [
                { producerId: "a", outputs: [{ title: "x" }, { title: "y" }] },
                { producerId: "b", outputs: [{ title: "x" }] },
            ],
            capacity: 4,
        });
        store.push("a", "x", 1);
        store.push("a", "y", 2);
        store.push("b", "x", 3);
        expect(store.read("a", "x").current).toBe(1);
        expect(store.read("a", "y").current).toBe(2);
        expect(store.read("b", "x").current).toBe(3);
    });
});
