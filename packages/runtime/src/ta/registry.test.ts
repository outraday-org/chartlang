// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { TA_REGISTRY, TA_REGISTRY_METADATA, ta } from "./registry";

describe("TA_REGISTRY", () => {
    it("ships exactly 90 entries (Phase-1 9 + Phase-2 cross-functional 6 + Task-6 MA ports 4 + Task-7 MA ports 4 + Task-8 MA ports 3 + Task-13 momentum 4 + Task-14 momentum 3 + Task-9 oscillators 3 + Task-10 oscillators 3 + Task-11 oscillators 3 + Task-12 oscillators 4 + Task-15 trend 2 + Task-16 trend 3 + Task-17 trend 3 + Task-18 volatility 3 + Task-19 volatility 3 + Task-20 volatility 3 + Task-21 volume 3 + Task-22 volume 4 + Task-23 volume 4 + Task-24 volume 4 + Task-25 S/R 2 + Task-26 S/R 3 + Task-27 S/R 4 + Task-28 statistical 3)", () => {
        const keys = Object.keys(TA_REGISTRY);
        expect(keys.length).toBe(90);
    });

    it("exposes the 90 Phase-1+2 primitives by name", () => {
        const expected = [
            "sma",
            "ema",
            "stdev",
            "bb",
            "rsi",
            "macd",
            "atr",
            "crossover",
            "crossunder",
            "nz",
            "highest",
            "lowest",
            "change",
            "valuewhen",
            "barssince",
            "wma",
            "vwma",
            "hma",
            "smma",
            "dema",
            "tema",
            "kama",
            "alma",
            "lsma",
            "mcginley",
            "maRibbon",
            "ao",
            "cmo",
            "momentum",
            "roc",
            "pmo",
            "smi",
            "tsi",
            "cci",
            "stoch",
            "williamsR",
            "stochRsi",
            "ultimateOsc",
            "coppock",
            "ppo",
            "dpo",
            "connorsRsi",
            "kst",
            "fisher",
            "klinger",
            "rvgi",
            "aroon",
            "aroonOsc",
            "vol",
            "vwap",
            "anchoredVwap",
            "obv",
            "adl",
            "bop",
            "cmf",
            "chaikinOsc",
            "mfi",
            "netVolume",
            "pvo",
            "pvt",
            "eom",
            "nvi",
            "pvi",
            "bbPercentB",
            "bbw",
            "donchian",
            "keltner",
            "envelope",
            "chop",
            "median",
            "adr",
            "ulcerIndex",
            "historicalVolatility",
            "rvi",
            "massIndex",
            "psar",
            "supertrend",
            "chandelier",
            "chandeKrollStop",
            "williamsFractal",
            "zigZag",
            "pivotsHighLow",
            "pivotsStandard",
            "volatilityStop",
            "adx",
            "dmi",
            "trix",
            "vortex",
            "trendStrengthIndex",
            "ichimoku",
        ];
        for (const name of expected) {
            expect(name in TA_REGISTRY).toBe(true);
            expect(typeof (TA_REGISTRY as unknown as Record<string, unknown>)[name]).toBe(
                "function",
            );
        }
    });

    it("is frozen", () => {
        expect(Object.isFrozen(TA_REGISTRY)).toBe(true);
    });

    it("`ta` equals TA_REGISTRY by identity", () => {
        expect(ta).toBe(TA_REGISTRY);
    });
});

describe("TA_REGISTRY_METADATA", () => {
    it("is frozen", () => {
        expect(Object.isFrozen(TA_REGISTRY_METADATA)).toBe(true);
    });

    it("records stoch's primary + visible series + fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.stoch;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("k");
        expect(meta?.visibleSeriesKeys).toEqual(["k", "d"]);
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records williamsR's fixed [-100, 0] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.williamsR;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: -100, max: 0 });
    });

    it("records stochRsi's primary + visible series + fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.stochRsi;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("k");
        expect(meta?.visibleSeriesKeys).toEqual(["k", "d"]);
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records ultimateOsc's fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.ultimateOsc;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records ppo's primary + visible series (ppo, signal, hist) + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.ppo;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("ppo");
        expect(meta?.visibleSeriesKeys).toEqual(["ppo", "signal", "hist"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records pvo's primary + visible series (pvo, signal, hist) + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.pvo;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("pvo");
        expect(meta?.visibleSeriesKeys).toEqual(["pvo", "signal", "hist"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records connorsRsi's fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.connorsRsi;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("does not record metadata for unbounded dpo", () => {
        expect(TA_REGISTRY_METADATA.dpo).toBeUndefined();
    });

    it("records pmo's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.pmo;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("pmo");
        expect(meta?.visibleSeriesKeys).toEqual(["pmo", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records smi's primary + visible series + fixed [-100, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.smi;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("smi");
        expect(meta?.visibleSeriesKeys).toEqual(["smi", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: -100, max: 100 });
    });

    it("records tsi's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.tsi;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("tsi");
        expect(meta?.visibleSeriesKeys).toEqual(["tsi", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records kst's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.kst;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("kst");
        expect(meta?.visibleSeriesKeys).toEqual(["kst", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records fisher's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.fisher;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("fisher");
        expect(meta?.visibleSeriesKeys).toEqual(["fisher", "trigger"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records klinger's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.klinger;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("klinger");
        expect(meta?.visibleSeriesKeys).toEqual(["klinger", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records rvgi's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.rvgi;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("rvgi");
        expect(meta?.visibleSeriesKeys).toEqual(["rvgi", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records aroon's primary + visible series + fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.aroon;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("up");
        expect(meta?.visibleSeriesKeys).toEqual(["up", "down"]);
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records aroonOsc's fixed [-100, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.aroonOsc;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: -100, max: 100 });
    });

    it("records donchian's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.donchian;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("middle");
        expect(meta?.visibleSeriesKeys).toEqual(["upper", "middle", "lower"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records keltner's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.keltner;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("middle");
        expect(meta?.visibleSeriesKeys).toEqual(["upper", "middle", "lower"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records envelope's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.envelope;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("middle");
        expect(meta?.visibleSeriesKeys).toEqual(["upper", "middle", "lower"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records chop's fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.chop;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records psar's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.psar;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("sar");
        expect(meta?.visibleSeriesKeys).toEqual(["sar", "direction"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records supertrend's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.supertrend;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("line");
        expect(meta?.visibleSeriesKeys).toEqual(["line", "direction"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records chandelier's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.chandelier;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("long");
        expect(meta?.visibleSeriesKeys).toEqual(["long", "short"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records chandeKrollStop's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.chandeKrollStop;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("long");
        expect(meta?.visibleSeriesKeys).toEqual(["long", "short"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records williamsFractal's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.williamsFractal;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("up");
        expect(meta?.visibleSeriesKeys).toEqual(["up", "down"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records zigZag's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.zigZag;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("value");
        expect(meta?.visibleSeriesKeys).toEqual(["value", "direction"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records pivotsHighLow's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.pivotsHighLow;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("high");
        expect(meta?.visibleSeriesKeys).toEqual(["high", "low"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records pivotsStandard's primary + seven visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.pivotsStandard;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("pp");
        expect(meta?.visibleSeriesKeys).toEqual(["pp", "r1", "s1", "r2", "s2", "r3", "s3"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records volatilityStop's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.volatilityStop;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("value");
        expect(meta?.visibleSeriesKeys).toEqual(["value", "direction"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records maRibbon's default primary + visible keys + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.maRibbon;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("ma_50");
        expect(meta?.visibleSeriesKeys).toEqual(["ma_10", "ma_20", "ma_30", "ma_40", "ma_50"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records adx's fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.adx;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records dmi's primary + visible series + fixed [0, 100] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.dmi;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("plusDi");
        expect(meta?.visibleSeriesKeys).toEqual(["plusDi", "minusDi"]);
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: 0, max: 100 });
    });

    it("records trix's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.trix;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("trix");
        expect(meta?.visibleSeriesKeys).toEqual(["trix", "signal"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records vortex's primary + visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.vortex;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("plus");
        expect(meta?.visibleSeriesKeys).toEqual(["plus", "minus"]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("records trendStrengthIndex's fixed [-1, 1] y-domain", () => {
        const meta = TA_REGISTRY_METADATA.trendStrengthIndex;
        expect(meta).toBeDefined();
        expect(meta?.yDomain).toEqual({ kind: "fixed", min: -1, max: 1 });
    });

    it("records ichimoku's primary + five visible series + auto y-domain", () => {
        const meta = TA_REGISTRY_METADATA.ichimoku;
        expect(meta).toBeDefined();
        expect(meta?.primarySeriesKey).toBe("tenkan");
        expect(meta?.visibleSeriesKeys).toEqual([
            "tenkan",
            "kijun",
            "senkouA",
            "senkouB",
            "chikou",
        ]);
        expect(meta?.yDomain).toEqual({ kind: "auto" });
    });

    it("does not record metadata for unbounded primitives (cci, sma, …)", () => {
        expect(TA_REGISTRY_METADATA.cci).toBeUndefined();
        expect(TA_REGISTRY_METADATA.sma).toBeUndefined();
    });
});
