// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    BbResult,
    DmiResult,
    KeltnerResult,
    MacdResult,
    SupertrendResult,
} from "@invinite-org/chartlang-core";
import { ta } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { MULTI_RETURN_TA_MAP, multiReturnTaLookup } from "./multiReturnTa.js";

// Compile-time cross-check: each row's result fields are real keys of the
// corresponding core `*Result` type (a typo or the bb middle/upper swap fails
// `tsc`). `null` Pine positions are excluded — they have no chartlang field.
const MACD_FIELDS = ["macd", "signal", "hist"] satisfies readonly (keyof MacdResult)[];
const BB_FIELDS = ["middle", "upper", "lower"] satisfies readonly (keyof BbResult)[];
const KC_FIELDS = ["middle", "upper", "lower"] satisfies readonly (keyof KeltnerResult)[];
const DMI_FIELDS = ["plusDi", "minusDi"] satisfies readonly (keyof DmiResult)[];
const SUPERTREND_FIELDS = ["line", "direction"] satisfies readonly (keyof SupertrendResult)[];

describe("MULTI_RETURN_TA_MAP", () => {
    it("ties each row's runtime fields to its compile-time-checked field list", () => {
        const nonNull = (pine: string): readonly string[] =>
            (MULTI_RETURN_TA_MAP.get(pine)?.fields ?? []).filter(
                (field): field is string => field !== null,
            );
        expect(nonNull("ta.macd")).toEqual(MACD_FIELDS);
        expect(nonNull("ta.bb")).toEqual(BB_FIELDS);
        expect(nonNull("ta.kc")).toEqual(KC_FIELDS);
        expect(nonNull("ta.dmi")).toEqual(DMI_FIELDS);
        expect(nonNull("ta.supertrend")).toEqual(SUPERTREND_FIELDS);
    });

    it("keeps ta.dmi's dropped ADX position as a null field", () => {
        expect(MULTI_RETURN_TA_MAP.get("ta.dmi")?.fields).toEqual(["plusDi", "minusDi", null]);
    });

    it("every chartlang target is a real core ta.* member", () => {
        const members = new Set(Object.keys(ta));
        for (const mapping of MULTI_RETURN_TA_MAP.values()) {
            expect(members.has(mapping.chartlang.replace(/^ta\./, ""))).toBe(true);
        }
    });

    it("resolves known members and returns null for the rest", () => {
        expect(multiReturnTaLookup("ta.macd")?.chartlang).toBe("ta.macd");
        expect(multiReturnTaLookup("ta.kc")?.chartlang).toBe("ta.keltner");
        expect(multiReturnTaLookup("ta.sma")).toBeNull();
        expect(multiReturnTaLookup("nope")).toBeNull();
    });
});
