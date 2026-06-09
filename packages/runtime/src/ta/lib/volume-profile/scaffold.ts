// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";

import { pushDiagnostic, pushPlot } from "../../../emit";
import { Float64RingBuffer } from "../../../ringBuffer";
import type { RuntimeContext } from "../../../runtimeContext";

import { type VolumeProfileBar, type VolumeProfileResult, computeProfile } from "./index";
import type { ProfileConfig } from "./index";

/**
 * Histogram bucket shape shared by all four volume-profile primitives.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const bucket: HistogramBucket = { price: 100, volume: 10 };
 */
export type HistogramBucket = Readonly<{
    price: number;
    volume: number;
    color?: string;
}>;

/**
 * The "what we computed for this bar" snapshot used to commit to the
 * slot's ring buffers and emit the histogram. NaN values short-circuit
 * the buffer writes to NaN-warmup.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const snap: VolumeProfileSnapshot = { buckets: [], poc: NaN, valHigh: NaN, valLow: NaN };
 */
export type VolumeProfileSnapshot = Readonly<{
    buckets: ReadonlyArray<HistogramBucket>;
    poc: number;
    valHigh: number;
    valLow: number;
}>;

/**
 * Per-VP slot state: three Float64 ring buffers (POC / VAH / VAL) plus
 * the latest computed buckets. Callers wrap this with a primitive-
 * specific `result` object that exposes `Series<number>` views over the
 * buffers and (optionally) the `buckets` getter.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const core = createVolumeProfileCore(capacity);
 */
export type VolumeProfileCore = {
    readonly pocBuffer: Float64RingBuffer;
    readonly valHighBuffer: Float64RingBuffer;
    readonly valLowBuffer: Float64RingBuffer;
    buckets: ReadonlyArray<HistogramBucket>;
};

const DEFAULT_ROW_SIZE = 24;
const DEFAULT_VALUE_AREA_PCT = 0.7;
const HISTOGRAM_SLOT_SUFFIX = "/histogram";

/**
 * Allocate the three Float64 ring buffers + an empty `buckets` array
 * shared by every volume-profile slot.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const core = createVolumeProfileCore(capacity);
 */
export function createVolumeProfileCore(capacity: number): VolumeProfileCore {
    return {
        buckets: [],
        pocBuffer: new Float64RingBuffer(capacity),
        valHighBuffer: new Float64RingBuffer(capacity),
        valLowBuffer: new Float64RingBuffer(capacity),
    };
}

/**
 * Normalise a primitive's options into the shared `ProfileConfig`.
 * `rowSize` defaults to 24 and `valueAreaPct` defaults to 0.7 — both
 * values match the upstream invinite reference. `valueAreaPct <= 1` is
 * interpreted as a fraction and scaled to percent.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const cfg = volumeProfileConfigFromOpts({ rowSize: 20, valueAreaPct: 0.7 });
 */
export function volumeProfileConfigFromOpts(opts: {
    rowSize?: number;
    valueAreaPct?: number;
}): ProfileConfig {
    const rowSize = opts.rowSize;
    const valueAreaPct = opts.valueAreaPct ?? DEFAULT_VALUE_AREA_PCT;
    return {
        rowSize: rowSize === undefined || rowSize <= 0 ? DEFAULT_ROW_SIZE : rowSize,
        valueAreaPct: valueAreaPct <= 1 ? valueAreaPct * 100 : valueAreaPct,
    };
}

/**
 * Apply a single-bucket fallback for windows where the full bucketizer
 * cannot produce a profile (constant-price input, single-bar window,
 * etc.). Returns `null` when no finite-close / positive-volume bar
 * exists in the window.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const fallback = degenerateVolumeProfile(bars, "#fff");
 */
export function degenerateVolumeProfile(
    bars: ReadonlyArray<VolumeProfileBar>,
    bucketColor: string | undefined,
): VolumeProfileSnapshot | null {
    let totalVolume = 0;
    let price = Number.NaN;
    for (const bar of bars) {
        if (!Number.isFinite(bar.close)) continue;
        price = bar.close;
        if (Number.isFinite(bar.volume) && bar.volume > 0) totalVolume += bar.volume;
    }
    if (!Number.isFinite(price) || totalVolume <= 0) return null;
    const bucket =
        bucketColor === undefined
            ? { price, volume: totalVolume }
            : { price, volume: totalVolume, color: bucketColor };
    return {
        buckets: [bucket],
        poc: price,
        valHigh: price,
        valLow: price,
    };
}

/**
 * Empty / NaN snapshot returned when no bars are in the window and
 * the degenerate fallback also fails to produce one.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const snap = emptyVolumeProfileSnapshot();
 */
export function emptyVolumeProfileSnapshot(): VolumeProfileSnapshot {
    return {
        buckets: [],
        poc: Number.NaN,
        valHigh: Number.NaN,
        valLow: Number.NaN,
    };
}

/**
 * Common "compute → apply bucketColor → fall back to degenerate"
 * pipeline used by every VP primitive.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const snap = resolveVolumeProfileSnapshot({ bars, config, bucketColor: "#fff" });
 */
export function resolveVolumeProfileSnapshot(args: {
    bars: ReadonlyArray<VolumeProfileBar>;
    config: ProfileConfig;
    bucketColor: string | undefined;
}): VolumeProfileSnapshot {
    const { bars, config, bucketColor } = args;
    const profile: VolumeProfileResult | null =
        bars.length === 0
            ? null
            : computeProfile({
                  config,
                  laneBars: bars,
                  windowFromIdx: 0,
                  windowToIdx: bars.length - 1,
              });
    if (profile !== null && profile.buckets.length > 0) {
        return {
            buckets: profile.buckets.map((bucket) =>
                bucketColor === undefined ? bucket : { ...bucket, color: bucketColor },
            ),
            poc: profile.poc,
            valHigh: profile.valHigh,
            valLow: profile.valLow,
        };
    }
    return degenerateVolumeProfile(bars, bucketColor) ?? emptyVolumeProfileSnapshot();
}

/**
 * Commit a snapshot to a slot's POC / VAH / VAL ring buffers. Append
 * on close, replace-head on tick. Updates the `buckets` cache.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // commitVolumeProfileSnapshot(core, false, snap);
 */
export function commitVolumeProfileSnapshot(
    core: VolumeProfileCore,
    isTick: boolean,
    snapshot: VolumeProfileSnapshot,
): void {
    core.buckets = snapshot.buckets;
    if (isTick) {
        core.pocBuffer.replaceHead(snapshot.poc);
        core.valHighBuffer.replaceHead(snapshot.valHigh);
        core.valLowBuffer.replaceHead(snapshot.valLow);
    } else {
        core.pocBuffer.append(snapshot.poc);
        core.valHighBuffer.append(snapshot.valHigh);
        core.valLowBuffer.append(snapshot.valLow);
    }
}

/**
 * Emit the auto-generated `horizontal-histogram` PlotEmission for a
 * VP primitive, or a deduped `unsupported-plot-kind` diagnostic when
 * the adapter cannot render the kind. The dedup key includes the slot
 * id so an indicator that reuses VP across multiple call sites still
 * receives one diagnostic per call site, not per bar.
 *
 * @formula N/A — internal volume-profile slot scaffolding (see the four
 *          `ta.*VolumeProfile` primitives for the math contract).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // emitVolumeProfileHistogram(ctx, slotId, "Anchored Volume Profile", snap.poc, snap.buckets);
 */
export function emitVolumeProfileHistogram(
    ctx: RuntimeContext,
    slotId: string,
    title: string,
    value: number,
    buckets: ReadonlyArray<HistogramBucket>,
): void {
    if (!ctx.capabilities.plots.has("horizontal-histogram")) {
        const key = `unsupported-plot-kind|${slotId}`;
        if (ctx.diagnosedRequestKeys.has(key)) return;
        ctx.diagnosedRequestKeys.add(key);
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: 'Adapter cannot render plot kind "horizontal-histogram".',
            slotId,
            bar: ctx.barIndex(),
        });
        return;
    }
    const emission: PlotEmission = {
        bar: ctx.barIndex(),
        color: null,
        kind: "plot",
        meta: {},
        pane: "overlay",
        slotId: `${slotId}${HISTOGRAM_SLOT_SUFFIX}`,
        style: { kind: "horizontal-histogram", buckets },
        time: ctx.stream.bar.time,
        title,
        value: Number.isFinite(value) ? value : null,
    };
    pushPlot(ctx.emissions, emission);
}
