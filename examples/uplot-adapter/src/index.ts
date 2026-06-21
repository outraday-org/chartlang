// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export { UPLOT_CAPABILITIES, UPLOT_SYM_INFO } from "./capabilities.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";
export { createUplotAdapter, runUplotLoop } from "./createUplotAdapter.js";
export type {
    CreateUplotAdapterOpts,
    RunUplotLoopOpts,
    UplotAdapterHandle,
    UplotFactory,
    UplotLike,
    UplotOptions,
    UplotSeriesSpec,
} from "./createUplotAdapter.js";
export { drawCandlePaths } from "./candlePaths.js";
export type { CandlePathStyle, ProjectedCandle } from "./candlePaths.js";
export { UPLOT_PRICE_SCALE, buildViewport, offsetForViewport } from "./viewport.js";

/**
 * Default export — re-exports {@link DEFAULT_ADAPTER} so consumers (the
 * conformance harness in particular) can
 * `import defaultAdapter from "chartlang-example-uplot-adapter"` without a
 * named binding.
 *
 * @since 1.4
 * @stable
 * @example
 *     import defaultAdapter from "chartlang-example-uplot-adapter";
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export default DEFAULT_ADAPTER;
