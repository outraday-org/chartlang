// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { BUILTIN_SYMBOLS } from "./builtins.js";

describe("BUILTIN_SYMBOLS", () => {
    it("seeds OHLCV refs as series", () => {
        for (const name of ["open", "high", "low", "close", "volume", "bar_index", "time"]) {
            expect(BUILTIN_SYMBOLS.get(name)?.qualifier).toBe("series");
        }
    });

    it("seeds enum constants as const", () => {
        expect(BUILTIN_SYMBOLS.get("xloc.bar_index")?.qualifier).toBe("const");
        expect(BUILTIN_SYMBOLS.get("line.style_dashed")?.qualifier).toBe("const");
        expect(BUILTIN_SYMBOLS.get("label.style_label_down")?.qualifier).toBe("const");
        expect(BUILTIN_SYMBOLS.get("color.red")?.qualifier).toBe("const");
        expect(BUILTIN_SYMBOLS.get("na")?.qualifier).toBe("const");
    });

    it("reaches barstate.islast in the table", () => {
        expect(BUILTIN_SYMBOLS.has("barstate.islast")).toBe(true);
        expect(BUILTIN_SYMBOLS.get("barstate.islast")?.qualifier).toBe("const");
    });

    it("seeds object namespaces and the plot family as simple callables", () => {
        for (const name of [
            "line",
            "label",
            "box",
            "ta",
            "math",
            "input",
            "array",
            "map",
            "chart.point",
        ]) {
            expect(BUILTIN_SYMBOLS.get(name)?.qualifier).toBe("simple");
        }
        for (const name of ["plot", "plotshape", "hline", "fill", "bgcolor", "barcolor"]) {
            expect(BUILTIN_SYMBOLS.get(name)?.qualifier).toBe("simple");
        }
    });

    it("marks every built-in with the builtin kind and no declaration span", () => {
        for (const symbol of BUILTIN_SYMBOLS.values()) {
            expect(symbol.kind).toBe("builtin");
            expect(symbol.declarationSpan).toBeNull();
        }
    });
});
