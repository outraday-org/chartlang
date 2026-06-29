// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { convert } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { NameAllocator, collectReservedNames } from "./nameAllocator.js";

describe("NameAllocator — readable allocation", () => {
    it("hands back the preferred base when free", () => {
        const names = new NameAllocator();
        expect(names.allocate("trail")).toBe("trail");
        expect(names.allocate("lvl")).toBe("lvl");
    });

    it("strips a leading `__` (internal underscores kept) and never emits a `__`-prefixed name", () => {
        const names = new NameAllocator();
        // Only LEADING underscores are stripped; internal `_` is a valid id char.
        expect(names.allocate("__trail_handle")).toBe("trail_handle");
        expect(names.allocate("__bar_index")).toBe("bar_index");
        for (let i = 0; i < 5; i += 1) {
            expect(names.allocate("__x").startsWith("__")).toBe(false);
        }
    });

    it("disambiguates a clash with a numeric suffix, not a prefix", () => {
        const names = new NameAllocator(["trail"]);
        expect(names.allocate("trail")).toBe("trail2");
        expect(names.allocate("trail")).toBe("trail3");
    });

    it("sanitizes invalid characters and a digit-leading base", () => {
        const names = new NameAllocator();
        expect(names.allocate("my-var!")).toBe("myvar");
        expect(names.allocate("2fast")).toBe("n2fast");
    });

    it("falls back to `value` when the preferred base sanitizes to empty", () => {
        const names = new NameAllocator();
        expect(names.allocate("___")).toBe("value");
        expect(names.allocate("!!!")).toBe("value2");
    });
});

describe("NameAllocator — seeding + reserve", () => {
    it("reports seeded and emitted names via has()", () => {
        const names = new NameAllocator(["bar"]);
        expect(names.has("bar")).toBe(true);
        expect(names.has("draw")).toBe(false);
        names.allocate("draw");
        expect(names.has("draw")).toBe(true);
    });

    it("reserve() seeds a name without renaming it", () => {
        const names = new NameAllocator();
        names.reserve("close");
        expect(names.has("close")).toBe(true);
        // A later generic allocation avoids the reserved name.
        expect(names.allocate("close")).toBe("close2");
    });
});

describe("NameAllocator — allocateForSymbol (Pine identifiers)", () => {
    it("reclaims the symbol's own seeded name", () => {
        const names = new NameAllocator(["trail"]);
        expect(names.allocateForSymbol("trail")).toBe("trail");
    });

    it("is idempotent per symbol (memoized)", () => {
        const names = new NameAllocator(["lvls"]);
        expect(names.allocateForSymbol("lvls")).toBe("lvls");
        // A second push site into the same collection gets the SAME name.
        expect(names.allocateForSymbol("lvls")).toBe("lvls");
    });

    it("avoids a name another symbol already emitted", () => {
        const names = new NameAllocator(["a", "b"]);
        // Two distinct symbols whose sanitized base collides get suffixed.
        expect(names.allocateForSymbol("a")).toBe("a");
        names.reserve("a2");
        // `a` again is memoized → still `a`, but a NEW base colliding with an
        // emitted name suffixes past both the emitted and seeded sets.
        expect(names.allocate("a")).toBe("a3");
    });
});

describe("NameAllocator — allocatedSymbol (side-effect-free peek)", () => {
    it("returns undefined before allocation and never mints a name", () => {
        const names = new NameAllocator(["lvls"]);
        expect(names.allocatedSymbol("lvls")).toBeUndefined();
        // The peek did not consume `lvls`, so a real allocation still reclaims it.
        expect(names.allocateForSymbol("lvls")).toBe("lvls");
    });

    it("returns the allocated local after allocateForSymbol", () => {
        const names = new NameAllocator(["lvls"]);
        names.allocateForSymbol("lvls");
        expect(names.allocatedSymbol("lvls")).toBe("lvls");
    });
});

describe("NameAllocator — allocateMemoized (codegen helper names)", () => {
    it("replays the same name for a repeated key", () => {
        const names = new NameAllocator();
        expect(names.allocateMemoized("barIndex", "barIndex")).toBe("barIndex");
        expect(names.allocateMemoized("barIndex", "barIndex")).toBe("barIndex");
    });

    it("disambiguates against a seeded identifier on first allocation", () => {
        const names = new NameAllocator(["barIndex"]);
        expect(names.allocateMemoized("barIndex", "barIndex")).toBe("barIndex2");
        expect(names.allocateMemoized("barIndex", "barIndex")).toBe("barIndex2");
    });
});

describe("collectReservedNames", () => {
    it("reserves the compute context params and JS reserved words", () => {
        const analysis = analyze(
            parseStatements(lex("//@version=6\nindicator('X')\nplot(close)\n").tokens).script,
        );
        const reserved = collectReservedNames(analysis);
        expect(reserved.has("bar")).toBe(true);
        expect(reserved.has("draw")).toBe(true);
        expect(reserved.has("default")).toBe(true);
        expect(reserved.has("class")).toBe(true);
    });

    it("reserves every declared Pine symbol", () => {
        const analysis = analyze(
            parseStatements(
                lex("//@version=6\nindicator('X')\nlen = input.int(14)\nplot(close)\n").tokens,
            ).script,
        );
        const reserved = collectReservedNames(analysis);
        expect(reserved.has("len")).toBe(true);
    });
});

describe("collision safety end-to-end (no `__` regression)", () => {
    // A Pine handle named `trail` reuses its own identifier; a SEPARATE Pine var
    // named `barIndex` collides with the bridge, which must suffix — never `__`.
    const src = [
        "//@version=6",
        "indicator('Tracking Line', overlay = true)",
        "barIndex = bar_index",
        "var line trail = na",
        "if barstate.isfirst",
        "    trail := line.new(bar_index, close, bar_index, close, color = color.blue)",
        "else",
        "    line.set_xy2(trail, bar_index, close)",
        "plot(barIndex)",
        "",
    ].join("\n");

    it("reuses the Pine `trail` identifier for the handle", () => {
        const output = convert(src).output ?? "";
        expect(output).toContain("const trail = draw.line(");
        expect(output).toContain("trail.update(");
    });

    it("disambiguates the bar-index bridge against the Pine `barIndex` var", () => {
        const output = convert(src).output ?? "";
        // The Pine `barIndex` scalar keeps its name; the synthesized bridge
        // takes the suffixed `barIndex2`, and NOTHING is `__`-prefixed.
        expect(output).toContain("barIndex2");
        expect(output).not.toMatch(/\b__\w/);
    });
});
