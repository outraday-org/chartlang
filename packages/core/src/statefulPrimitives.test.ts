// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DRAWING_KINDS, KIND_CAMELCASE } from "./draw";
import { STATEFUL_PRIMITIVES, STATEFUL_PRIMITIVES_BY_NAME } from "./statefulPrimitives";

const EXPECTED_SLOT_TRUE = [
    "ta.sma",
    "ta.ema",
    "ta.stdev",
    "ta.bb",
    "ta.rsi",
    "ta.macd",
    "ta.atr",
    "ta.crossover",
    "ta.crossunder",
    "ta.highest",
    "ta.lowest",
    "ta.change",
    "ta.valuewhen",
    "ta.barssince",
    "ta.wma",
    "ta.vwma",
    "ta.hma",
    "ta.smma",
    "ta.dema",
    "ta.tema",
    "ta.kama",
    "ta.alma",
    "ta.lsma",
    "ta.mcginley",
    "ta.maRibbon",
    "ta.cci",
    "ta.stoch",
    "ta.williamsR",
    "ta.stochRsi",
    "ta.ultimateOsc",
    "ta.coppock",
    "ta.ppo",
    "ta.dpo",
    "ta.connorsRsi",
    "ta.kst",
    "ta.fisher",
    "ta.klinger",
    "ta.rvgi",
    "ta.ao",
    "ta.cmo",
    "ta.momentum",
    "ta.roc",
    "ta.pmo",
    "ta.smi",
    "ta.tsi",
    "ta.aroon",
    "ta.aroonOsc",
    "ta.adx",
    "ta.dmi",
    "ta.trix",
    "ta.vortex",
    "ta.trendStrengthIndex",
    "ta.ichimoku",
    "ta.vol",
    "ta.vwap",
    "ta.anchoredVwap",
    "ta.obv",
    "ta.adl",
    "ta.bop",
    "ta.cmf",
    "ta.chaikinOsc",
    "ta.mfi",
    "ta.netVolume",
    "ta.pvo",
    "ta.pvt",
    "ta.eom",
    "ta.nvi",
    "ta.pvi",
    "ta.median",
    "ta.adr",
    "ta.ulcerIndex",
    "ta.bbPercentB",
    "ta.bbw",
    "ta.donchian",
    "ta.keltner",
    "ta.envelope",
    "ta.chop",
    "ta.historicalVolatility",
    "ta.rvi",
    "ta.massIndex",
    "ta.psar",
    "ta.supertrend",
    "ta.chandelier",
    "ta.chandeKrollStop",
    "ta.williamsFractal",
    "ta.zigZag",
    "ta.pivotsHighLow",
    "ta.pivotsStandard",
    "ta.volatilityStop",
    "plot",
    "hline",
    "alert",
    "draw.line",
    "draw.horizontalLine",
    "draw.horizontalRay",
    "draw.verticalLine",
    "draw.crossLine",
    "draw.trendAngle",
    "draw.rectangle",
    "draw.rotatedRectangle",
    "draw.triangle",
    "draw.polyline",
    "draw.circle",
    "draw.ellipse",
    "draw.path",
    "draw.marker",
    "draw.arc",
    "draw.curve",
    "draw.doubleCurve",
    "draw.pen",
    "draw.highlighter",
    "draw.brush",
    "draw.text",
    "draw.arrow",
    "draw.arrowMarker",
    "draw.arrowMarkUp",
    "draw.arrowMarkDown",
    "draw.trendChannel",
    "draw.flatTopBottom",
    "draw.disjointChannel",
    "draw.regressionTrend",
    "draw.fibRetracement",
    "draw.fibTrendExtension",
    "draw.fibChannel",
    "draw.fibTimeZone",
    "draw.fibWedge",
    "draw.fibSpeedFan",
    "draw.fibSpeedArcs",
    "draw.fibSpiral",
    "draw.fibCircles",
    "draw.fibTrendTime",
    "draw.gannBox",
    "draw.gannSquareFixed",
    "draw.gannSquare",
    "draw.gannFan",
    "draw.pitchfork",
    "draw.pitchfan",
    "draw.xabcdPattern",
    "draw.cypherPattern",
    "draw.headAndShoulders",
    "draw.abcdPattern",
    "draw.trianglePattern",
    "draw.threeDrivesPattern",
    "draw.elliottImpulseWave",
    "draw.elliottCorrectionWave",
    "draw.elliottTriangleWave",
    "draw.elliottDoubleCombo",
    "draw.elliottTripleCombo",
    "draw.cyclicLines",
    "draw.timeCycles",
    "draw.sineLine",
    "draw.group",
    "draw.frame",
    "state.float",
    "state.int",
    "state.bool",
    "state.string",
    "state.tick.float",
    "state.tick.int",
    "state.tick.bool",
    "state.tick.string",
    "request.security",
] as const;

const EXPECTED_STATE_SLOT_TRUE = [
    "state.float",
    "state.int",
    "state.bool",
    "state.string",
    "state.tick.float",
    "state.tick.int",
    "state.tick.bool",
    "state.tick.string",
] as const;

const EXPECTED_REQUEST_SLOT_TRUE = ["request.security"] as const;

const EXPECTED_SLOT_FALSE = ["ta.nz"] as const;

const EXPECTED_ALL_NAMES = [...EXPECTED_SLOT_TRUE, ...EXPECTED_SLOT_FALSE];

describe("STATEFUL_PRIMITIVES", () => {
    it("contains exactly 163 entries (Phase-2 93 + Phase-3 61 draw.* + Phase-4 8 state.* entries + request.security)", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(163);
    });

    it("carries every expected name with the right slot flag", () => {
        const namesByFlag = new Map<string, boolean>();
        for (const entry of STATEFUL_PRIMITIVES) {
            namesByFlag.set(entry.name, entry.slot);
        }
        for (const name of EXPECTED_SLOT_TRUE) {
            expect(namesByFlag.get(name)).toBe(true);
        }
        for (const name of EXPECTED_SLOT_FALSE) {
            expect(namesByFlag.get(name)).toBe(false);
        }
        expect(new Set(namesByFlag.keys())).toEqual(new Set(EXPECTED_ALL_NAMES));
    });

    it("has exactly 162 slot: true entries and exactly 1 slot: false entry", () => {
        let trueCount = 0;
        let falseCount = 0;
        for (const entry of STATEFUL_PRIMITIVES) {
            if (entry.slot) trueCount += 1;
            else falseCount += 1;
        }
        expect(trueCount).toBe(162);
        expect(falseCount).toBe(1);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(STATEFUL_PRIMITIVES)).toBe(true);
    });

    it("includes one draw.<camelKind> entry per DrawingKind (61 total)", () => {
        const names = new Set<string>();
        for (const entry of STATEFUL_PRIMITIVES) names.add(entry.name);
        let drawCount = 0;
        for (const k of DRAWING_KINDS) {
            const camel = KIND_CAMELCASE.get(k);
            expect(camel).toBeDefined();
            const expected = `draw.${camel}`;
            expect(names.has(expected)).toBe(true);
            drawCount += 1;
        }
        expect(drawCount).toBe(61);
    });
});

describe("STATEFUL_PRIMITIVES_BY_NAME", () => {
    it("indexes every entry of STATEFUL_PRIMITIVES by name", () => {
        expect(STATEFUL_PRIMITIVES_BY_NAME.size).toBe(STATEFUL_PRIMITIVES.size);
        for (const entry of STATEFUL_PRIMITIVES) {
            expect(STATEFUL_PRIMITIVES_BY_NAME.get(entry.name)).toBe(entry);
        }
    });

    it("returns undefined for unknown names", () => {
        expect(STATEFUL_PRIMITIVES_BY_NAME.get("ta.notARealPrimitive")).toBeUndefined();
    });

    it("preserves the slot flag for ta.nz", () => {
        expect(STATEFUL_PRIMITIVES_BY_NAME.get("ta.nz")?.slot).toBe(false);
    });

    it("indexes every state slot builder as slot: true", () => {
        for (const name of EXPECTED_STATE_SLOT_TRUE) {
            expect(STATEFUL_PRIMITIVES_BY_NAME.get(name)?.slot).toBe(true);
        }
    });

    it("indexes request.security as slot: true", () => {
        for (const name of EXPECTED_REQUEST_SLOT_TRUE) {
            expect(STATEFUL_PRIMITIVES_BY_NAME.get(name)?.slot).toBe(true);
        }
    });
});
