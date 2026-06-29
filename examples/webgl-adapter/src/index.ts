// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export { createWebglAdapter, runWebglLoop } from "./createWebglAdapter.js";
export type {
    CreateWebglAdapterOpts,
    RunWebglLoopOpts,
    WebglAdapterHandle,
} from "./createWebglAdapter.js";
export { WEBGL_CAPABILITIES, WEBGL_SYM_INFO } from "./capabilities.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";

export {
    DEFAULT_PALETTE,
    cssColorToRgbaUnit,
    hexToRgbaUnit,
    isBullish,
    resolvePaintColor,
} from "./layer-descriptor.js";
export type {
    CandleBodiesDescriptor,
    CandleWicksDescriptor,
    CursorDescriptor,
    DrawingDescriptor,
    FilledBandDescriptor,
    LayerDescriptor,
    LayerKind,
    LineStripDescriptor,
    MarkerDescriptor,
    PaneCssRect,
    PaneRenderState,
    PaneWindow,
    Palette,
    RgbaUnit,
    TextDescriptor,
    VerticalBarsDescriptor,
} from "./layer-descriptor.js";
export {
    createAdapterState,
    paneKeyPrefix,
    paneSlotKey,
    resetAdapterState,
} from "./state.js";
export type {
    AdapterState,
    CreateAdapterStateOpts,
    HLine,
    PlotPoint,
} from "./state.js";
export { applyEmissions } from "./ingest.js";
export { buildFrame } from "./buildFrame.js";
export type { PaneLayoutRect } from "./buildFrame.js";
export { PRICE_PANE_FRACTION, computePaneLayout } from "./layout.js";
export {
    computeAxisTicks,
    formatPrice,
    formatTime,
    niceStep,
    niceTicks,
    packGridLines,
    priceTicks,
    timeTicks,
} from "./axes.js";
export type { AxisRenderInfo, AxisTicks } from "./axes.js";
export { drawingPrimitives } from "./drawings.js";
export { applyRenderOrder, BAND } from "./renderOrder.js";
export type { RenderOrderMark } from "./renderOrder.js";
export { resolveHorizontalHistogram, resolveOverridePaint } from "./overrides.js";
export type {
    BackgroundBand,
    BarOverlayItem,
    HistogramRow,
    OverridePaint,
} from "./overrides.js";
export { axisLabelItems, createTextOverlay } from "./overlay.js";
export type {
    AlertBadgePaintItem,
    GlyphPaintItem,
    OverlayText,
    TextOverlay,
} from "./overlay.js";
export {
    alertBadgeAnchor,
    dispatchGlyph,
    glyphAnchor,
    isGlyphOverlay,
    paintAlertBadge,
    paneViewportFromInfo,
} from "./glyphs.js";
export type { PixelAnchor } from "./glyphs.js";
export { CursorsProgram } from "./webgl/programs/cursors-program.js";
export { FilledBandProgram } from "./webgl/programs/filled-band-program.js";
export { MarkersProgram } from "./webgl/programs/markers-program.js";
export { VerticalBarsProgram } from "./webgl/programs/vertical-bars-program.js";
export { IndicatorMarkersProgram } from "./webgl/programs/indicator-markers-program.js";
export {
    attachChartInteraction,
    pxToWorldX,
    worldXPerPx,
} from "./interaction.js";
export type {
    AttachChartInteractionOpts,
    InteractionViewport,
} from "./interaction.js";
export { Renderer } from "./webgl/Renderer.js";
export type { RendererOptions } from "./webgl/Renderer.js";
export { createGlContext } from "./webgl/gl-context.js";
export type { GlContext } from "./webgl/gl-context.js";

/**
 * Default export — re-exports {@link DEFAULT_ADAPTER} so consumers (the
 * conformance harness in particular) can
 * `import defaultAdapter from "chartlang-example-webgl-adapter"` without a
 * named binding.
 *
 * @since 0.1
 * @stable
 * @example
 *     import defaultAdapter from "chartlang-example-webgl-adapter";
 *     // defaultAdapter.capabilities.plots.has("line") === true
 *     void defaultAdapter;
 */
export default DEFAULT_ADAPTER;
