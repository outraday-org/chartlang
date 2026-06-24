// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

/**
 * One native lightweight-charts API call recorded by {@link MockLwcApi}.
 * Tests inspect the array to assert the factory's series / candle / pane
 * mapping without standing up a DOM container or a real chart. The union
 * covers every native method the factory touches; adding a new call means
 * extending both the mock and this union together.
 *
 * `seriesId` is a deterministic per-series ordinal (`s0`, `s1`, …) so a
 * recorded `setData` / `update` / `applyOptions` / marker / price-line
 * call can be attributed to the series it was made on without leaking a
 * live object reference into the log.
 *
 * @since 1.4
 * @stable
 * @example
 *     const call: LwcRecordedCall = { kind: "addSeries", seriesId: "s0", seriesType: "Line", paneIndex: 0, options: { color: "#26a69a" } };
 *     void call;
 */

/**
 * One native lightweight-charts series marker the factory hands to
 * `series.setMarkers([...])` (the v5 `createSeriesMarkers` plugin). Carries
 * the full glyph payload — `shape` / `position` / `text` / `color` / `size` —
 * so a glyph kind renders distinctly instead of collapsing to a uniform dot.
 * Only the glyphs LC can natively express reach here; the rest take the
 * canvas-overlay path.
 *
 * @since 1.8
 * @stable
 * @example
 *     const m: LwcMarker = { time: 1, shape: "arrowUp", position: "belowBar", color: "#26a69a" };
 *     void m;
 */
export type LwcMarker = {
    readonly time: number;
    // Native LC v5 marker shape (`"circle" | "square" | "arrowUp" |
    // "arrowDown"`). Glyphs LC's markers plugin cannot express (triangle /
    // diamond / cross / xcross / flag) take the canvas-overlay path instead
    // and never reach `setMarkers`.
    readonly shape: "circle" | "square" | "arrowUp" | "arrowDown";
    readonly position: "aboveBar" | "belowBar" | "inBar";
    readonly color: string;
    // `character` → the glyph char; `label` → the label text; absent for a
    // pure shape / arrow marker.
    readonly text?: string;
    // The glyph's pixel size (`PlotStyle.size`); LC scales the native marker.
    readonly size?: number;
};

export type LwcRecordedCall =
    | {
          readonly kind: "addSeries";
          readonly seriesId: string;
          readonly seriesType: string;
          readonly paneIndex: number;
          // The whole-series options the factory passed at creation — e.g.
          // `{ color }` for a `plot(..., { color })` line, `{ lineType }` for a
          // step-line. Recorded so the colour-forwarding path (which only lives
          // at `addSeries`, never re-`applyOptions`d) is assertable.
          readonly options: Readonly<Record<string, unknown>>;
      }
    | { readonly kind: "addPane"; readonly paneIndex: number }
    | { readonly kind: "remove" }
    | {
          readonly kind: "setData";
          readonly seriesId: string;
          readonly points: number;
      }
    | {
          readonly kind: "update";
          readonly seriesId: string;
          readonly time: number;
          // Line / area / histogram series carry `value` (null = whitespace gap).
          // Candlestick series carry the four OHLC fields instead.
          readonly value: number | null;
          readonly open?: number;
          readonly high?: number;
          readonly low?: number;
          readonly close?: number;
          // Per-bar candle colours (a `bar-color` / `bar-override` emission
          // stamps body / border / wick on the candlestick data point itself —
          // LC's native per-point colour API, recolouring body AND border AND
          // wick for exactly that bar).
          readonly color?: string;
          readonly borderColor?: string;
          readonly wickColor?: string;
      }
    | {
          readonly kind: "applyOptions";
          readonly seriesId: string;
          readonly options: Readonly<Record<string, unknown>>;
      }
    | {
          readonly kind: "createPriceLine";
          readonly seriesId: string;
          readonly priceLineId: string;
          readonly price: number;
      }
    | {
          readonly kind: "applyPriceLineOptions";
          readonly priceLineId: string;
          readonly price: number;
      }
    | {
          readonly kind: "removePriceLine";
          readonly seriesId: string;
          readonly priceLineId: string;
      }
    | {
          readonly kind: "setMarkers";
          readonly seriesId: string;
          // The full marker payload (shape / position / text / color / size),
          // not just the count — so the glyph-fidelity tests can assert that
          // each native glyph kind produces a DISTINCT marker (arrow up vs
          // down differ; character / label carry text).
          readonly markers: ReadonlyArray<LwcMarker>;
      }
    | { readonly kind: "attachPrimitive"; readonly seriesId: string }
    | {
          readonly kind: "setVisibleLogicalRange";
          readonly from: number;
          readonly to: number;
      };

/**
 * Structural shape the factory uses for a single native price line. Both
 * the real lightweight-charts `IPriceLine` and {@link MockLwcApi}'s recorded
 * price line satisfy it — the factory only `applyOptions({ price })`s an
 * existing line (to re-price it across bars) and hands the handle back to
 * {@link LwcSeries.removePriceLine}.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const line: LwcPriceLine;
 *     line.applyOptions({ price: 42 });
 *     void line;
 */
export type LwcPriceLine = {
    applyOptions(options: { price: number }): void;
};

// Internal: the mock tags each handed-back price line with its deterministic
// ordinal so `removePriceLine` can attribute without a fallible WeakMap lookup.
type RecordedPriceLine = LwcPriceLine & { readonly priceLineId: string };

/**
 * A single data point passed to {@link LwcSeries.setData} or
 * {@link LwcSeries.update}. Line / area / histogram series use the `value`
 * field; a candlestick series uses the OHLC fields. A whitespace (gap) point
 * carries only `time` (both `value` and OHLC fields absent).
 *
 * @since 1.4
 * @stable
 * A candlestick point may additionally carry per-point `color` / `borderColor`
 * / `wickColor` — lightweight-charts' native per-bar candle colouring, which a
 * `bar-color` / `bar-override` emission stamps so the body AND border AND wick
 * all take the override colour for that single bar.
 *
 * @example
 *     const linePoint: LwcDataPoint = { time: 1, value: 42 };
 *     const candlePoint: LwcDataPoint = { time: 1, open: 10, high: 12, low: 9, close: 11 };
 *     const tinted: LwcDataPoint = { time: 1, open: 10, high: 12, low: 9, close: 11, color: "#2962ff", borderColor: "#2962ff", wickColor: "#2962ff" };
 *     const gapPoint: LwcDataPoint = { time: 1 };
 *     void linePoint; void candlePoint; void tinted; void gapPoint;
 */
export type LwcDataPoint = {
    readonly time: number;
    readonly value?: number;
    readonly open?: number;
    readonly high?: number;
    readonly low?: number;
    readonly close?: number;
    readonly color?: string;
    readonly borderColor?: string;
    readonly wickColor?: string;
};

/**
 * Structural shape the factory uses for a single native series. Both the
 * real lightweight-charts `ISeriesApi` and {@link MockLwcApi}'s recorded
 * series satisfy it — the factory never reaches past these methods.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const s: LwcSeries;
 *     s.setData([{ time: 1, value: 2 }]);
 *     void s;
 */
export type LwcSeries = {
    setData(data: ReadonlyArray<LwcDataPoint>): void;
    update(point: LwcDataPoint): void;
    applyOptions(options: Readonly<Record<string, unknown>>): void;
    createPriceLine(options: { price: number }): LwcPriceLine;
    removePriceLine(line: LwcPriceLine): void;
    setMarkers(markers: ReadonlyArray<LwcMarker>): void;
    // Task 6: the drawing series-primitive overlay attaches here. `primitive`
    // is structurally an `ISeriesPrimitive`; the factory anchors one instance
    // on the overlay candle series.
    attachPrimitive(primitive: unknown): void;
};

/**
 * Structural shape the factory uses for the chart. Both the real
 * lightweight-charts `IChartApi` and {@link MockLwcApi} satisfy it.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const c: LwcChart;
 *     c.remove();
 *     void c;
 */
export type LwcChart = {
    addSeries(
        seriesType: string,
        options: Readonly<Record<string, unknown>>,
        paneIndex?: number,
    ): LwcSeries;
    addPane(): { paneIndex: number };
    // Frame the time scale onto a logical bar-index window. The factory calls
    // this ONCE (the first time data is present, when `initialVisibleBars` is
    // set) to open framed on the most recent N bars; later live-bar updates
    // and any user pan/zoom are not re-framed. Bridges to the real
    // `chart.timeScale().setVisibleLogicalRange(...)`.
    setVisibleLogicalRange(range: { from: number; to: number }): void;
    remove(): void;
};

/**
 * Hand-rolled lightweight-charts mock that satisfies {@link LwcChart}.
 * Every method appends a typed {@link LwcRecordedCall} to `calls`, and
 * each series it hands back records its own `setData` / `update` /
 * `applyOptions` / `createPriceLine` / `setMarkers` calls into the same
 * shared log — so a test can assert the exact native call sequence the
 * factory produced.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     const chart = new MockLwcApi();
 *     const s = chart.addSeries("Line", {}, 0);
 *     s.update({ time: 1, value: 2 });
 *     // chart.calls covers both the addSeries and the update.
 *     const log = chart.calls;
 *     void log;
 */
export class MockLwcApi implements LwcChart {
    readonly calls: LwcRecordedCall[] = [];
    private seriesCount = 0;
    private paneCount = 1;
    private priceLineCount = 0;

    addSeries(
        seriesType: string,
        options: Readonly<Record<string, unknown>>,
        paneIndex = 0,
    ): LwcSeries {
        const seriesId = `s${this.seriesCount++}`;
        this.calls.push({ kind: "addSeries", seriesId, seriesType, paneIndex, options });
        const calls = this.calls;
        // Each recorded price line carries its deterministic ordinal (`pl0`,
        // `pl1`, …) on the handle itself, so re-pricing
        // (`applyPriceLineOptions`) and removal (`removePriceLine`) attribute
        // to the exact line with no fallible lookup.
        const nextPriceLineId = (): string => `pl${this.priceLineCount++}`;
        return {
            setData(data): void {
                calls.push({ kind: "setData", seriesId, points: data.length });
            },
            update(point): void {
                calls.push({
                    kind: "update",
                    seriesId,
                    time: point.time,
                    value: point.value ?? null,
                    ...(point.open !== undefined ? { open: point.open } : {}),
                    ...(point.high !== undefined ? { high: point.high } : {}),
                    ...(point.low !== undefined ? { low: point.low } : {}),
                    ...(point.close !== undefined ? { close: point.close } : {}),
                    ...(point.color !== undefined ? { color: point.color } : {}),
                    ...(point.borderColor !== undefined ? { borderColor: point.borderColor } : {}),
                    ...(point.wickColor !== undefined ? { wickColor: point.wickColor } : {}),
                });
            },
            applyOptions(options): void {
                calls.push({ kind: "applyOptions", seriesId, options });
            },
            createPriceLine(options): LwcPriceLine {
                const priceLineId = nextPriceLineId();
                calls.push({
                    kind: "createPriceLine",
                    seriesId,
                    priceLineId,
                    price: options.price,
                });
                const line: RecordedPriceLine = {
                    priceLineId,
                    applyOptions(next): void {
                        calls.push({
                            kind: "applyPriceLineOptions",
                            priceLineId,
                            price: next.price,
                        });
                    },
                };
                return line;
            },
            removePriceLine(line): void {
                const priceLineId = (line as RecordedPriceLine).priceLineId;
                calls.push({ kind: "removePriceLine", seriesId, priceLineId });
            },
            setMarkers(markers): void {
                calls.push({
                    kind: "setMarkers",
                    seriesId,
                    markers: markers.map((m) => ({
                        time: m.time,
                        shape: m.shape,
                        position: m.position,
                        color: m.color,
                        ...(m.text !== undefined ? { text: m.text } : {}),
                        ...(m.size !== undefined ? { size: m.size } : {}),
                    })),
                });
            },
            attachPrimitive(_primitive): void {
                calls.push({ kind: "attachPrimitive", seriesId });
            },
        };
    }

    addPane(): { paneIndex: number } {
        const paneIndex = this.paneCount++;
        this.calls.push({ kind: "addPane", paneIndex });
        return { paneIndex };
    }

    setVisibleLogicalRange(range: { from: number; to: number }): void {
        this.calls.push({ kind: "setVisibleLogicalRange", from: range.from, to: range.to });
    }

    remove(): void {
        this.calls.push({ kind: "remove" });
    }
}

/**
 * Convenience factory returning a fresh {@link MockLwcApi} alongside a
 * direct handle to its recorded-call array — mirrors canvas2d's
 * `new MockCanvas2DContext()` + `ctx.calls` pattern for tests that want
 * the log without reaching through the chart.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createMockChart } from "chartlang-example-lightweight-charts-adapter/testing";
 *     const { chart, calls } = createMockChart();
 *     void chart;
 *     void calls;
 */
export function createMockChart(): { chart: MockLwcApi; calls: LwcRecordedCall[] } {
    const chart = new MockLwcApi();
    return { chart, calls: chart.calls };
}

const FLOAT_DECIMALS = 4;

function roundFloat(n: number): number | string {
    if (!Number.isFinite(n)) return String(n);
    return Number(n.toFixed(FLOAT_DECIMALS));
}

function canonicalise(call: LwcRecordedCall): Record<string, unknown> {
    switch (call.kind) {
        case "addSeries":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                seriesType: call.seriesType,
                paneIndex: call.paneIndex,
                options: call.options,
            };
        case "addPane":
            return { kind: call.kind, paneIndex: call.paneIndex };
        case "remove":
            return { kind: call.kind };
        case "setData":
            return { kind: call.kind, seriesId: call.seriesId, points: call.points };
        case "update":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                time: roundFloat(call.time),
                value: call.value === null ? null : roundFloat(call.value),
                ...(call.open !== undefined ? { open: roundFloat(call.open) } : {}),
                ...(call.high !== undefined ? { high: roundFloat(call.high) } : {}),
                ...(call.low !== undefined ? { low: roundFloat(call.low) } : {}),
                ...(call.close !== undefined ? { close: roundFloat(call.close) } : {}),
                ...(call.color !== undefined ? { color: call.color } : {}),
                ...(call.borderColor !== undefined ? { borderColor: call.borderColor } : {}),
                ...(call.wickColor !== undefined ? { wickColor: call.wickColor } : {}),
            };
        case "applyOptions":
            return { kind: call.kind, seriesId: call.seriesId, options: call.options };
        case "createPriceLine":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                priceLineId: call.priceLineId,
                price: roundFloat(call.price),
            };
        case "applyPriceLineOptions":
            return {
                kind: call.kind,
                priceLineId: call.priceLineId,
                price: roundFloat(call.price),
            };
        case "removePriceLine":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                priceLineId: call.priceLineId,
            };
        case "setMarkers":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                markers: call.markers.map((m) => ({
                    time: roundFloat(m.time),
                    shape: m.shape,
                    position: m.position,
                    color: m.color,
                    ...(m.text !== undefined ? { text: m.text } : {}),
                    ...(m.size !== undefined ? { size: roundFloat(m.size) } : {}),
                })),
            };
        case "attachPrimitive":
            return { kind: call.kind, seriesId: call.seriesId };
        case "setVisibleLogicalRange":
            return { kind: call.kind, from: roundFloat(call.from), to: roundFloat(call.to) };
    }
}

/**
 * Hash a recorded lightweight-charts call log into a stable SHA-256 hex
 * string. Floats are rounded to four decimal places before serialisation
 * so microscopic floating-point drift does not re-hash the log — the same
 * canonicalisation approach as the adapter-kit canvas-family `hashCallLog`
 * (imported by tests from `@invinite-org/chartlang-adapter-kit/canvas`),
 * specialised to the native-call vocabulary lightweight-charts records.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockLwcApi, hashLwcCallLog } from "chartlang-example-lightweight-charts-adapter/testing";
 *     const chart = new MockLwcApi();
 *     chart.addSeries("Line", {}, 0);
 *     const h = hashLwcCallLog(chart.calls);
 *     // h is a 64-char hex string
 *     void h;
 */
export function hashLwcCallLog(calls: ReadonlyArray<LwcRecordedCall>): string {
    const payload = calls.map(canonicalise);
    const serialised = JSON.stringify(payload);
    return createHash("sha256").update(serialised).digest("hex");
}
