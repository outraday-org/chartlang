// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockKonva, hashKonvaScene, projectNode } from "./testing.js";

describe("MockKonva", () => {
    it("records constructed nodes with their config in creation order", () => {
        const k = new MockKonva();
        new k.Stage({ width: 800, height: 400 });
        new k.Layer();
        new k.Group({ x: 0, y: 320 });
        new k.Rect({ x: 1, y: 2, width: 3, height: 4, fill: "#fff" });
        new k.Line({ points: [0, 0, 10, 10], stroke: "#000", strokeWidth: 2 });
        new k.Text({
            x: 5,
            y: 6,
            text: "hi",
            fontSize: 11,
            fontFamily: "sans-serif",
            fill: "#aaa",
            align: "center",
            verticalAlign: "middle",
        });
        expect(k.roots.map((n) => n.type)).toEqual([
            "Stage",
            "Layer",
            "Group",
            "Rect",
            "Line",
            "Text",
        ]);
        expect(k.roots[3].config.fill).toBe("#fff");
    });

    it("attaches children through add and records the op", () => {
        const k = new MockKonva();
        const stage = new k.Stage({ width: 10, height: 10 });
        const layer = new k.Layer();
        const group = new k.Group({ x: 0, y: 0 });
        const rect = new k.Rect({ x: 0, y: 0, width: 1, height: 1, fill: "#000" });
        stage.add(layer);
        layer.add(group);
        group.add(rect);
        expect(k.roots[0].children.map((c) => c.type)).toEqual(["Layer"]);
        expect(k.roots[1].children.map((c) => c.type)).toEqual(["Group"]);
        expect(k.roots[2].children.map((c) => c.type)).toEqual(["Rect"]);
        expect(k.ops.filter((o) => o.op === "add")).toHaveLength(3);
    });

    it("copies the points array so later mutation does not leak in", () => {
        const k = new MockKonva();
        const points = [0, 0, 5, 5];
        new k.Line({ points });
        points[0] = 999;
        expect(k.roots[0].config.points).toEqual([0, 0, 5, 5]);
    });

    it("records destroyChildren (clearing the tree) and batchDraw on a layer", () => {
        const k = new MockKonva();
        const layer = new k.Layer();
        const rect = new k.Rect({ x: 0, y: 0, width: 1, height: 1, fill: "#000" });
        layer.add(rect);
        expect(k.roots[0].children).toHaveLength(1);
        layer.destroyChildren();
        expect(k.roots[0].children).toHaveLength(0);
        layer.batchDraw();
        expect(k.ops).toContainEqual({ op: "destroyChildren", on: "Layer" });
        expect(k.ops).toContainEqual({ op: "batchDraw", on: "Layer" });
    });

    it("records destroy on every node type", () => {
        const k = new MockKonva();
        new k.Stage({ width: 1, height: 1 }).destroy();
        new k.Layer().destroy();
        new k.Group({ x: 0, y: 0 }).destroy();
        new k.Rect({ x: 0, y: 0, width: 1, height: 1, fill: "#000" }).destroy();
        new k.Line({ points: [] }).destroy();
        new k.Text({
            x: 0,
            y: 0,
            text: "",
            fontSize: 1,
            fontFamily: "x",
            fill: "#000",
            align: "left",
            verticalAlign: "top",
        }).destroy();
        new k.Arc({
            x: 0,
            y: 0,
            innerRadius: 1,
            outerRadius: 1,
            angle: 360,
            rotation: 0,
        }).destroy();
        new k.Path({ data: "M 0 0 Z" }).destroy();
        const destroyed = k.ops.filter((o) => o.op === "destroy").map((o) => o.on);
        expect(destroyed).toEqual([
            "Stage",
            "Layer",
            "Group",
            "Rect",
            "Line",
            "Text",
            "Arc",
            "Path",
        ]);
    });

    it("records constructed Arc and Path nodes with their config", () => {
        const k = new MockKonva();
        new k.Arc({
            x: 5,
            y: 6,
            innerRadius: 4,
            outerRadius: 4,
            angle: 360,
            rotation: 0,
            stroke: "#14b8a6",
            strokeWidth: 1,
        });
        new k.Path({ data: "M 0 0 A 10 10 0 0 1 10 10 Z", stroke: "#3b82f6" });
        expect(k.roots.map((n) => n.type)).toEqual(["Arc", "Path"]);
        expect(k.roots[0].config).toMatchObject({ innerRadius: 4, outerRadius: 4, angle: 360 });
        expect(k.roots[1].config.data).toBe("M 0 0 A 10 10 0 0 1 10 10 Z");
    });
});

describe("toRecordedCallLog / hashKonvaScene", () => {
    it("projects a Rect into fillStyle + fillRect", () => {
        const k = new MockKonva();
        new k.Rect({ x: 1, y: 2, width: 3, height: 4, fill: "#abc" });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "fillStyle", value: "#abc" },
            { kind: "fillRect", x: 1, y: 2, w: 3, h: 4 },
        ]);
    });

    it("brackets a translucent Rect's fill in globalAlpha set calls", () => {
        const k = new MockKonva();
        new k.Rect({ x: 1, y: 2, width: 3, height: 4, fill: "#abc", opacity: 0.15 });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "globalAlpha", value: 0.15 },
            { kind: "set", prop: "fillStyle", value: "#abc" },
            { kind: "fillRect", x: 1, y: 2, w: 3, h: 4 },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("omits globalAlpha for a fully-opaque Rect (byte-identical projection)", () => {
        const k = new MockKonva();
        new k.Rect({ x: 1, y: 2, width: 3, height: 4, fill: "#abc", opacity: 1 });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "fillStyle", value: "#abc" },
            { kind: "fillRect", x: 1, y: 2, w: 3, h: 4 },
        ]);
    });

    it("projects a stroked open Line into moveTo/lineTo + stroke", () => {
        const k = new MockKonva();
        new k.Line({ points: [0, 0, 10, 10], stroke: "#000", strokeWidth: 2 });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#000" },
            { kind: "set", prop: "lineWidth", value: 2 },
            { kind: "beginPath" },
            { kind: "moveTo", x: 0, y: 0 },
            { kind: "lineTo", x: 10, y: 10 },
            { kind: "stroke" },
        ]);
    });

    it("projects a dashed Line with a setLineDash call", () => {
        const k = new MockKonva();
        new k.Line({ points: [0, 0, 1, 1], stroke: "#000", strokeWidth: 1, dash: [6, 4] });
        expect(k.toRecordedCallLog()).toContainEqual({ kind: "setLineDash", segments: [6, 4] });
    });

    it("projects a closed filled Line into closePath + fill", () => {
        const k = new MockKonva();
        new k.Line({ points: [0, 0, 10, 0, 10, 10], closed: true, fill: "#0f0" });
        const log = k.toRecordedCallLog();
        expect(log).toContainEqual({ kind: "set", prop: "fillStyle", value: "#0f0" });
        expect(log).toContainEqual({ kind: "closePath" });
        expect(log).toContainEqual({ kind: "fill" });
    });

    it("projects a Text into font/align/baseline/fillStyle + fillText", () => {
        const k = new MockKonva();
        new k.Text({
            x: 5,
            y: 6,
            text: "RSI",
            fontSize: 11,
            fontFamily: "sans-serif",
            fill: "#eee",
            align: "center",
            verticalAlign: "middle",
        });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "font", value: "11px sans-serif" },
            { kind: "set", prop: "textAlign", value: "center" },
            { kind: "set", prop: "textBaseline", value: "middle" },
            { kind: "set", prop: "fillStyle", value: "#eee" },
            { kind: "fillText", text: "RSI", x: 5, y: 6 },
        ]);
    });

    it("ignores container nodes (Stage/Layer/Group) in the projection", () => {
        const k = new MockKonva();
        new k.Stage({ width: 1, height: 1 });
        new k.Layer();
        new k.Group({ x: 0, y: 0 });
        expect(k.toRecordedCallLog()).toEqual([]);
    });

    it("defaults missing numeric/string config to 0 / empty without throwing", () => {
        const k = new MockKonva();
        // A Line with no points / stroke / fill — projects to beginPath only.
        new k.Line({ points: [] });
        expect(k.toRecordedCallLog()).toEqual([{ kind: "beginPath" }]);
    });

    it("skips a trailing odd point coordinate", () => {
        const k = new MockKonva();
        new k.Line({ points: [0, 0, 5], stroke: "#000", strokeWidth: 1 });
        const moves = k
            .toRecordedCallLog()
            .filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        expect(moves).toEqual([{ kind: "moveTo", x: 0, y: 0 }]);
    });

    it("defaults a missing fill / strokeWidth to empty / 0 (loose config)", () => {
        // Hand-built recorded nodes exercise the loosely-typed config
        // fallbacks the recorder's typed constructors never produce.
        expect(
            projectNode({
                type: "Rect",
                config: { x: 0, y: 0, width: 1, height: 1 },
                children: [],
            }),
        ).toEqual([
            { kind: "set", prop: "fillStyle", value: "" },
            { kind: "fillRect", x: 0, y: 0, w: 1, h: 1 },
        ]);
        const line = projectNode({
            type: "Line",
            config: { points: [0, 0, 1, 1], stroke: "#000" },
            children: [],
        });
        expect(line).toContainEqual({ kind: "set", prop: "lineWidth", value: 0 });
    });

    it("drops a non-array points field and non-numeric point entries", () => {
        expect(projectNode({ type: "Line", config: { points: "nope" }, children: [] })).toEqual([
            { kind: "beginPath" },
        ]);
        const mixed = projectNode({
            type: "Line",
            config: { points: [0, 0, "x", 5], stroke: "#000", strokeWidth: 1 },
            children: [],
        });
        // The "x" is dropped, leaving [0, 0, 5] → one moveTo only (the
        // trailing odd 5 has no pair).
        const coords = mixed.filter((c) => c.kind === "moveTo" || c.kind === "lineTo");
        expect(coords).toEqual([{ kind: "moveTo", x: 0, y: 0 }]);
    });

    it("projects a stroked + filled Arc into an arc call (degrees → radians)", () => {
        const k = new MockKonva();
        new k.Arc({
            x: 5,
            y: 6,
            innerRadius: 4,
            outerRadius: 4,
            angle: 360,
            rotation: 0,
            stroke: "#14b8a6",
            strokeWidth: 2,
            fill: "#000",
        });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#14b8a6" },
            { kind: "set", prop: "lineWidth", value: 2 },
            { kind: "set", prop: "fillStyle", value: "#000" },
            { kind: "beginPath" },
            { kind: "arc", x: 5, y: 6, radius: 4, start: 0, end: Math.PI * 2 },
            { kind: "closePath" },
            { kind: "fill" },
            { kind: "stroke" },
        ]);
    });

    it("projects a style-less Arc to just the arc path", () => {
        const k = new MockKonva();
        new k.Arc({ x: 0, y: 0, innerRadius: 1, outerRadius: 1, angle: 360, rotation: 0 });
        expect(k.toRecordedCallLog()).toEqual([
            { kind: "beginPath" },
            { kind: "arc", x: 0, y: 0, radius: 1, start: 0, end: Math.PI * 2 },
            { kind: "closePath" },
        ]);
    });

    it("projects a Path's SVG numbers into moveTo/lineTo with stroke + fill", () => {
        const k = new MockKonva();
        new k.Path({
            data: "M 10 0 A 10 10 0 0 1 0 10 Z",
            stroke: "#3b82f6",
            strokeWidth: 1,
            fill: "#dbeafe",
        });
        const log = k.toRecordedCallLog();
        expect(log[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(log).toContainEqual({ kind: "set", prop: "fillStyle", value: "#dbeafe" });
        // First number-pair → moveTo; subsequent pairs → lineTo.
        expect(log).toContainEqual({ kind: "moveTo", x: 10, y: 0 });
        expect(log).toContainEqual({ kind: "closePath" });
        expect(log).toContainEqual({ kind: "fill" });
        expect(log.at(-1)).toEqual({ kind: "stroke" });
    });

    it("projects a Path with non-string data to an empty path", () => {
        expect(projectNode({ type: "Path", config: { data: 5 }, children: [] })).toEqual([
            { kind: "beginPath" },
            { kind: "closePath" },
        ]);
    });

    it("projects a Path with a numberless data string to an empty path (no match)", () => {
        // `data.match(/…/g)` returns null when no numbers are present → the
        // `?? []` fallback applies; no moveTo/lineTo is emitted.
        expect(projectNode({ type: "Path", config: { data: "M Z" }, children: [] })).toEqual([
            { kind: "beginPath" },
            { kind: "closePath" },
        ]);
    });

    it("hashes the scene to a stable 64-char hex string", () => {
        const k = new MockKonva();
        new k.Rect({ x: 0, y: 0, width: 4, height: 10, fill: "#26a69a" });
        const h = hashKonvaScene(k);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
        // Determinism: an identical scene hashes identically.
        const k2 = new MockKonva();
        new k2.Rect({ x: 0, y: 0, width: 4, height: 10, fill: "#26a69a" });
        expect(hashKonvaScene(k2)).toBe(h);
    });
});
