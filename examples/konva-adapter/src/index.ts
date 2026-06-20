// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export { KONVA_CAPABILITIES, KONVA_SYM_INFO } from "./capabilities.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";
export {
    createKonvaAdapter,
    feedCandleEvent,
    handleInterval,
} from "./createKonvaAdapter.js";
export type {
    CreateKonvaAdapterOpts,
    KonvaAdapterHandle,
} from "./createKonvaAdapter.js";
export { computePaneLayout } from "./paneLayout.js";
export type { PaneLayoutEntry, PaneRect } from "./paneLayout.js";
export { DEFAULT_PALETTE } from "./palette.js";
export type { KonvaPalette } from "./palette.js";
export { parseFont, primitiveToNode } from "./primitiveToNode.js";
export type {
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
 * Default export — re-exports {@link DEFAULT_ADAPTER} so consumers
 * (the multi-adapter conformance harness in particular) can
 * `import defaultAdapter from "chartlang-example-konva-adapter"` without
 * a named binding.
 *
 * @since 1.4
 * @stable
 * @example
 *     import defaultAdapter from "chartlang-example-konva-adapter";
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export default DEFAULT_ADAPTER;
