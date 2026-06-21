// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DemoAdapterFactory } from "./types";

/** One selectable adapter in the demo switcher; `load` is lazy. */
export type DemoAdapterDescriptor = Readonly<{
    id: string;
    label: string;
    load: () => Promise<DemoAdapterFactory>;
}>;

// Maintenance note: these `id`s are MIRRORED from
// `scripts/adapters/registry.ts` `ADAPTERS[].id`, the SSOT the docs
// gallery + the `add-adapter` CLI read. Adding/removing an adapter means
// updating BOTH lists (this one is deliberately not imported from
// `scripts/` to avoid an app -> scripts bundling dependency).
export const DEMO_ADAPTERS: ReadonlyArray<DemoAdapterDescriptor> = [
    { id: "canvas2d", label: "Canvas 2D", load: () => import("./canvas2d").then((m) => m.default) },
    {
        id: "lightweight-charts",
        label: "Lightweight Charts",
        load: () => import("./lightweightCharts").then((m) => m.default),
    },
    { id: "uplot", label: "uPlot", load: () => import("./uplot").then((m) => m.default) },
    { id: "echarts", label: "ECharts", load: () => import("./echarts").then((m) => m.default) },
    { id: "konva", label: "Konva", load: () => import("./konva").then((m) => m.default) },
];

/** The default adapter id (mirrors the demo's historical canvas2d default). */
export const DEFAULT_ADAPTER_ID = "canvas2d";

/** Whether `id` names a known demo adapter. */
export function isDemoAdapterId(id: string): boolean {
    return DEMO_ADAPTERS.some((a) => a.id === id);
}
