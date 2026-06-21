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
 *     const call: LwcRecordedCall = { kind: "addSeries", seriesId: "s0", seriesType: "Line", paneIndex: 0 };
 *     void call;
 */
export type LwcRecordedCall =
    | {
          readonly kind: "addSeries";
          readonly seriesId: string;
          readonly seriesType: string;
          readonly paneIndex: number;
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
          readonly value: number | null;
      }
    | {
          readonly kind: "applyOptions";
          readonly seriesId: string;
          readonly options: Readonly<Record<string, unknown>>;
      }
    | {
          readonly kind: "createPriceLine";
          readonly seriesId: string;
          readonly price: number;
      }
    | {
          readonly kind: "setMarkers";
          readonly seriesId: string;
          readonly markers: number;
      }
    | { readonly kind: "attachPrimitive"; readonly seriesId: string };

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
    setData(data: ReadonlyArray<{ time: number; value?: number }>): void;
    update(point: { time: number; value?: number }): void;
    applyOptions(options: Readonly<Record<string, unknown>>): void;
    createPriceLine(options: { price: number }): unknown;
    setMarkers(markers: ReadonlyArray<{ time: number }>): void;
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

    addSeries(
        seriesType: string,
        _options: Readonly<Record<string, unknown>>,
        paneIndex = 0,
    ): LwcSeries {
        const seriesId = `s${this.seriesCount++}`;
        this.calls.push({ kind: "addSeries", seriesId, seriesType, paneIndex });
        const calls = this.calls;
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
                });
            },
            applyOptions(options): void {
                calls.push({ kind: "applyOptions", seriesId, options });
            },
            createPriceLine(options): unknown {
                calls.push({ kind: "createPriceLine", seriesId, price: options.price });
                return {};
            },
            setMarkers(markers): void {
                calls.push({ kind: "setMarkers", seriesId, markers: markers.length });
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
            };
        case "applyOptions":
            return { kind: call.kind, seriesId: call.seriesId, options: call.options };
        case "createPriceLine":
            return {
                kind: call.kind,
                seriesId: call.seriesId,
                price: roundFloat(call.price),
            };
        case "setMarkers":
            return { kind: call.kind, seriesId: call.seriesId, markers: call.markers };
        case "attachPrimitive":
            return { kind: call.kind, seriesId: call.seriesId };
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
