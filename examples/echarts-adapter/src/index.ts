// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export { createEChartsAdapter, runEChartsLoop } from "./createEChartsAdapter.js";
export type {
    CreateEChartsAdapterOpts,
    EChartsAdapterHandle,
    RunEChartsLoopOpts,
} from "./createEChartsAdapter.js";
export type { EChartsSurface } from "./types.js";
export { ECHARTS_CAPABILITIES, ECHARTS_SYM_INFO } from "./capabilities.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";
export { primitiveIsFinite, primitiveToGraphic } from "./primitiveToGraphic.js";
export type { EChartsGraphicElement } from "./primitiveToGraphic.js";
export { buildViewport, computeViewport } from "./viewport.js";

/**
 * Default export — re-exports {@link DEFAULT_ADAPTER} so consumers (the
 * conformance harness in particular) can
 * `import defaultAdapter from "chartlang-example-echarts-adapter"` without a
 * named binding.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import defaultAdapter from "chartlang-example-echarts-adapter";
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export default DEFAULT_ADAPTER;
