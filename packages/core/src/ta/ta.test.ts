// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { ta } from "./ta.js";

describe("ta callable holes", () => {
    it("ta.sma throws outside-runtime sentinel", () => {
        expect(() => ta.sma({ current: 0, length: 0 }, 1)).toThrow(
            "ta.sma called outside compiled runtime",
        );
    });

    it("ta.ema throws outside-runtime sentinel", () => {
        expect(() => ta.ema({ current: 0, length: 0 }, 1)).toThrow(
            "ta.ema called outside compiled runtime",
        );
    });

    it("ta.stdev throws outside-runtime sentinel", () => {
        expect(() => ta.stdev({ current: 0, length: 0 }, 1)).toThrow(
            "ta.stdev called outside compiled runtime",
        );
    });

    it("ta.bb throws outside-runtime sentinel", () => {
        expect(() => ta.bb({ current: 0, length: 0 }, 1)).toThrow(
            "ta.bb called outside compiled runtime",
        );
    });

    it("ta.rsi throws outside-runtime sentinel", () => {
        expect(() => ta.rsi({ current: 0, length: 0 }, 1)).toThrow(
            "ta.rsi called outside compiled runtime",
        );
    });

    it("ta.macd throws outside-runtime sentinel", () => {
        expect(() => ta.macd({ current: 0, length: 0 })).toThrow(
            "ta.macd called outside compiled runtime",
        );
    });

    it("ta.atr throws outside-runtime sentinel", () => {
        expect(() => ta.atr(14)).toThrow("ta.atr called outside compiled runtime");
    });

    it("ta.crossover throws outside-runtime sentinel", () => {
        expect(() => ta.crossover({ current: 0, length: 0 }, 0)).toThrow(
            "ta.crossover called outside compiled runtime",
        );
    });

    it("ta.crossunder throws outside-runtime sentinel", () => {
        expect(() => ta.crossunder({ current: 0, length: 0 }, 0)).toThrow(
            "ta.crossunder called outside compiled runtime",
        );
    });

    it("ta.rising throws outside-runtime sentinel", () => {
        expect(() => ta.rising(0, 3)).toThrow("ta.rising called outside compiled runtime");
    });

    it("ta.falling throws outside-runtime sentinel", () => {
        expect(() => ta.falling(0, 3)).toThrow("ta.falling called outside compiled runtime");
    });

    it("ta.cross throws outside-runtime sentinel", () => {
        expect(() => ta.cross(0, 0)).toThrow("ta.cross called outside compiled runtime");
    });

    it("ta.cum throws outside-runtime sentinel", () => {
        expect(() => ta.cum(0)).toThrow("ta.cum called outside compiled runtime");
    });

    it("ta.nz throws outside-runtime sentinel", () => {
        expect(() => ta.nz(Number.NaN, 0)).toThrow("ta.nz called outside compiled runtime");
    });

    it("ta.highest throws outside-runtime sentinel", () => {
        expect(() => ta.highest({ current: 0, length: 0 }, 1)).toThrow(
            "ta.highest called outside compiled runtime",
        );
    });

    it("ta.lowest throws outside-runtime sentinel", () => {
        expect(() => ta.lowest({ current: 0, length: 0 }, 1)).toThrow(
            "ta.lowest called outside compiled runtime",
        );
    });

    it("ta.highestbars throws outside-runtime sentinel", () => {
        expect(() => ta.highestbars({ current: 0, length: 0 }, 1)).toThrow(
            "ta.highestbars called outside compiled runtime",
        );
    });

    it("ta.lowestbars throws outside-runtime sentinel", () => {
        expect(() => ta.lowestbars({ current: 0, length: 0 }, 1)).toThrow(
            "ta.lowestbars called outside compiled runtime",
        );
    });

    it("ta.change throws outside-runtime sentinel", () => {
        expect(() => ta.change({ current: 0, length: 0 })).toThrow(
            "ta.change called outside compiled runtime",
        );
    });

    it("ta.valuewhen throws outside-runtime sentinel", () => {
        expect(() =>
            ta.valuewhen({ current: false, length: 0 }, { current: 0, length: 0 }),
        ).toThrow("ta.valuewhen called outside compiled runtime");
    });

    it("ta.barssince throws outside-runtime sentinel", () => {
        expect(() => ta.barssince({ current: false, length: 0 })).toThrow(
            "ta.barssince called outside compiled runtime",
        );
    });

    it("ta.wma throws outside-runtime sentinel", () => {
        expect(() => ta.wma({ current: 0, length: 0 }, 14)).toThrow(
            "ta.wma called outside compiled runtime",
        );
    });

    it("ta.vwma throws outside-runtime sentinel", () => {
        expect(() => ta.vwma({ current: 0, length: 0 }, 20)).toThrow(
            "ta.vwma called outside compiled runtime",
        );
    });

    it("ta.hma throws outside-runtime sentinel", () => {
        expect(() => ta.hma({ current: 0, length: 0 }, 21)).toThrow(
            "ta.hma called outside compiled runtime",
        );
    });

    it("ta.smma throws outside-runtime sentinel", () => {
        expect(() => ta.smma({ current: 0, length: 0 }, 14)).toThrow(
            "ta.smma called outside compiled runtime",
        );
    });

    it("ta.dema throws outside-runtime sentinel", () => {
        expect(() => ta.dema({ current: 0, length: 0 }, 20)).toThrow(
            "ta.dema called outside compiled runtime",
        );
    });

    it("ta.tema throws outside-runtime sentinel", () => {
        expect(() => ta.tema({ current: 0, length: 0 }, 20)).toThrow(
            "ta.tema called outside compiled runtime",
        );
    });

    it("ta.kama throws outside-runtime sentinel", () => {
        expect(() => ta.kama({ current: 0, length: 0 })).toThrow(
            "ta.kama called outside compiled runtime",
        );
    });

    it("ta.alma throws outside-runtime sentinel", () => {
        expect(() => ta.alma({ current: 0, length: 0 }, 9)).toThrow(
            "ta.alma called outside compiled runtime",
        );
    });

    it("ta.lsma throws outside-runtime sentinel", () => {
        expect(() => ta.lsma({ current: 0, length: 0 }, 25)).toThrow(
            "ta.lsma called outside compiled runtime",
        );
    });

    it("ta.mcginley throws outside-runtime sentinel", () => {
        expect(() => ta.mcginley({ current: 0, length: 0 }, 14)).toThrow(
            "ta.mcginley called outside compiled runtime",
        );
    });

    it("ta.maRibbon throws outside-runtime sentinel", () => {
        expect(() => ta.maRibbon({ current: 0, length: 0 })).toThrow(
            "ta.maRibbon called outside compiled runtime",
        );
    });

    it("ta.cci throws outside-runtime sentinel", () => {
        expect(() => ta.cci({ current: 0, length: 0 }, 1)).toThrow(
            "ta.cci called outside compiled runtime",
        );
    });

    it("ta.stoch throws outside-runtime sentinel", () => {
        expect(() => ta.stoch()).toThrow("ta.stoch called outside compiled runtime");
    });

    it("ta.williamsR throws outside-runtime sentinel", () => {
        expect(() => ta.williamsR(14)).toThrow("ta.williamsR called outside compiled runtime");
    });

    it("ta.stochRsi throws outside-runtime sentinel", () => {
        expect(() => ta.stochRsi({ current: 0, length: 0 })).toThrow(
            "ta.stochRsi called outside compiled runtime",
        );
    });

    it("ta.ultimateOsc throws outside-runtime sentinel", () => {
        expect(() => ta.ultimateOsc()).toThrow("ta.ultimateOsc called outside compiled runtime");
    });

    it("ta.coppock throws outside-runtime sentinel", () => {
        expect(() => ta.coppock({ current: 0, length: 0 })).toThrow(
            "ta.coppock called outside compiled runtime",
        );
    });

    it("ta.ppo throws outside-runtime sentinel", () => {
        expect(() => ta.ppo({ current: 0, length: 0 })).toThrow(
            "ta.ppo called outside compiled runtime",
        );
    });

    it("ta.dpo throws outside-runtime sentinel", () => {
        expect(() => ta.dpo({ current: 0, length: 0 }, 21)).toThrow(
            "ta.dpo called outside compiled runtime",
        );
    });

    it("ta.connorsRsi throws outside-runtime sentinel", () => {
        expect(() => ta.connorsRsi({ current: 0, length: 0 })).toThrow(
            "ta.connorsRsi called outside compiled runtime",
        );
    });

    it("ta.kst throws outside-runtime sentinel", () => {
        expect(() => ta.kst({ current: 0, length: 0 })).toThrow(
            "ta.kst called outside compiled runtime",
        );
    });

    it("ta.fisher throws outside-runtime sentinel", () => {
        expect(() => ta.fisher(9)).toThrow("ta.fisher called outside compiled runtime");
    });

    it("ta.klinger throws outside-runtime sentinel", () => {
        expect(() => ta.klinger()).toThrow("ta.klinger called outside compiled runtime");
    });

    it("ta.rvgi throws outside-runtime sentinel", () => {
        expect(() => ta.rvgi()).toThrow("ta.rvgi called outside compiled runtime");
    });

    it("ta.ao throws outside-runtime sentinel", () => {
        expect(() => ta.ao()).toThrow("ta.ao called outside compiled runtime");
    });

    it("ta.cmo throws outside-runtime sentinel", () => {
        expect(() => ta.cmo({ current: 0, length: 0 }, 9)).toThrow(
            "ta.cmo called outside compiled runtime",
        );
    });

    it("ta.momentum throws outside-runtime sentinel", () => {
        expect(() => ta.momentum({ current: 0, length: 0 }, 10)).toThrow(
            "ta.momentum called outside compiled runtime",
        );
    });

    it("ta.roc throws outside-runtime sentinel", () => {
        expect(() => ta.roc({ current: 0, length: 0 }, 12)).toThrow(
            "ta.roc called outside compiled runtime",
        );
    });

    it("ta.pmo throws outside-runtime sentinel", () => {
        expect(() => ta.pmo({ current: 0, length: 0 })).toThrow(
            "ta.pmo called outside compiled runtime",
        );
    });

    it("ta.smi throws outside-runtime sentinel", () => {
        expect(() => ta.smi()).toThrow("ta.smi called outside compiled runtime");
    });

    it("ta.tsi throws outside-runtime sentinel", () => {
        expect(() => ta.tsi({ current: 0, length: 0 })).toThrow(
            "ta.tsi called outside compiled runtime",
        );
    });

    it("ta.aroon throws outside-runtime sentinel", () => {
        expect(() => ta.aroon(14)).toThrow("ta.aroon called outside compiled runtime");
    });

    it("ta.aroonOsc throws outside-runtime sentinel", () => {
        expect(() => ta.aroonOsc(14)).toThrow("ta.aroonOsc called outside compiled runtime");
    });

    it("ta.median throws outside-runtime sentinel", () => {
        expect(() => ta.median({ current: 0, length: 0 }, 21)).toThrow(
            "ta.median called outside compiled runtime",
        );
    });

    it("ta.adr throws outside-runtime sentinel", () => {
        expect(() => ta.adr()).toThrow("ta.adr called outside compiled runtime");
    });

    it("ta.ulcerIndex throws outside-runtime sentinel", () => {
        expect(() => ta.ulcerIndex({ current: 0, length: 0 }, 14)).toThrow(
            "ta.ulcerIndex called outside compiled runtime",
        );
    });

    it("ta.vol throws outside-runtime sentinel", () => {
        expect(() => ta.vol()).toThrow("ta.vol called outside compiled runtime");
    });

    it("ta.vwap throws outside-runtime sentinel", () => {
        expect(() => ta.vwap()).toThrow("ta.vwap called outside compiled runtime");
    });

    it("ta.anchoredVwap throws outside-runtime sentinel", () => {
        expect(() => ta.anchoredVwap(1_700_000_000_000)).toThrow(
            "ta.anchoredVwap called outside compiled runtime",
        );
    });

    it("ta.anchoredVolumeProfile throws outside-runtime sentinel", () => {
        expect(() => ta.anchoredVolumeProfile({ anchor: 1_700_000_000_000 })).toThrow(
            "ta.anchoredVolumeProfile called outside compiled runtime",
        );
    });

    it("ta.fixedRangeVolumeProfile throws outside-runtime sentinel", () => {
        expect(() =>
            ta.fixedRangeVolumeProfile({ from: 1_700_000_000_000, to: 1_700_003_600_000 }),
        ).toThrow("ta.fixedRangeVolumeProfile called outside compiled runtime");
    });

    it("ta.sessionVolumeProfile throws outside-runtime sentinel", () => {
        expect(() => ta.sessionVolumeProfile()).toThrow(
            "ta.sessionVolumeProfile called outside compiled runtime",
        );
    });

    it("ta.visibleRangeVolumeProfile throws outside-runtime sentinel", () => {
        expect(() => ta.visibleRangeVolumeProfile()).toThrow(
            "ta.visibleRangeVolumeProfile called outside compiled runtime",
        );
    });

    it("ta.obv throws outside-runtime sentinel", () => {
        expect(() => ta.obv()).toThrow("ta.obv called outside compiled runtime");
    });

    it("ta.adl throws outside-runtime sentinel", () => {
        expect(() => ta.adl()).toThrow("ta.adl called outside compiled runtime");
    });

    it("ta.bop throws outside-runtime sentinel", () => {
        expect(() => ta.bop()).toThrow("ta.bop called outside compiled runtime");
    });

    it("ta.cmf throws outside-runtime sentinel", () => {
        expect(() => ta.cmf(20)).toThrow("ta.cmf called outside compiled runtime");
    });

    it("ta.chaikinOsc throws outside-runtime sentinel", () => {
        expect(() => ta.chaikinOsc()).toThrow("ta.chaikinOsc called outside compiled runtime");
    });

    it("ta.mfi throws outside-runtime sentinel", () => {
        expect(() => ta.mfi(14)).toThrow("ta.mfi called outside compiled runtime");
    });

    it("ta.netVolume throws outside-runtime sentinel", () => {
        expect(() => ta.netVolume()).toThrow("ta.netVolume called outside compiled runtime");
    });

    it("ta.pvo throws outside-runtime sentinel", () => {
        expect(() => ta.pvo()).toThrow("ta.pvo called outside compiled runtime");
    });

    it("ta.pvt throws outside-runtime sentinel", () => {
        expect(() => ta.pvt()).toThrow("ta.pvt called outside compiled runtime");
    });

    it("ta.eom throws outside-runtime sentinel", () => {
        expect(() => ta.eom(14)).toThrow("ta.eom called outside compiled runtime");
    });

    it("ta.nvi throws outside-runtime sentinel", () => {
        expect(() => ta.nvi()).toThrow("ta.nvi called outside compiled runtime");
    });

    it("ta.pvi throws outside-runtime sentinel", () => {
        expect(() => ta.pvi()).toThrow("ta.pvi called outside compiled runtime");
    });

    it("ta.bbPercentB throws outside-runtime sentinel", () => {
        expect(() => ta.bbPercentB({ current: 0, length: 0 }, 20)).toThrow(
            "ta.bbPercentB called outside compiled runtime",
        );
    });

    it("ta.bbw throws outside-runtime sentinel", () => {
        expect(() => ta.bbw({ current: 0, length: 0 }, 20)).toThrow(
            "ta.bbw called outside compiled runtime",
        );
    });

    it("ta.donchian throws outside-runtime sentinel", () => {
        expect(() => ta.donchian(20)).toThrow("ta.donchian called outside compiled runtime");
    });

    it("ta.keltner throws outside-runtime sentinel", () => {
        expect(() => ta.keltner()).toThrow("ta.keltner called outside compiled runtime");
    });

    it("ta.envelope throws outside-runtime sentinel", () => {
        expect(() => ta.envelope({ current: 0, length: 0 })).toThrow(
            "ta.envelope called outside compiled runtime",
        );
    });

    it("ta.chop throws outside-runtime sentinel", () => {
        expect(() => ta.chop(14)).toThrow("ta.chop called outside compiled runtime");
    });

    it("ta.historicalVolatility throws outside-runtime sentinel", () => {
        expect(() => ta.historicalVolatility({ current: 0, length: 0 }, 10)).toThrow(
            "ta.historicalVolatility called outside compiled runtime",
        );
    });

    it("ta.rvi throws outside-runtime sentinel", () => {
        expect(() => ta.rvi({ current: 0, length: 0 }, 10)).toThrow(
            "ta.rvi called outside compiled runtime",
        );
    });

    it("ta.massIndex throws outside-runtime sentinel", () => {
        expect(() => ta.massIndex()).toThrow("ta.massIndex called outside compiled runtime");
    });

    it("ta.psar throws outside-runtime sentinel", () => {
        expect(() => ta.psar()).toThrow("ta.psar called outside compiled runtime");
    });

    it("ta.supertrend throws outside-runtime sentinel", () => {
        expect(() => ta.supertrend()).toThrow("ta.supertrend called outside compiled runtime");
    });

    it("ta.chandelier throws outside-runtime sentinel", () => {
        expect(() => ta.chandelier()).toThrow("ta.chandelier called outside compiled runtime");
    });

    it("ta.chandeKrollStop throws outside-runtime sentinel", () => {
        expect(() => ta.chandeKrollStop()).toThrow(
            "ta.chandeKrollStop called outside compiled runtime",
        );
    });

    it("ta.williamsFractal throws outside-runtime sentinel", () => {
        expect(() => ta.williamsFractal()).toThrow(
            "ta.williamsFractal called outside compiled runtime",
        );
    });

    it("ta.zigZag throws outside-runtime sentinel", () => {
        expect(() => ta.zigZag()).toThrow("ta.zigZag called outside compiled runtime");
    });

    it("ta.pivotsHighLow throws outside-runtime sentinel", () => {
        expect(() => ta.pivotsHighLow()).toThrow(
            "ta.pivotsHighLow called outside compiled runtime",
        );
    });

    it("ta.pivotsStandard throws outside-runtime sentinel", () => {
        expect(() => ta.pivotsStandard()).toThrow(
            "ta.pivotsStandard called outside compiled runtime",
        );
    });

    it("ta.volatilityStop throws outside-runtime sentinel", () => {
        expect(() => ta.volatilityStop()).toThrow(
            "ta.volatilityStop called outside compiled runtime",
        );
    });

    it("ta.adx throws outside-runtime sentinel", () => {
        expect(() => ta.adx(14)).toThrow("ta.adx called outside compiled runtime");
    });

    it("ta.dmi throws outside-runtime sentinel", () => {
        expect(() => ta.dmi(14)).toThrow("ta.dmi called outside compiled runtime");
    });

    it("ta.trix throws outside-runtime sentinel", () => {
        expect(() => ta.trix({ current: 0, length: 0 }, 18)).toThrow(
            "ta.trix called outside compiled runtime",
        );
    });

    it("ta.vortex throws outside-runtime sentinel", () => {
        expect(() => ta.vortex(14)).toThrow("ta.vortex called outside compiled runtime");
    });

    it("ta.trendStrengthIndex throws outside-runtime sentinel", () => {
        expect(() => ta.trendStrengthIndex({ current: 0, length: 0 }, 20)).toThrow(
            "ta.trendStrengthIndex called outside compiled runtime",
        );
    });

    it("ta.ichimoku throws outside-runtime sentinel", () => {
        expect(() => ta.ichimoku()).toThrow("ta.ichimoku called outside compiled runtime");
    });

    it("ta is frozen", () => {
        expect(Object.isFrozen(ta)).toBe(true);
    });
});
