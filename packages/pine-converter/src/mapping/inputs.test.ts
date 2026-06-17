// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { input } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";
import { INPUT_MAP, inputLookup } from "./inputs.js";

describe("INPUT_MAP", () => {
    it("passes the simple input forms straight through", () => {
        expect(INPUT_MAP.get("input.int")?.chartlang).toBe("input.int");
        expect(INPUT_MAP.get("input.float")?.chartlang).toBe("input.float");
        expect(INPUT_MAP.get("input.bool")?.chartlang).toBe("input.bool");
        expect(INPUT_MAP.get("input.string")?.chartlang).toBe("input.string");
    });

    it("maps input.timeframe → input.interval", () => {
        expect(INPUT_MAP.get("input.timeframe")?.chartlang).toBe("input.interval");
    });

    it("maps input.text_area → input.string with a multiline note", () => {
        const m = INPUT_MAP.get("input.text_area");
        expect(m?.chartlang).toBe("input.string");
        expect(m?.notes).toContain("multiline");
    });

    it("flags input.enum as a REJECT", () => {
        expect(INPUT_MAP.get("input.enum")?.chartlang).toBeNull();
    });

    it("every non-null chartlang target is a real input.* builder", () => {
        const builders = new Set(Object.keys(input));
        for (const m of INPUT_MAP.values()) {
            if (m.chartlang !== null) {
                const member = m.chartlang.replace(/^input\./, "");
                expect(builders).toContain(member);
            }
        }
    });
});

describe("inputLookup", () => {
    it("resolves a mappable input", () => {
        expect(inputLookup("input.color")?.chartlang).toBe("input.color");
    });

    it("returns null for unknown inputs and the enum REJECT", () => {
        expect(inputLookup("input.matrix")).toBeNull();
        expect(inputLookup("input.enum")).toBeNull();
    });
});
