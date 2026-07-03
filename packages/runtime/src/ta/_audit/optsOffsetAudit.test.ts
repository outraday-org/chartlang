// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdlOpts,
    AdrOpts,
    AdxOpts,
    AlmaOpts,
    AnchoredVwapOpts,
    AoOpts,
    AroonOpts,
    AroonOscOpts,
    AtrOpts,
    BarssinceOpts,
    BbOpts,
    BbPercentBOpts,
    BbwOpts,
    BopOpts,
    CciOpts,
    ChaikinOscOpts,
    ChandeKrollStopOpts,
    ChandelierOpts,
    ChangeOpts,
    ChopOpts,
    CmfOpts,
    CmoOpts,
    ConnorsRsiOpts,
    CoppockOpts,
    CrossoverOpts,
    CrossunderOpts,
    DemaOpts,
    DmiOpts,
    DonchianOpts,
    DpoOpts,
    EmaOpts,
    EnvelopeOpts,
    EomOpts,
    FisherOpts,
    HighestOpts,
    HighestbarsOpts,
    HmaOpts,
    HvOpts,
    IchimokuOpts,
    KamaOpts,
    KeltnerOpts,
    KlingerOpts,
    KstOpts,
    LowestOpts,
    LowestbarsOpts,
    LsmaOpts,
    MaRibbonOpts,
    MacdOpts,
    MassIndexOpts,
    McginleyOpts,
    MedianOpts,
    MfiOpts,
    MomentumOpts,
    NetVolumeOpts,
    NviOpts,
    ObvOpts,
    PivotsHighLowOpts,
    PivotsStandardOpts,
    PmoOpts,
    PpoOpts,
    PsarOpts,
    PviOpts,
    PvoOpts,
    PvtOpts,
    RocOpts,
    RsiOpts,
    RvgiOpts,
    RviOpts,
    SmaOpts,
    SmiOpts,
    SmmaOpts,
    StdevOpts,
    StochOpts,
    StochRsiOpts,
    SupertrendOpts,
    TaNamespace,
    TemaOpts,
    TrendStrengthIndexOpts,
    TrixOpts,
    TsiOpts,
    UlcerIndexOpts,
    UltimateOscOpts,
    ValuewhenOpts,
    VolOpts,
    VolatilityStopOpts,
    VortexOpts,
    VwapOpts,
    VwmaOpts,
    WilliamsFractalOpts,
    WilliamsROpts,
    WmaOpts,
    ZigZagOpts,
} from "@invinite-org/chartlang-core";
import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";
import { expectTypeOf } from "expect-type";

import { TA_REGISTRY } from "../registry.js";

type OffsetOpts = Readonly<{ offset?: number }>;
type AssertOffset<T extends OffsetOpts> = T;

type AuditedOpts =
    | AssertOffset<SmaOpts>
    | AssertOffset<EmaOpts>
    | AssertOffset<StdevOpts>
    | AssertOffset<BbOpts>
    | AssertOffset<RsiOpts>
    | AssertOffset<MacdOpts>
    | AssertOffset<AtrOpts>
    | AssertOffset<CrossoverOpts>
    | AssertOffset<CrossunderOpts>
    | AssertOffset<HighestOpts>
    | AssertOffset<LowestOpts>
    | AssertOffset<HighestbarsOpts>
    | AssertOffset<LowestbarsOpts>
    | AssertOffset<ChangeOpts>
    | AssertOffset<ValuewhenOpts>
    | AssertOffset<BarssinceOpts>
    | AssertOffset<WmaOpts>
    | AssertOffset<VwmaOpts>
    | AssertOffset<HmaOpts>
    | AssertOffset<SmmaOpts>
    | AssertOffset<DemaOpts>
    | AssertOffset<TemaOpts>
    | AssertOffset<KamaOpts>
    | AssertOffset<AlmaOpts>
    | AssertOffset<LsmaOpts>
    | AssertOffset<McginleyOpts>
    | AssertOffset<MaRibbonOpts>
    | AssertOffset<AoOpts>
    | AssertOffset<CmoOpts>
    | AssertOffset<MomentumOpts>
    | AssertOffset<RocOpts>
    | AssertOffset<PmoOpts>
    | AssertOffset<SmiOpts>
    | AssertOffset<TsiOpts>
    | AssertOffset<CciOpts>
    | AssertOffset<StochOpts>
    | AssertOffset<WilliamsROpts>
    | AssertOffset<StochRsiOpts>
    | AssertOffset<UltimateOscOpts>
    | AssertOffset<CoppockOpts>
    | AssertOffset<PpoOpts>
    | AssertOffset<DpoOpts>
    | AssertOffset<ConnorsRsiOpts>
    | AssertOffset<KstOpts>
    | AssertOffset<FisherOpts>
    | AssertOffset<KlingerOpts>
    | AssertOffset<RvgiOpts>
    | AssertOffset<AroonOpts>
    | AssertOffset<AroonOscOpts>
    | AssertOffset<VolOpts>
    | AssertOffset<VwapOpts>
    | AssertOffset<AnchoredVwapOpts>
    | AssertOffset<ObvOpts>
    | AssertOffset<AdlOpts>
    | AssertOffset<BopOpts>
    | AssertOffset<CmfOpts>
    | AssertOffset<ChaikinOscOpts>
    | AssertOffset<MfiOpts>
    | AssertOffset<NetVolumeOpts>
    | AssertOffset<PvoOpts>
    | AssertOffset<PvtOpts>
    | AssertOffset<EomOpts>
    | AssertOffset<NviOpts>
    | AssertOffset<PviOpts>
    | AssertOffset<BbPercentBOpts>
    | AssertOffset<BbwOpts>
    | AssertOffset<DonchianOpts>
    | AssertOffset<KeltnerOpts>
    | AssertOffset<EnvelopeOpts>
    | AssertOffset<ChopOpts>
    | AssertOffset<MedianOpts>
    | AssertOffset<AdrOpts>
    | AssertOffset<UlcerIndexOpts>
    | AssertOffset<HvOpts>
    | AssertOffset<RviOpts>
    | AssertOffset<MassIndexOpts>
    | AssertOffset<PsarOpts>
    | AssertOffset<SupertrendOpts>
    | AssertOffset<ChandelierOpts>
    | AssertOffset<ChandeKrollStopOpts>
    | AssertOffset<WilliamsFractalOpts>
    | AssertOffset<ZigZagOpts>
    | AssertOffset<PivotsHighLowOpts>
    | AssertOffset<PivotsStandardOpts>
    | AssertOffset<VolatilityStopOpts>
    | AssertOffset<AdxOpts>
    | AssertOffset<DmiOpts>
    | AssertOffset<TrixOpts>
    | AssertOffset<VortexOpts>
    | AssertOffset<TrendStrengthIndexOpts>
    | AssertOffset<IchimokuOpts>;

type RuntimeTaKey = keyof typeof TA_REGISTRY;
type CoreTaKey = keyof TaNamespace;

describe("ta opts.offset audit", () => {
    it("runtime and core ta registries expose the same keys", () => {
        expectTypeOf<RuntimeTaKey>().toEqualTypeOf<CoreTaKey>();
        expect(Object.keys(TA_REGISTRY).sort()).toEqual(
            [...STATEFUL_PRIMITIVES_BY_NAME.keys()]
                .filter((name) => name.startsWith("ta."))
                .map((name) => name.slice("ta.".length))
                .sort(),
        );
    });

    it("every options bag in the ta namespace exposes offset", () => {
        expectTypeOf<AuditedOpts>().toMatchTypeOf<OffsetOpts>();
        expect(Object.keys(TA_REGISTRY)).toHaveLength(100);
    });
});
