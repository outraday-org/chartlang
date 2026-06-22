// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export { createCanvas2dAdapter, redraw, runRendererLoop } from "./createCanvas2dAdapter.js";
export type {
    Canvas2dAdapterHandle,
    CreateCanvas2dAdapterOpts,
    RunRendererLoopOpts,
} from "./createCanvas2dAdapter.js";
export { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./capabilities.js";
export { DEFAULT_PALETTE } from "./palette.js";
export type { Palette } from "./palette.js";
export { createMultiStreamCandlePump } from "./streamPump.js";
export type { MultiStreamCandlePumpOpts } from "./streamPump.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";

/**
 * Default export — re-exports {@link DEFAULT_ADAPTER} so consumers
 * (the Task-12 conformance harness in particular) can
 * `import defaultAdapter from "chartlang-example-canvas2d-adapter"`
 * without a named binding.
 *
 * @since 0.1
 * @stable
 * @example
 *     import defaultAdapter from "chartlang-example-canvas2d-adapter";
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export default DEFAULT_ADAPTER;
