// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DRAWING_KINDS, KIND_CAMELCASE } from "./draw/index.js";
import { STATEFUL_PRIMITIVES, STATEFUL_PRIMITIVES_BY_NAME } from "./statefulPrimitives.js";

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
    "ta.highestbars",
    "ta.lowestbars",
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
    "ta.visibleRangeVolumeProfile",
    "ta.anchoredVolumeProfile",
    "ta.sessionVolumeProfile",
    "ta.fixedRangeVolumeProfile",
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
    "draw.table",
    "state.float",
    "state.int",
    "state.bool",
    "state.string",
    "state.tick.float",
    "state.tick.int",
    "state.tick.bool",
    "state.tick.string",
    "request.security",
    "request.lowerTf",
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

const EXPECTED_REQUEST_SLOT_TRUE = ["request.security", "request.lowerTf"] as const;

const EXPECTED_SLOT_FALSE = [
    "ta.nz",
    "defineAlertCondition.signal",
    "runtime.log",
    "runtime.error",
] as const;

const EXPECTED_ALL_NAMES = [...EXPECTED_SLOT_TRUE, ...EXPECTED_SLOT_FALSE];

// apiVersion: 1 registry baseline (Phase 7). New stateful primitives are
// ADDITIVE within 1.x — when you add one, append it here too. REMOVING or
// RENAMING an entry is a language change and requires apiVersion: 2; do not
// delete or rename a name here to make a failing test pass.
// See docs/spec/versioning.md.
const FROZEN_API_V1_NAMES: ReadonlyArray<string> = [
    "alert",
    "defineAlertCondition.signal",
    "draw.abcdPattern",
    "draw.arc",
    "draw.arrow",
    "draw.arrowMarkDown",
    "draw.arrowMarkUp",
    "draw.arrowMarker",
    "draw.brush",
    "draw.circle",
    "draw.crossLine",
    "draw.curve",
    "draw.cyclicLines",
    "draw.cypherPattern",
    "draw.disjointChannel",
    "draw.doubleCurve",
    "draw.elliottCorrectionWave",
    "draw.elliottDoubleCombo",
    "draw.elliottImpulseWave",
    "draw.elliottTriangleWave",
    "draw.elliottTripleCombo",
    "draw.ellipse",
    "draw.fibChannel",
    "draw.fibCircles",
    "draw.fibRetracement",
    "draw.fibSpeedArcs",
    "draw.fibSpeedFan",
    "draw.fibSpiral",
    "draw.fibTimeZone",
    "draw.fibTrendExtension",
    "draw.fibTrendTime",
    "draw.fibWedge",
    "draw.flatTopBottom",
    "draw.frame",
    "draw.gannBox",
    "draw.gannFan",
    "draw.gannSquare",
    "draw.gannSquareFixed",
    "draw.group",
    "draw.headAndShoulders",
    "draw.highlighter",
    "draw.horizontalLine",
    "draw.horizontalRay",
    "draw.line",
    "draw.marker",
    "draw.path",
    "draw.pen",
    "draw.pitchfan",
    "draw.pitchfork",
    "draw.polyline",
    "draw.rectangle",
    "draw.regressionTrend",
    "draw.rotatedRectangle",
    "draw.sineLine",
    "draw.table",
    "draw.text",
    "draw.threeDrivesPattern",
    "draw.timeCycles",
    "draw.trendAngle",
    "draw.trendChannel",
    "draw.triangle",
    "draw.trianglePattern",
    "draw.verticalLine",
    "draw.xabcdPattern",
    "hline",
    "plot",
    "request.lowerTf",
    "request.security",
    "runtime.error",
    "runtime.log",
    "state.bool",
    "state.float",
    "state.int",
    "state.string",
    "state.tick.bool",
    "state.tick.float",
    "state.tick.int",
    "state.tick.string",
    "ta.adl",
    "ta.adr",
    "ta.adx",
    "ta.alma",
    "ta.anchoredVolumeProfile",
    "ta.anchoredVwap",
    "ta.ao",
    "ta.aroon",
    "ta.aroonOsc",
    "ta.atr",
    "ta.barssince",
    "ta.bb",
    "ta.bbPercentB",
    "ta.bbw",
    "ta.bop",
    "ta.cci",
    "ta.chaikinOsc",
    "ta.chandeKrollStop",
    "ta.chandelier",
    "ta.change",
    "ta.chop",
    "ta.cmf",
    "ta.cmo",
    "ta.connorsRsi",
    "ta.coppock",
    "ta.crossover",
    "ta.crossunder",
    "ta.dema",
    "ta.dmi",
    "ta.donchian",
    "ta.dpo",
    "ta.ema",
    "ta.envelope",
    "ta.eom",
    "ta.fisher",
    "ta.fixedRangeVolumeProfile",
    "ta.highest",
    "ta.highestbars",
    "ta.historicalVolatility",
    "ta.hma",
    "ta.ichimoku",
    "ta.kama",
    "ta.keltner",
    "ta.klinger",
    "ta.kst",
    "ta.lowest",
    "ta.lowestbars",
    "ta.lsma",
    "ta.maRibbon",
    "ta.macd",
    "ta.massIndex",
    "ta.mcginley",
    "ta.median",
    "ta.mfi",
    "ta.momentum",
    "ta.netVolume",
    "ta.nvi",
    "ta.nz",
    "ta.obv",
    "ta.pivotsHighLow",
    "ta.pivotsStandard",
    "ta.pmo",
    "ta.ppo",
    "ta.psar",
    "ta.pvi",
    "ta.pvo",
    "ta.pvt",
    "ta.roc",
    "ta.rsi",
    "ta.rvgi",
    "ta.rvi",
    "ta.sessionVolumeProfile",
    "ta.sma",
    "ta.smi",
    "ta.smma",
    "ta.stdev",
    "ta.stoch",
    "ta.stochRsi",
    "ta.supertrend",
    "ta.tema",
    "ta.trendStrengthIndex",
    "ta.trix",
    "ta.tsi",
    "ta.ulcerIndex",
    "ta.ultimateOsc",
    "ta.valuewhen",
    "ta.visibleRangeVolumeProfile",
    "ta.vol",
    "ta.volatilityStop",
    "ta.vortex",
    "ta.vwap",
    "ta.vwma",
    "ta.williamsFractal",
    "ta.williamsR",
    "ta.wma",
    "ta.zigZag",
];

describe("STATEFUL_PRIMITIVES", () => {
    it("contains exactly 174 entries after the highestbars/lowestbars additions", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(174);
    });

    it("locks the apiVersion-1 registry to the exact 174-entry name set", () => {
        const names = [...STATEFUL_PRIMITIVES].map((e) => e.name).sort();
        expect(names).toEqual(FROZEN_API_V1_NAMES);
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

    it("has exactly 170 slot: true entries and exactly 4 slot: false entries", () => {
        let trueCount = 0;
        let falseCount = 0;
        for (const entry of STATEFUL_PRIMITIVES) {
            if (entry.slot) trueCount += 1;
            else falseCount += 1;
        }
        expect(trueCount).toBe(170);
        expect(falseCount).toBe(4);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(STATEFUL_PRIMITIVES)).toBe(true);
    });

    it("includes one draw.<camelKind> entry per DrawingKind (62 total)", () => {
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
        expect(drawCount).toBe(62);
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
