// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Per-pane z-order render pass for the WebGL adapter. It supplies ONLY the
// adapter's own mark payload (the `(z, band, seq)` tag) and the band map; the
// comparator is the SHARED `sortByRenderOrder` from adapter-kit — NEVER a local
// `a.z - b.z || a.band - b.band || a.seq - b.seq` re-derivation (that bug class
// is exactly why the comparator was promoted out of the reference adapter).

import {
    RENDER_BAND,
    type RenderOrderKey,
    sortByRenderOrder,
} from "@invinite-org/chartlang-adapter-kit";

/**
 * The default render-order bands, re-exported from the shared adapter-kit
 * `RENDER_BAND` so the WebGL adapter's call sites read `BAND.series` etc.
 * without forking the map. At the default `z = 0` the composite key reduces to
 * `(band, seq)` = series → glyph → hline → drawing, the canonical phase order
 * every adapter shared before `z` existed.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { BAND } from "chartlang-example-webgl-adapter";
 *     const seriesBeforeDrawing = BAND.series < BAND.drawing;
 *     void seriesBeforeDrawing;
 */
export const BAND = RENDER_BAND;

/**
 * Minimal `(z, band, seq)` tag a WebGL mark carries to participate in the
 * shared per-pane z-sort, generic over the mark payload `T` so each pass keeps
 * its own mark shape (a {@link import("./layer-descriptor.js").LayerDescriptor}
 * for the GL series/hline pass, a `PlotEmission` / drawing handle for the 2D
 * overlay passes) and shares ONLY the comparator + bands.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: RenderOrderMark<string> = { z: 0, band: BAND.series, seq: 0, payload: "ema" };
 *     void m;
 */
export type RenderOrderMark<T> = RenderOrderKey & { readonly payload: T };

/**
 * Stable per-pane z-order over a batch of WebGL marks: ascending by `z`, then
 * `band`, then `seq`, via the SHARED `sortByRenderOrder` comparator (sorts in
 * place, returns the payloads in order). Default `z = 0` reproduces the
 * canonical band order (series → glyph → hline → drawing); a `z < 0` mark sorts
 * beneath `z = 0` marks and a `z > 0` plot sorts above drawings. Each WebGL
 * draw surface (the GL pipeline's series/hline descriptors, the 2D overlay's
 * glyphs / drawings) builds its own marks and calls this with its own band
 * tags — substrate (bg / candles / overrides) paints BEFORE the sorted pass and
 * alert badges AFTER, exactly as the canvas2d reference orders them.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { applyRenderOrder, BAND } from "chartlang-example-webgl-adapter";
 *     const ordered = applyRenderOrder([
 *         { z: 1, band: BAND.series, seq: 0, payload: "a" },
 *         { z: 0, band: BAND.series, seq: 1, payload: "b" },
 *     ]);
 *     // ordered[0] === "b"
 *     void ordered;
 */
export function applyRenderOrder<T>(marks: RenderOrderMark<T>[]): T[] {
    sortByRenderOrder(marks);
    return marks.map((m) => m.payload);
}
