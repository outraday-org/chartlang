// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { ta } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";
import { TA_PASSTHROUGH_MAP, taLookup } from "./taPassthrough.js";

describe("TA_PASSTHROUGH_MAP", () => {
    it("maps ta.rma → ta.smma", () => {
        expect(TA_PASSTHROUGH_MAP.get("ta.rma")?.chartlang).toBe("ta.smma");
    });

    it("projects ta.pivothigh/pivotlow onto the high/low fields", () => {
        expect(TA_PASSTHROUGH_MAP.get("ta.pivothigh")?.chartlang).toBe("ta.pivotsHighLow.high");
        expect(TA_PASSTHROUGH_MAP.get("ta.pivotlow")?.chartlang).toBe("ta.pivotsHighLow.low");
    });

    it("approximates ta.swma with a signature note", () => {
        const m = TA_PASSTHROUGH_MAP.get("ta.swma");
        expect(m?.chartlang).toBe("ta.wma");
        expect(m?.signatureNote).toContain("approximated");
    });

    it("flags kcw/dev/cum/correlation as REJECTs", () => {
        expect(TA_PASSTHROUGH_MAP.get("ta.kcw")?.chartlang).toBeNull();
        expect(TA_PASSTHROUGH_MAP.get("ta.dev")?.chartlang).toBeNull();
        expect(TA_PASSTHROUGH_MAP.get("ta.cum")?.chartlang).toBeNull();
        expect(TA_PASSTHROUGH_MAP.get("ta.correlation")?.chartlang).toBeNull();
    });

    it("every non-null chartlang base name is a real core ta.* member", () => {
        const members = new Set(Object.keys(ta));
        for (const m of TA_PASSTHROUGH_MAP.values()) {
            if (m.chartlang !== null) {
                const base = m.chartlang.replace(/^ta\./, "").split(".")[0];
                expect(members).toContain(base);
            }
        }
    });
});

describe("taLookup", () => {
    it("resolves a mappable member", () => {
        expect(taLookup("ta.ema")?.chartlang).toBe("ta.ema");
    });

    it("returns null for unknown members and REJECTs", () => {
        expect(taLookup("ta.unknown")).toBeNull();
        expect(taLookup("ta.kcw")).toBeNull();
    });
});
