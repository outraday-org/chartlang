// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type RecordedCall, hashCallLog } from "@invinite-org/chartlang-adapter-kit/canvas";

import type {
    ArcConfig,
    GroupConfig,
    KonvaGroup,
    KonvaLayer,
    KonvaNamespace,
    KonvaNode,
    KonvaStage,
    LineConfig,
    PathConfig,
    RectConfig,
    StageConfig,
    TextConfig,
} from "./types.js";

/**
 * The concrete node type a {@link RecordedNode} represents — the Konva
 * constructor it stands in for.
 *
 * @since 1.4
 * @stable
 * @example
 *     const t: RecordedNodeType = "Rect";
 *     void t;
 */
export type RecordedNodeType =
    | "Stage"
    | "Layer"
    | "Group"
    | "Rect"
    | "Line"
    | "Text"
    | "Arc"
    | "Path";

/**
 * One node recorded by {@link MockKonva}. Carries the constructor type,
 * the config bag it was built with, and (for containers) the children
 * added to it — so tests assert the scene-graph tree structurally
 * ("assert the node tree, not pixels"). Non-visual lifecycle ops
 * (`add` / `destroy` / `destroyChildren` / `batchDraw`) are recorded in
 * {@link MockKonva.ops} rather than on the node.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const node: RecordedNode;
 *     // node.type === "Rect"; node.config.fill === "#26a69a"
 *     void node;
 */
export type RecordedNode = {
    readonly type: RecordedNodeType;
    readonly config: Readonly<Record<string, unknown>>;
    readonly children: ReadonlyArray<RecordedNode>;
};

/**
 * One non-visual lifecycle op recorded by {@link MockKonva}, in call
 * order. These carry no drawing geometry, so they are excluded from the
 * {@link MockKonva.toRecordedCallLog} hash projection and asserted
 * structurally instead.
 *
 * @since 1.4
 * @stable
 * @example
 *     const op: RecordedOp = { op: "batchDraw", on: "Layer" };
 *     void op;
 */
export type RecordedOp = {
    readonly op: "add" | "destroy" | "destroyChildren" | "batchDraw";
    readonly on: RecordedNodeType;
};

type MutableRecordedNode = {
    readonly type: RecordedNodeType;
    readonly config: Readonly<Record<string, unknown>>;
    readonly children: MutableRecordedNode[];
};

/**
 * Project one recorded node into genuine canvas `RecordedCall` values so
 * the shared {@link hashCallLog} (which canonicalises floats to 4 dp) can
 * hash the Konva node tree. Non-drawable nodes (Stage / Layer / Group)
 * carry no geometry and contribute nothing. This builds REAL
 * `RecordedCall` objects — no `as` cast — so the float rounding applies
 * and typecheck passes against the closed canvas union. Exported so the
 * projection can be unit-tested against hand-built recorded nodes,
 * including the loosely-typed config edge cases the recorder's typed
 * constructors never produce.
 *
 * @since 1.4
 * @stable
 * @example
 *     const calls = projectNode({ type: "Rect", config: { x: 0, y: 0, width: 1, height: 1 }, children: [] });
 *     // calls[0] === { kind: "set", prop: "fillStyle", value: "" }
 *     void calls;
 */
export function projectNode(node: RecordedNode): RecordedCall[] {
    switch (node.type) {
        case "Rect":
            return projectRect(node.config);
        case "Line":
            return projectLine(node.config);
        case "Text":
            return projectText(node.config);
        case "Arc":
            return projectArc(node.config);
        case "Path":
            return projectPath(node.config);
        case "Stage":
        case "Layer":
        case "Group":
            return [];
    }
}

function num(config: Readonly<Record<string, unknown>>, key: string): number {
    const v = config[key];
    return typeof v === "number" ? v : 0;
}

function str(config: Readonly<Record<string, unknown>>, key: string): string {
    const v = config[key];
    return typeof v === "string" ? v : "";
}

// Narrow a loosely-typed recorded `points` field to the flat numeric
// coordinate array MockKonva stores for a `Line`. A non-array, or a
// non-numeric entry, is dropped — the recorded config is `unknown`, so the
// projection stays robust even though the typed `Line` constructor only
// ever stores numbers. Exercised directly by `projectNode`'s unit tests.
function numberArray(value: unknown): ReadonlyArray<number> {
    return Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];
}

function projectRect(config: Readonly<Record<string, unknown>>): RecordedCall[] {
    return [
        { kind: "set", prop: "fillStyle", value: str(config, "fill") },
        {
            kind: "fillRect",
            x: num(config, "x"),
            y: num(config, "y"),
            w: num(config, "width"),
            h: num(config, "height"),
        },
    ];
}

function projectLine(config: Readonly<Record<string, unknown>>): RecordedCall[] {
    const calls: RecordedCall[] = [];
    const stroke = config.stroke;
    const fill = config.fill;
    if (typeof stroke === "string") {
        calls.push({ kind: "set", prop: "strokeStyle", value: stroke });
        calls.push({ kind: "set", prop: "lineWidth", value: num(config, "strokeWidth") });
    }
    const dash = config.dash;
    if (Array.isArray(dash)) {
        const segments = dash.filter((d): d is number => typeof d === "number");
        calls.push({ kind: "setLineDash", segments });
    }
    if (typeof fill === "string") {
        calls.push({ kind: "set", prop: "fillStyle", value: fill });
    }
    calls.push({ kind: "beginPath" });
    // The recorded config is loosely typed (`unknown`); narrow to the flat
    // numeric coordinate array MockKonva always stores for a `Line`.
    const points = numberArray(config.points);
    for (let i = 0; i + 1 < points.length; i += 2) {
        calls.push(
            i === 0
                ? { kind: "moveTo", x: points[i], y: points[i + 1] }
                : { kind: "lineTo", x: points[i], y: points[i + 1] },
        );
    }
    if (config.closed === true) {
        calls.push({ kind: "closePath" });
        if (typeof fill === "string") calls.push({ kind: "fill" });
    }
    if (typeof stroke === "string") calls.push({ kind: "stroke" });
    return calls;
}

function projectText(config: Readonly<Record<string, unknown>>): RecordedCall[] {
    return [
        {
            kind: "set",
            prop: "font",
            value: `${num(config, "fontSize")}px ${str(config, "fontFamily")}`,
        },
        { kind: "set", prop: "textAlign", value: str(config, "align") },
        { kind: "set", prop: "textBaseline", value: str(config, "verticalAlign") },
        { kind: "set", prop: "fillStyle", value: str(config, "fill") },
        { kind: "fillText", text: str(config, "text"), x: num(config, "x"), y: num(config, "y") },
    ];
}

const DEG_TO_RAD = Math.PI / 180;

// Project a Konva `Arc` (full-circle ring) into the canvas `arc` call its
// geometry maps to. Konva's `rotation` / `angle` are DEGREES; the canvas
// `arc` start / end are RADIANS, so they are converted back so the hash is
// expressed in the same unit as the IR.
function projectArc(config: Readonly<Record<string, unknown>>): RecordedCall[] {
    const calls: RecordedCall[] = [];
    const stroke = config.stroke;
    const fill = config.fill;
    if (typeof stroke === "string") {
        calls.push({ kind: "set", prop: "strokeStyle", value: stroke });
        calls.push({ kind: "set", prop: "lineWidth", value: num(config, "strokeWidth") });
    }
    if (typeof fill === "string") calls.push({ kind: "set", prop: "fillStyle", value: fill });
    calls.push({ kind: "beginPath" });
    const start = num(config, "rotation") * DEG_TO_RAD;
    calls.push({
        kind: "arc",
        x: num(config, "x"),
        y: num(config, "y"),
        radius: num(config, "outerRadius"),
        start,
        end: start + num(config, "angle") * DEG_TO_RAD,
    });
    calls.push({ kind: "closePath" });
    if (typeof fill === "string") calls.push({ kind: "fill" });
    if (typeof stroke === "string") calls.push({ kind: "stroke" });
    return calls;
}

// Project a Konva `Path` (partial-arc SVG) into a path of `moveTo` /
// `lineTo` calls over the numeric coordinates the `data` string carries —
// the start / end anchor points plus the arc-command radii. The numbers
// ARE the geometry (distinct arcs differ in them), so the projection stays
// meaningful and float-rounded without an SVG parser. A non-string `data`
// (the loosely-typed config edge case) contributes no coordinates.
function projectPath(config: Readonly<Record<string, unknown>>): RecordedCall[] {
    const calls: RecordedCall[] = [];
    const stroke = config.stroke;
    const fill = config.fill;
    if (typeof stroke === "string") {
        calls.push({ kind: "set", prop: "strokeStyle", value: stroke });
        calls.push({ kind: "set", prop: "lineWidth", value: num(config, "strokeWidth") });
    }
    if (typeof fill === "string") calls.push({ kind: "set", prop: "fillStyle", value: fill });
    calls.push({ kind: "beginPath" });
    const data = config.data;
    const numbers =
        typeof data === "string" ? (data.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number) : [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
        calls.push(
            i === 0
                ? { kind: "moveTo", x: numbers[i], y: numbers[i + 1] }
                : { kind: "lineTo", x: numbers[i], y: numbers[i + 1] },
        );
    }
    calls.push({ kind: "closePath" });
    if (typeof fill === "string") calls.push({ kind: "fill" });
    if (typeof stroke === "string") calls.push({ kind: "stroke" });
    return calls;
}

/**
 * Headless Konva stand-in. Its `Stage` / `Layer` / `Group` / `Rect` /
 * `Line` / `Text` constructors build {@link RecordedNode}s that record
 * their config + child tree + lifecycle ops, so the adapter can be
 * driven without `node-canvas`, a real browser, or the native `canvas`
 * dependency — exactly mirroring the canvas2d reference adapter's
 * "no native canvas" invariant.
 *
 * `roots` holds every constructed node in creation order; `ops` holds the
 * non-visual lifecycle calls. {@link MockKonva.toRecordedCallLog}
 * projects the drawable nodes into canvas `RecordedCall`s for
 * {@link hashKonvaScene}.
 *
 * @since 1.4
 * @stable
 * @example
 *     const mock = new MockKonva();
 *     const stage = new mock.Stage({ width: 800, height: 400 });
 *     // mock.roots[0].type === "Stage"
 *     void stage;
 */
export class MockKonva implements KonvaNamespace {
    readonly roots: MutableRecordedNode[] = [];
    readonly ops: RecordedOp[] = [];
    // Maps each returned handle back to its recorded node so `add(child)`
    // can attach the child's record without smuggling it on the handle
    // (no `as`-cast back-channel).
    private readonly nodes = new WeakMap<KonvaNode, MutableRecordedNode>();

    // The Konva constructors the adapter `new`s. They are assigned in the
    // constructor as `new`-able class expressions so the type matches
    // `KonvaNamespace`'s `new (...)` signatures (an arrow function is not
    // constructable) while still closing over this instance's recorders.
    readonly Stage: new (
        config: StageConfig,
    ) => KonvaStage;
    readonly Layer: new () => KonvaLayer;
    readonly Group: new (
        config: GroupConfig,
    ) => KonvaGroup;
    readonly Rect: new (
        config: RectConfig,
    ) => KonvaNode;
    readonly Line: new (
        config: LineConfig,
    ) => KonvaNode;
    readonly Text: new (
        config: TextConfig,
    ) => KonvaNode;
    readonly Arc: new (
        config: ArcConfig,
    ) => KonvaNode;
    readonly Path: new (
        config: PathConfig,
    ) => KonvaNode;

    constructor() {
        const record = (
            type: RecordedNodeType,
            config: Readonly<Record<string, unknown>>,
        ): MutableRecordedNode => {
            const node: MutableRecordedNode = { type, config, children: [] };
            this.roots.push(node);
            return node;
        };
        const bind = <T extends KonvaNode>(node: MutableRecordedNode, handle: T): T => {
            this.nodes.set(handle, node);
            return handle;
        };
        const addChild = (parent: MutableRecordedNode, child: KonvaNode): void => {
            this.ops.push({ op: "add", on: parent.type });
            const childNode = this.nodes.get(child);
            if (childNode !== undefined) parent.children.push(childNode);
        };
        const ops = this.ops;

        this.Stage = class implements KonvaStage {
            private readonly node: MutableRecordedNode;
            constructor(config: StageConfig) {
                this.node = record("Stage", { ...config });
                bind(this.node, this);
            }
            add(layer: KonvaLayer): void {
                addChild(this.node, layer);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Stage" });
            }
        };

        this.Layer = class implements KonvaLayer {
            private readonly node: MutableRecordedNode;
            constructor() {
                this.node = record("Layer", {});
                bind(this.node, this);
            }
            add(child: KonvaNode): void {
                addChild(this.node, child);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Layer" });
            }
            destroyChildren(): void {
                ops.push({ op: "destroyChildren", on: "Layer" });
                this.node.children.length = 0;
            }
            batchDraw(): void {
                ops.push({ op: "batchDraw", on: "Layer" });
            }
        };

        this.Group = class implements KonvaGroup {
            private readonly node: MutableRecordedNode;
            constructor(config: GroupConfig) {
                this.node = record("Group", { ...config });
                bind(this.node, this);
            }
            add(child: KonvaNode): void {
                addChild(this.node, child);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Group" });
            }
        };

        this.Rect = class implements KonvaNode {
            constructor(config: RectConfig) {
                bind(record("Rect", { ...config }), this);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Rect" });
            }
        };

        this.Line = class implements KonvaNode {
            constructor(config: LineConfig) {
                bind(record("Line", { ...config, points: [...config.points] }), this);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Line" });
            }
        };

        this.Text = class implements KonvaNode {
            constructor(config: TextConfig) {
                bind(record("Text", { ...config }), this);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Text" });
            }
        };

        this.Arc = class implements KonvaNode {
            constructor(config: ArcConfig) {
                bind(record("Arc", { ...config }), this);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Arc" });
            }
        };

        this.Path = class implements KonvaNode {
            constructor(config: PathConfig) {
                bind(record("Path", { ...config }), this);
            }
            destroy(): void {
                ops.push({ op: "destroy", on: "Path" });
            }
        };
    }

    /**
     * Project every drawable node into canvas `RecordedCall`s, in
     * creation order, for {@link hashKonvaScene}. `roots` already holds
     * every node in creation order, so each is projected directly (children
     * also live in `roots`, so the tree is NOT re-walked — that would
     * double-count).
     *
     * @since 1.4
     * @stable
     * @example
     *     const mock = new MockKonva();
     *     const log = mock.toRecordedCallLog();
     *     // log is a RecordedCall[]
     *     void log;
     */
    toRecordedCallLog(): RecordedCall[] {
        const out: RecordedCall[] = [];
        for (const node of this.roots) {
            for (const call of projectNode(node)) out.push(call);
        }
        return out;
    }
}

/**
 * Hash a {@link MockKonva}'s recorded drawable node tree into a stable
 * SHA-256 hex string by projecting it to canvas `RecordedCall`s and
 * delegating to the shared {@link hashCallLog} (floats rounded to 4 dp).
 * Adapters pin their integration render output against a single golden
 * constant with this.
 *
 * @since 1.4
 * @stable
 * @example
 *     const mock = new MockKonva();
 *     const h = hashKonvaScene(mock);
 *     // h is a 64-char hex string
 *     void h;
 */
export function hashKonvaScene(mock: MockKonva): string {
    return hashCallLog(mock.toRecordedCallLog());
}
