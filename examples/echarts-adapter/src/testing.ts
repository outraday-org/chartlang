// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import type { EChartsOption, SetOptionOpts } from "echarts/types/dist/echarts";

import type { EChartsSurface } from "./types.js";

/**
 * One recorded call against {@link MockECharts}. Tests inspect the array to
 * assert the declarative `setOption` sequence the factory drives. ECharts is
 * configured by maintaining one `EChartsOption` and re-applying it per
 * emission drain, so the recorded log is the option-tree history (plus the
 * terminal `dispose`).
 *
 * @since 1.4
 * @stable
 * @example
 *     const call: RecordedOptionCall = { kind: "setOption", option: { series: [] } };
 *     void call;
 */
export type RecordedOptionCall =
    | { readonly kind: "setOption"; readonly option: EChartsOption; readonly opts?: SetOptionOpts }
    | { readonly kind: "resize" }
    | {
          readonly kind: "convertToPixel";
          readonly value: readonly [number, number];
          readonly pixel: readonly [number, number];
      }
    | { readonly kind: "dispose" };

/**
 * The deterministic affine value→pixel map {@link MockECharts.convertToPixel}
 * applies, so `buildViewport` exercises its real sampling path headlessly. Both
 * axes scale by a fixed factor + offset; ECharts' y grows downward, so the
 * price term is negated. Exported so the viewport test can reproduce the exact
 * pixels without re-deriving the constants.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { mockValueToPixel } from "chartlang-example-echarts-adapter/testing";
 *     const [px, py] = mockValueToPixel([0, 0]);
 *     // px === 48; py === 408
 *     void px;
 *     void py;
 */
export function mockValueToPixel(value: readonly [number, number]): readonly [number, number] {
    const [x, price] = value;
    return [48 + x * 0.001, 408 - price * 4];
}

/**
 * Hand-rolled ECharts instance mock satisfying the {@link EChartsSurface}
 * structural type the factory drives (`setOption` / `resize` / `dispose`).
 * Every call appends a typed record to `calls` so tests can assert the exact
 * option tree the factory emits without standing up a real chart or a DOM —
 * mirroring `chartlang-example-canvas2d-adapter`'s `MockCanvas2DContext`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockECharts } from "chartlang-example-echarts-adapter/testing";
 *     const chart = new MockECharts();
 *     chart.setOption({ series: [] });
 *     // chart.calls[0].kind === "setOption";
 *     const log = chart.calls;
 *     void log;
 */
export class MockECharts implements EChartsSurface {
    readonly calls: RecordedOptionCall[] = [];
    // The live `dataZoom` window, mirroring how a real ECharts instance
    // tracks the user's inside-zoom across `setOption` rebuilds. Updated from
    // each applied option's `dataZoom`, and overridable via
    // {@link applyUserZoom} to simulate a wheel/drag interaction.
    private currentZoom: { readonly start: number; readonly end: number } | undefined;

    setOption(option: EChartsOption, opts?: SetOptionOpts): void {
        this.calls.push(
            opts === undefined
                ? { kind: "setOption", option }
                : { kind: "setOption", option, opts },
        );
        const zoom = readDataZoom(option);
        if (zoom !== undefined) this.currentZoom = zoom;
    }

    /**
     * Read the live option's `dataZoom` window — the slice the adapter reads
     * back to preserve the user's zoom across its `notMerge:true` rebuild. A
     * real ECharts `getOption()` returns far more; only `dataZoom` is modelled.
     *
     * @since 1.6
     * @stable
     * @example
     *     import { MockECharts } from "chartlang-example-echarts-adapter/testing";
     *     const m = new MockECharts();
     *     m.getOption(); // {}
     */
    getOption(): {
        readonly dataZoom?: ReadonlyArray<{ readonly start: number; readonly end: number }>;
    } {
        return this.currentZoom === undefined ? {} : { dataZoom: [this.currentZoom] };
    }

    /**
     * Simulate a user inside-zoom / pan: set the live `dataZoom` window the
     * next {@link getOption} returns, as a real ECharts does on a wheel/drag.
     *
     * @since 1.6
     * @stable
     * @example
     *     import { MockECharts } from "chartlang-example-echarts-adapter/testing";
     *     const m = new MockECharts();
     *     m.applyUserZoom(20, 80);
     */
    applyUserZoom(start: number, end: number): void {
        this.currentZoom = { start, end };
    }

    resize(): void {
        this.calls.push({ kind: "resize" });
    }

    convertToPixel(
        _finder: { readonly gridIndex: number },
        value: readonly [number, number],
    ): readonly [number, number] {
        const pixel = mockValueToPixel(value);
        this.calls.push({ kind: "convertToPixel", value, pixel });
        return pixel;
    }

    dispose(): void {
        this.calls.push({ kind: "dispose" });
    }

    /** The most recently applied option tree, or `undefined` before any
     *  `setOption`. A convenience for tests asserting the final frame. */
    lastOption(): EChartsOption | undefined {
        for (let i = this.calls.length - 1; i >= 0; i -= 1) {
            const call = this.calls[i];
            if (call.kind === "setOption") return call.option;
        }
        return undefined;
    }
}

// Pull the first `dataZoom`'s numeric `start`/`end` out of an applied option,
// or `undefined` when the option carries no inside-zoom window (ECharts' loose
// `dataZoom` type → a guarded read).
function readDataZoom(
    option: EChartsOption,
): { readonly start: number; readonly end: number } | undefined {
    const dz = option.dataZoom as
        | ReadonlyArray<{ start?: number; end?: number }>
        | { start?: number; end?: number }
        | undefined;
    const first = Array.isArray(dz) ? dz[0] : undefined;
    if (first !== undefined && typeof first.start === "number" && typeof first.end === "number") {
        return { start: first.start, end: first.end };
    }
    return undefined;
}

const FLOAT_DECIMALS = 4;

function roundFloat(n: number): number | string {
    if (!Number.isFinite(n)) return String(n);
    return Number(n.toFixed(FLOAT_DECIMALS));
}

// Canonicalise an arbitrary option-tree value, rounding finite floats to a
// fixed precision and re-keying objects in sorted order so a microscopic
// numeric drift (or key-insertion-order difference) does not re-hash the log.
// Mirrors the canvas sink's `hashCallLog` canonicalisation approach for the
// ECharts option trees, which are not `RecordedCall`s.
function canonicalise(value: unknown): unknown {
    if (typeof value === "number") return roundFloat(value);
    if (Array.isArray(value)) return value.map(canonicalise);
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).sort()) {
            out[key] = canonicalise((value as Record<string, unknown>)[key]);
        }
        return out;
    }
    return value;
}

function canonicaliseCall(call: RecordedOptionCall): Record<string, unknown> {
    switch (call.kind) {
        case "setOption":
            return {
                kind: call.kind,
                option: canonicalise(call.option),
                ...(call.opts === undefined ? {} : { opts: canonicalise(call.opts) }),
            };
        case "convertToPixel":
            return {
                kind: call.kind,
                value: canonicalise(call.value),
                pixel: canonicalise(call.pixel),
            };
        case "resize":
        case "dispose":
            return { kind: call.kind };
    }
}

/**
 * Hash a recorded option-call log into a stable SHA-256 hex string. Finite
 * floats are rounded to four decimal places and objects are re-serialised in
 * sorted-key JSON so microscopic numeric drift does not re-hash the log.
 * Mirrors the `hashCallLog` canonicalisation approach from
 * `@invinite-org/chartlang-adapter-kit/canvas` — applied to ECharts option
 * trees, which are not the canvas `RecordedCall` union the public helper is
 * typed against. Used to pin the end-to-end option output against a golden
 * constant.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockECharts, hashOptionLog } from "chartlang-example-echarts-adapter/testing";
 *     const chart = new MockECharts();
 *     chart.setOption({ series: [] });
 *     const h = hashOptionLog(chart.calls);
 *     // h is a 64-char hex string
 *     void h;
 */
export function hashOptionLog(calls: ReadonlyArray<RecordedOptionCall>): string {
    const payload = calls.map(canonicaliseCall);
    const serialised = JSON.stringify(payload);
    return createHash("sha256").update(serialised).digest("hex");
}
