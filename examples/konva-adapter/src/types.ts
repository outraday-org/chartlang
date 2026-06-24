// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Minimal structural slice of the Konva v9 API the adapter depends on.
 *
 * The factory never statically imports `konva` (that pulls the native
 * `canvas` dependency and touches `window`, breaking the headless
 * portability target this package shares with the canvas2d reference
 * adapter). Instead the caller injects a Konva namespace through
 * `opts.konva` — production passes the real `Konva`, tests pass
 * {@link import("./testing").MockKonva}. This file declares the exact
 * surface both must satisfy, so the factory stays decoupled from the
 * full Konva typings and the mock is checked against the same contract.
 *
 * Declarations only — no runtime, so it is excluded from coverage like
 * any `types.ts`.
 */

/**
 * Config bag accepted by the {@link KonvaNamespace} `Rect` constructor.
 * Mirrors the Konva v9 `RectConfig` fields the adapter sets.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: RectConfig = { x: 0, y: 0, width: 4, height: 10, fill: "#26a69a" };
 *     void cfg;
 */
export type RectConfig = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly fill?: string;
    readonly stroke?: string;
    readonly strokeWidth?: number;
    /**
     * Node-level opacity (0–1). The Konva idiom for the canvas reference's
     * `globalAlpha`; the `bg-color` overlay derives it from `transp`
     * (`1 - transp/100`). Omitted ⇒ fully opaque.
     */
    readonly opacity?: number;
    readonly listening?: boolean;
};

/**
 * Config bag accepted by the {@link KonvaNamespace} `Line` constructor.
 * `points` is a flat `[x0, y0, x1, y1, …]` array (Konva's polyline
 * format); `closed` closes the path; `dash` is the dash-segment array.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: LineConfig = { points: [0, 0, 10, 10], stroke: "#3b82f6", strokeWidth: 1 };
 *     void cfg;
 */
export type LineConfig = {
    readonly points: ReadonlyArray<number>;
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly closed?: boolean;
    readonly fill?: string;
    readonly dash?: ReadonlyArray<number>;
    /**
     * Corner / end-cap rendering. Plot lines set `"round"` for both so a
     * polyline's joints and ends read smooth (the Konva idiom for the
     * canvas2d reference's round join/cap on `drawLine`). Omitted ⇒ Konva's
     * default `"miter"` join / `"butt"` cap.
     */
    readonly lineJoin?: "round" | "bevel" | "miter";
    readonly lineCap?: "round" | "square" | "butt";
    readonly listening?: boolean;
};

/**
 * Config bag accepted by the {@link KonvaNamespace} `Text` constructor.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: TextConfig = { x: 10, y: 20, text: "RSI", fontSize: 11, fill: "#e2e8f0" };
 *     void cfg;
 */
export type TextConfig = {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly fontSize: number;
    readonly fontFamily: string;
    readonly fill: string;
    readonly align: "left" | "center" | "right";
    readonly verticalAlign: "top" | "middle" | "bottom";
    readonly listening?: boolean;
};

/**
 * Config bag accepted by the {@link KonvaNamespace} `Arc` constructor —
 * the full-circle / ring case of a
 * {@link import("@invinite-org/chartlang-adapter-kit").DrawPrimitive} `arc`.
 * `innerRadius === outerRadius` draws a thin ring; `angle` / `rotation`
 * are in DEGREES (Konva's unit, unlike the IR's radians). The adapter
 * only emits `K.Arc` for full sweeps (`angle: 360`), so the ring never
 * shows the two radial "wedge" lines a partial Konva arc would.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: ArcConfig = { x: 50, y: 50, innerRadius: 10, outerRadius: 10, angle: 360, rotation: 0 };
 *     void cfg;
 */
export type ArcConfig = {
    readonly x: number;
    readonly y: number;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly angle: number;
    readonly rotation: number;
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly fill?: string;
    readonly dash?: ReadonlyArray<number>;
    readonly listening?: boolean;
};

/**
 * Config bag accepted by the {@link KonvaNamespace} `Path` constructor —
 * the partial-sweep case of a
 * {@link import("@invinite-org/chartlang-adapter-kit").DrawPrimitive} `arc`.
 * `data` is an SVG path-data string (`M … A … Z`); the `A` arc command
 * plus the closing `Z` chord reproduce the canvas
 * `arc(…) + closePath()` shape exactly, which `K.Arc`'s wedge cannot.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: PathConfig = { data: "M 0 0 A 10 10 0 0 1 10 10 Z", stroke: "#3b82f6", strokeWidth: 1 };
 *     void cfg;
 */
export type PathConfig = {
    readonly data: string;
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly fill?: string;
    readonly dash?: ReadonlyArray<number>;
    readonly listening?: boolean;
};

/**
 * Config bag accepted by the {@link KonvaNamespace} `Group` constructor.
 * `x`/`y` translate the group to its pane's pixel origin.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: GroupConfig = { x: 0, y: 320 };
 *     void cfg;
 */
export type GroupConfig = {
    readonly x: number;
    readonly y: number;
};

/**
 * Any Konva node the adapter builds. Carries the one lifecycle method
 * the adapter calls; the concrete node type (Rect / Line / Text / Arc /
 * Path / Group) is tracked by the mock for structural assertions.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const node: KonvaNode;
 *     node.destroy();
 *     void node;
 */
export type KonvaNode = {
    destroy(): void;
};

/**
 * A Konva container node — a `Group` or `Layer`. Accepts child nodes via
 * `add`.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const group: KonvaGroup;
 *     declare const child: KonvaNode;
 *     group.add(child);
 *     void group;
 */
export type KonvaGroup = KonvaNode & {
    add(child: KonvaNode): void;
};

/**
 * A Konva `Layer`: a top-level container the stage paints. The adapter
 * holds a series layer and a drawings layer, both rebuilt every drain via
 * `destroyChildren`.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const layer: KonvaLayer;
 *     layer.destroyChildren();
 *     layer.batchDraw();
 *     void layer;
 */
export type KonvaLayer = KonvaGroup & {
    destroyChildren(): void;
    batchDraw(): void;
};

/**
 * A Konva `Stage`: the root scene-graph node bound to a container. The
 * adapter adds its layers to the stage and destroys the stage on
 * dispose.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const stage: KonvaStage;
 *     declare const layer: KonvaLayer;
 *     stage.add(layer);
 *     stage.destroy();
 *     void stage;
 */
export type KonvaStage = KonvaNode & {
    add(layer: KonvaLayer): void;
};

/**
 * Options the adapter passes to the injected `Stage` constructor.
 * `container` is the DOM-mount seam: when a production caller supplies it,
 * Konva attaches the stage's content `<div>` to that element so the scene
 * is visible. It is OMITTED on the headless path (the `MockKonva` tests),
 * which records or drops the extra key without a real DOM.
 *
 * @since 1.4
 * @stable
 * @example
 *     const cfg: StageConfig = { width: 800, height: 400 };
 *     void cfg;
 */
export type StageConfig = {
    readonly width: number;
    readonly height: number;
    readonly container?: HTMLElement;
};

/**
 * The injected Konva namespace. Production callers pass the real
 * `Konva`; tests pass {@link import("./testing").MockKonva}. Only the
 * constructors the adapter uses are declared.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const konva: KonvaNamespace;
 *     const stage = new konva.Stage({ width: 800, height: 400 });
 *     void stage;
 */
export type KonvaNamespace = {
    readonly Stage: new (config: StageConfig) => KonvaStage;
    readonly Layer: new () => KonvaLayer;
    readonly Group: new (config: GroupConfig) => KonvaGroup;
    readonly Rect: new (config: RectConfig) => KonvaNode;
    readonly Line: new (config: LineConfig) => KonvaNode;
    readonly Text: new (config: TextConfig) => KonvaNode;
    readonly Arc: new (config: ArcConfig) => KonvaNode;
    readonly Path: new (config: PathConfig) => KonvaNode;
};
