// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The canonical chartlang repository URL. GitHub deep links for each
 * adapter (folder / README / conformance) are derived from this plus the
 * entry's `exampleDir` — never stored per-entry — so a repo move is a
 * one-line change here.
 */
export const REPO_URL = "https://github.com/outraday-org/chartlang";

/**
 * How an adapter paints chartlang's drawing surface onto its library:
 *
 * - `ctx` — an immediate-mode 2D canvas context (raw `CanvasRenderingContext2D`).
 * - `nodes` — a retained-mode scene-graph (one node per primitive).
 * - `graphic` — a declarative graphic component (descriptor objects).
 * - `native-ctx` — the library owns series/panes natively; drawings overlay
 *   through a context handed to a primitive plugin.
 * - `gl` — the adapter uploads decomposed geometry to GPU programs and
 *   paints text through a 2D-canvas overlay.
 */
export type AdapterStrategy = "ctx" | "nodes" | "graphic" | "native-ctx" | "gl";

/**
 * One hand-maintained adapter entry — the single source of truth for the
 * `add-adapter` installer matrix and (Task 15) the docs gallery. Adding an
 * adapter means appending one entry here (and re-running the generator).
 *
 * @since 1.3
 */
export type AdapterRegistryEntry = {
    /** The `add-adapter <id>` argument and generated-bundle key. */
    readonly id: string;
    /** Folder under the repo root, e.g. `examples/konva-adapter`. */
    readonly exampleDir: string;
    /** Human-readable name for the matrix, e.g. `Konva`. */
    readonly displayName: string;
    /** The npm package the adapter renders to, e.g. `konva`. */
    readonly library: string;
    /** The peer version range the example pins, e.g. `^9`. */
    readonly libraryRange: string;
    /** The rendering library's license, e.g. `MIT`. */
    readonly license: string;
    /** One-line rendering technology, e.g. `Scene-graph (Canvas)`. */
    readonly renderTech: string;
    /** How the adapter paints the drawing surface. */
    readonly strategy: AdapterStrategy;
    /** Every adapter ships the full 63-drawing + all-plot surface. */
    readonly fullSurface: true;
    /** Hand-maintained bundle size in KB — deterministic for the matrix. */
    readonly approxBundleKb: number;
    /** A one-line "choose this when…" for the matrix. */
    readonly bestFor: string;
};

/**
 * The six full-surface example adapters, in installer-matrix order
 * (reference canvas2d first, then the library adapters alphabetically
 * by id, with the zero-dep webgl adapter last). Each `id` matches its
 * `examples/<id>-adapter/` folder.
 *
 * @since 1.3
 * @example
 *     import { ADAPTERS } from "../scripts/adapters/registry.js";
 *     ADAPTERS.map((a) => a.id); // ["canvas2d", "echarts", "konva", ...]
 */
export const ADAPTERS: ReadonlyArray<AdapterRegistryEntry> = [
    {
        id: "canvas2d",
        exampleDir: "examples/canvas2d-adapter",
        displayName: "Canvas 2D",
        library: "(none)",
        libraryRange: "(built-in)",
        license: "MIT",
        renderTech: "HTML Canvas 2D context",
        strategy: "ctx",
        fullSurface: true,
        approxBundleKb: 130,
        bestFor: "Zero-dependency reference; full control over every pixel.",
    },
    {
        id: "echarts",
        exampleDir: "examples/echarts-adapter",
        displayName: "ECharts",
        library: "echarts",
        libraryRange: "^5",
        license: "Apache-2.0",
        renderTech: "Declarative graphic component",
        strategy: "graphic",
        fullSurface: true,
        approxBundleKb: 64,
        bestFor: "Huge install base; native candlesticks; declarative graphics.",
    },
    {
        id: "konva",
        exampleDir: "examples/konva-adapter",
        displayName: "Konva",
        library: "konva",
        libraryRange: "^9",
        license: "MIT",
        renderTech: "Scene-graph (Canvas)",
        strategy: "nodes",
        fullSurface: true,
        approxBundleKb: 92,
        bestFor: "Retained-mode nodes; hit-testing for interactive drawings.",
    },
    {
        id: "lightweight-charts",
        exampleDir: "examples/lightweight-charts-adapter",
        displayName: "Lightweight Charts",
        library: "lightweight-charts",
        libraryRange: "^5",
        license: "Apache-2.0",
        renderTech: "Native series + series-primitive overlay",
        strategy: "native-ctx",
        fullSurface: true,
        approxBundleKb: 64,
        bestFor: "Financial-native candles/axes/panes for free; tiny runtime.",
    },
    {
        id: "uplot",
        exampleDir: "examples/uplot-adapter",
        displayName: "uPlot",
        library: "uplot",
        libraryRange: "^1",
        license: "MIT",
        renderTech: "Canvas draw-hooks",
        strategy: "ctx",
        fullSurface: true,
        approxBundleKb: 56,
        bestFor: "Tiny + fast; immediate-mode draw hooks over raw context.",
    },
    {
        id: "webgl",
        exampleDir: "examples/webgl-adapter",
        displayName: "WebGL",
        library: "(none)",
        libraryRange: "(built-in)",
        license: "MIT",
        renderTech: "WebGL2 (raw, GPU-instanced)",
        strategy: "gl",
        fullSurface: true,
        approxBundleKb: 45,
        bestFor: "GPU-accelerated, TradingView-grade rendering at scale",
    },
];

/**
 * Derive the GitHub folder URL for an adapter from {@link REPO_URL} + its
 * `exampleDir` (the `tree/main/<dir>` deep-link convention used across the
 * docs and the writing-an-adapter guide).
 *
 * @since 1.3
 * @example
 *     import { ADAPTERS, githubFolder } from "../scripts/adapters/registry.js";
 *     githubFolder(ADAPTERS[0]);
 *     // "https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter"
 */
export function githubFolder(entry: AdapterRegistryEntry): string {
    return `${REPO_URL}/tree/main/${entry.exampleDir}`;
}
