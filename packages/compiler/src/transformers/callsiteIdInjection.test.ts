// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES, STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { injectCallsiteIds } from "./callsiteIdInjection.js";

function printSourceFile(file: ts.SourceFile): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(file);
}

describe("injectCallsiteIds", () => {
    it("rewrites ta.ema to inject the slot id as the first argument", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const e = ta.ema(close, 20);
void e;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.ema\("demo\.chart\.ts:4:11#0", close, 20\)/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not rewrite non-stateful core calls (defineIndicator)", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).not.toMatch(/defineIndicator\("/);
    });

    it("does not rewrite user-shadowed identifiers", () => {
        const source = `
const plot = (_: number) => {};
plot(1);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).not.toMatch(/plot\("/);
    });

    it("rewrites every slot: true primitive in STATEFUL_PRIMITIVES (and skips ta.nz)", () => {
        const source = `
import { ta, plot, hline, bgcolor, barcolor, alert, draw, request, state } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
declare const flag: import("@invinite-org/chartlang-core").Series<boolean>;
ta.sma(close, 14);
ta.ema(close, 14);
ta.stdev(close, 14);
ta.bb(close, 14);
ta.rsi(close, 14);
ta.macd(close);
ta.atr(14);
ta.crossover(close, 0);
ta.crossunder(close, 0);
ta.highest(close, 14);
ta.lowest(close, 14);
ta.highestbars(close, 14);
ta.lowestbars(close, 14);
ta.change(close);
ta.valuewhen(flag, close);
ta.barssince(flag);
ta.wma(close, 14);
ta.vwma(close, 14);
ta.hma(close, 14);
ta.smma(close, 14);
ta.dema(close, 14);
ta.tema(close, 14);
ta.kama(close);
ta.alma(close, 9);
ta.lsma(close, 25);
ta.mcginley(close, 14);
ta.maRibbon(close);
ta.kst(close);
ta.fisher(9);
ta.klinger();
ta.rvgi();
ta.ao();
ta.cmo(close, 14);
ta.momentum(close, 10);
ta.roc(close, 12);
ta.cci(close, 14);
ta.chaikinOsc();
ta.mfi(14);
ta.netVolume();
ta.pvo();
ta.stoch();
ta.williamsR(14);
ta.aroon(14);
ta.aroonOsc(14);
ta.psar();
ta.supertrend({ length: 10, multiplier: 3 });
ta.chandelier({ length: 22, multiplier: 3 });
ta.chandeKrollStop({ length: 10, multiplier: 1, smoothingLength: 9 });
ta.williamsFractal({ length: 2 });
ta.zigZag({ deviation: 5, depth: 10 });
ta.pivotsHighLow({ leftLength: 4, rightLength: 4 });
ta.pivotsStandard();
ta.volatilityStop({ length: 20, multiplier: 2 });
ta.ppo(close);
ta.dpo(close, 21);
ta.connorsRsi(close);
ta.stochRsi(close);
ta.ultimateOsc();
ta.coppock(close);
ta.pmo(close);
ta.smi();
ta.tsi(close);
ta.adx(14);
ta.dmi(14);
ta.trix(close, 18);
ta.vortex(14);
ta.trendStrengthIndex(close, 14);
ta.ichimoku();
ta.vol();
ta.vwap();
ta.anchoredVwap(0);
ta.obv();
ta.adl();
ta.bop();
ta.cmf(20);
ta.pvt();
ta.eom(14);
ta.nvi();
ta.pvi();
ta.visibleRangeVolumeProfile();
ta.anchoredVolumeProfile({ anchor: 0 });
ta.sessionVolumeProfile();
ta.fixedRangeVolumeProfile({ from: 0, to: 1 });
ta.bbPercentB(close, 20);
ta.bbw(close, 20);
ta.donchian(20);
ta.keltner();
ta.envelope(close);
ta.chop(14);
ta.historicalVolatility(close, 10);
ta.rvi(close, 14);
ta.massIndex();
ta.median(close, 14);
ta.adr();
ta.ulcerIndex(close, 14);
ta.nz(Number.NaN, 0);
plot(1);
hline(1);
bgcolor("#000");
barcolor("#000");
alert("msg");
state.float(0);
state.int(0);
state.bool(false);
state.string("");
state.series(0);
state.color("#000000");
state.boolSeries(false);
state.stringSeries("");
state.array(20);
state.map(20);
state.tick.float(0);
state.tick.int(0);
state.tick.bool(false);
state.tick.string("");
request.security({ interval: "1D" });
request.lowerTf({ interval: "30s" });
draw.line({ time: 0, price: 0 }, { time: 1, price: 1 });
draw.horizontalLine(0);
draw.horizontalRay({ time: 0, price: 0 });
draw.verticalLine(0);
draw.crossLine({ time: 0, price: 0 });
draw.trendAngle({ time: 0, price: 0 }, { time: 1, price: 1 });
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        const slotMatches = text.match(/"demo\.chart\.ts:\d+:\d+#0"/g) ?? [];
        // Phase-3 ports add draw.* entries to STATEFUL_PRIMITIVES per
        // category. Task 5 wires the 6 line-family kinds; the remaining
        // 55 draw.* kinds land in Tasks 6–18. The test exercises every
        // shipped slot:true callsite (93 ta + plot + hline + bgcolor +
        // barcolor + alert + 14 state (incl. state.series + state.color +
        // state.boolSeries + state.stringSeries + state.array + state.map) +
        // 6 line-family draw) —
        // entries without a call here are excluded from the expected count.
        const unwiredDrawEntries = new Set<string>();
        for (const entry of STATEFUL_PRIMITIVES) {
            if (
                entry.name.startsWith("draw.") &&
                ![
                    "draw.line",
                    "draw.horizontalLine",
                    "draw.horizontalRay",
                    "draw.verticalLine",
                    "draw.crossLine",
                    "draw.trendAngle",
                ].includes(entry.name)
            ) {
                unwiredDrawEntries.add(entry.name);
            }
        }
        let slotTrueCount = 0;
        for (const entry of STATEFUL_PRIMITIVES) {
            if (entry.slot && !unwiredDrawEntries.has(entry.name)) slotTrueCount += 1;
        }
        expect(slotMatches.length).toBe(slotTrueCount);
        // ta.nz call retains its original arg list.
        expect(text).toMatch(/ta\.nz\(Number\.NaN, 0\)/);
    });

    it("does not inject a slot id for ta.nz (slot: false)", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
const v = ta.nz(Number.NaN, 7);
void v;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.nz\(Number\.NaN, 7\)/);
        expect(text).not.toMatch(/ta\.nz\("demo/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("injects a slot id for ta.highest (slot: true)", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const high: import("@invinite-org/chartlang-core").Series<number>;
const h = ta.highest(high, 20);
void h;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.highest\("demo\.chart\.ts:\d+:\d+#0", high, 20\)/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("injects a slot id for state.float as the first argument", () => {
        const source = `
import { state } from "@invinite-org/chartlang-core";
const slot = state.float(0);
void slot;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/state\.float\("demo\.chart\.ts:3:14#0", 0\)/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("injects a slot id for request.security and preserves the opts object", () => {
        const source = `
import { request } from "@invinite-org/chartlang-core";
const daily = request.security({ interval: "1D" });
void daily;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/request\.security\("demo\.chart\.ts:3:15#0", \{ interval: "1D" \}\)/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not mutate the input source file (different node identity)", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const beforeText = printSourceFile(sourceFile);
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const afterInputText = printSourceFile(sourceFile);
        expect(afterInputText).toBe(beforeText);
        expect(result.transformed).not.toBe(sourceFile);
    });

    it("yields byte-identical transformed output across two runs", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const a = ta.ema(close, 12);
const b = ta.sma(close, 26);
void a; void b;
`;
        const first = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
        const a = injectCallsiteIds(first.sourceFile, first.checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        const second = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
        const b = injectCallsiteIds(second.sourceFile, second.checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        expect(printSourceFile(a.transformed)).toBe(printSourceFile(b.transformed));
    });

    it("falls back to the input source file when the transformer drops the result", () => {
        // ts.transform always populates `transformed[0]` for a non-empty
        // input, so we exercise the fallback indirectly: passing an empty
        // stateful set means no rewrites; the printer output equals the
        // input.
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: new Map(),
        });
        expect(printSourceFile(result.transformed)).toBe(printSourceFile(sourceFile));
    });

    it('emits stateful-call-element-access on `ta["ema"](...)` and does not inject a slot id', () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta["ema"](close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        expect(result.diagnostics).toHaveLength(1);
        const diagnostic = result.diagnostics[0];
        if (!diagnostic) throw new Error("expected diagnostic");
        expect(diagnostic.code).toBe("stateful-call-element-access");
        expect(diagnostic.message).toContain("`ta`");
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\["ema"\]\(close, 20\)/);
    });

    it("does not flag element-access calls on non-core objects", () => {
        const source = `
const tools = { ema: (_: number, __: number) => 0 };
tools["ema"](1, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        });
        expect(result.diagnostics).toEqual([]);
    });

    it("emits callsite-id-conflict when a slot id has already been issued", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const seededSlotId = "demo.chart.ts:4:1#0";
        const preexisting: ts.CallExpression = ts.factory.createCallExpression(
            ts.factory.createIdentifier("noop"),
            undefined,
            [],
        );
        const slotsSeen = new Map<string, ts.CallExpression>([[seededSlotId, preexisting]]);
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
            slotsSeen,
        });
        expect(result.diagnostics).toHaveLength(1);
        const diagnostic = result.diagnostics[0];
        if (!diagnostic) throw new Error("expected diagnostic");
        expect(diagnostic.code).toBe("callsite-id-conflict");
        // The colliding call is skipped — its slot is not re-injected, so
        // the printed output retains the original two-argument shape.
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.ema\(close, 20\)/);
    });

    it("emits callsite-id-conflict for a bgcolor sharing an issued slot id", () => {
        // bgcolor is `slot: true` like plot, so the registry-driven conflict
        // guard fires for it identically — the colliding call keeps its
        // original one-argument shape (no slot-id literal injected).
        const source = `
import { bgcolor } from "@invinite-org/chartlang-core";
bgcolor("#000");
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const seededSlotId = "demo.chart.ts:3:1#0";
        const preexisting: ts.CallExpression = ts.factory.createCallExpression(
            ts.factory.createIdentifier("noop"),
            undefined,
            [],
        );
        const slotsSeen = new Map<string, ts.CallExpression>([[seededSlotId, preexisting]]);
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
            slotsSeen,
        });
        expect(result.diagnostics).toHaveLength(1);
        const diagnostic = result.diagnostics[0];
        if (!diagnostic) throw new Error("expected diagnostic");
        expect(diagnostic.code).toBe("callsite-id-conflict");
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/bgcolor\("#000"\)/);
    });
});
