// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

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
] as const;

const EXPECTED_SLOT_FALSE = ["ta.nz"] as const;

const EXPECTED_ALL_NAMES = [...EXPECTED_SLOT_TRUE, ...EXPECTED_SLOT_FALSE];

describe("STATEFUL_PRIMITIVES", () => {
    it("contains exactly 93 entries (Phase-1 12 + Phase-2 cross-functional 6 + Task-6 MA ports 4 + Task-7 MA ports 4 + Task-8 MA ports 3 + Task-9 oscillators 3 + Task-10 oscillators 3 + Task-11 oscillators 3 + Task-12 oscillators 4 + Task-13 momentum 4 + Task-14 momentum 3 + Task-15 trend 2 + Task-16 trend 3 + Task-17 trend 3 + Task-18 volatility 3 + Task-19 volatility 3 + Task-20 volatility 3 + Task-21 volume 3 + Task-22 volume 4 + Task-23 volume 4 + Task-24 volume 4 + Task-25 S/R 2 + Task-26 S/R 3 + Task-27 S/R 4 + Task-28 statistical 3)", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(93);
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

    it("has exactly 92 slot: true entries and exactly 1 slot: false entry", () => {
        let trueCount = 0;
        let falseCount = 0;
        for (const entry of STATEFUL_PRIMITIVES) {
            if (entry.slot) trueCount += 1;
            else falseCount += 1;
        }
        expect(trueCount).toBe(92);
        expect(falseCount).toBe(1);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(STATEFUL_PRIMITIVES)).toBe(true);
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
});
