// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Script } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "./analyze.js";
import { classifyDrawingSites } from "./drawingCamp.js";
import { createScopeBuilder, resolveSymbol } from "./scope.js";
import type { DrawingCamp } from "./types.js";

function parse(source: string): Script {
    return parseStatements(lex(source).tokens).script;
}

function classify(source: string): DrawingCamp[] {
    return analyze(parse(source)).drawingSites.map((site) => site.camp);
}

describe("classifyDrawingSites — Camp A", () => {
    it("classifies a var line handle mutated under barstate.islast as camp-a", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var line lvl = na",
            "if barstate.islast",
            "    lvl := line.new(bar_index, close, bar_index, close)",
            "    line.set_xy1(lvl, bar_index, close)",
            "",
        ].join("\n");
        const camps = classify(source);
        expect(camps).toHaveLength(1);
        const camp = camps[0];
        expect(camp.kind).toBe("camp-a");
        if (camp.kind === "camp-a") {
            expect(camp.handleSymbol.name).toBe("lvl");
            expect(camp.handleSymbol.handleType).toBe("line");
        }
    });

    it("classifies a var box handle initialized directly as camp-a", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var box bx = box.new(bar_index, high, bar_index, low)",
            "",
        ].join("\n");
        const camps = classify(source);
        expect(camps[0].kind).toBe("camp-a");
    });
});

describe("classifyDrawingSites — Camp B", () => {
    it("extracts the ring-buffer cap and marks max-count-decl", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "if close > open",
            "    array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) > 10",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camps = classify(source);
        expect(camps).toHaveLength(1);
        const camp = camps[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.cap).toBe(10);
            expect(camp.capSource).toBe("max-count-decl");
            expect(camp.collectionSymbol.name).toBe("lines");
        }
    });

    it("accepts a >= eviction guard with array.remove eviction", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) >= 5",
            "    line.delete(array.remove(lines, 0))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.cap).toBe(5);
        }
    });

    it("ignores a non-shift delete arg and a non-array.size guard, then buckets", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) > 3",
            "    line.delete(lastLine)",
            "if close > 10",
            "    line.delete(array.shift(other))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });

    it("ignores a non-int eviction cap and falls back to bucket default", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) > maxN",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });

    it("falls back to the bucket default when a collection has no eviction or cap", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
            expect(camp.cap).toBe(50);
        }
    });
});

describe("classifyDrawingSites — Camp C", () => {
    it("uses the indicator cap for an uncapped collection (camp-c-bounded)", () => {
        const source = [
            "//@version=6",
            "indicator('a', max_lines_count=30)",
            "array.push(undeclared, line.new(bar_index, close, bar_index, close))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-c-bounded");
        if (camp.kind === "camp-c-bounded") {
            expect(camp.reasoning).toContain("30");
        }
    });

    it("rejects a collection-driven linefill as camp-c-unbounded", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var fills = array.new_linefill()",
            "array.push(fills, linefill.new(array.get(allLines, 0), array.get(allLines, 1)))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-c-unbounded");
        if (camp.kind === "camp-c-unbounded") {
            expect(camp.reasoning).toContain("linefill");
        }
    });

    it("rejects a single linefill handle as camp-c-unbounded", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var linefill lf = linefill.new(a, b)",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-c-unbounded");
    });

    it("rejects a collection with no cap and an unresolved collection symbol", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "array.push(undeclared, box.new(bar_index, high, bar_index, low))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-c-unbounded");
    });

    it("rejects a handle drawing assigned to an unresolved variable", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "ghost := line.new(bar_index, close, bar_index, close)",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-c-unbounded");
    });
});

describe("classifyDrawingSites — nested control flow flattening", () => {
    it("finds a push site nested in for/switch/else-if/block bodies", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "for i = 0 to 2",
            "    if close > open",
            "        array.push(lines, line.new(bar_index, close, bar_index, close))",
            "    else if close < open",
            "        x = 1",
            "    else",
            "        y = 2",
            "switch close",
            "    1 => high",
            "    => low",
            "if array.size(lines) > 4",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camps = classify(source);
        expect(camps[0].kind).toBe("camp-b");
        if (camps[0].kind === "camp-b") {
            expect(camps[0].cap).toBe(4);
        }
    });

    it("treats an eviction-guard delete whose arg is not a call as no eviction", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) > 4",
            "    line.delete(plain)",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });

    it("treats a guard with a non-> operator as no eviction", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) == 4",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });

    it("treats a guard whose size arg targets another collection as no eviction", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(others) > 4",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });
});

describe("classifyDrawingSites — push and eviction-body edge cases", () => {
    it("ignores non-drawing array.push forms while still classifying a real handle", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var line lvl = na",
            "array.push(nums)",
            "array.push(nums, close)",
            "array.push(array.get(grid, 0), line.new(bar_index, close, bar_index, close))",
            "lvl := line.new(bar_index, close, bar_index, close)",
            "",
        ].join("\n");
        const camps = classify(source);
        // Only the `lvl := line.new(...)` site classifies as camp-a; the
        // pushes whose 2nd arg is not a constructor, whose arity < 2, or
        // whose collection is not an identifier are skipped.
        expect(camps.filter((c) => c.kind === "camp-a")).toHaveLength(1);
    });

    it("handles a non-binary eviction guard and noisy eviction-body statements", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines)",
            "    x = 1",
            "if array.size(lines) > 6",
            "    y = 2",
            "    close",
            "    plot(close)",
            "    foo()",
            "    line.set_x1(lines)",
            "    line.delete(array.shift(lines))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.cap).toBe(6);
            expect(camp.capSource).toBe("max-count-decl");
        }
    });

    it("treats a delete of array.first (not shift/remove) as no eviction", () => {
        const source = [
            "//@version=6",
            "indicator('a')",
            "var lines = array.new_line()",
            "array.push(lines, line.new(bar_index, close, bar_index, close))",
            "if array.size(lines) > 6",
            "    line.delete(array.first(lines))",
            "",
        ].join("\n");
        const camp = classify(source)[0];
        expect(camp.kind).toBe("camp-b");
        if (camp.kind === "camp-b") {
            expect(camp.capSource).toBe("bucket-default");
        }
    });
});

describe("classifyDrawingSites — standalone entry", () => {
    it("returns no sites for an empty script", () => {
        const script = parse("//@version=6\nindicator('a')\n");
        const root = createScopeBuilder(null, script.span);
        const out = classifyDrawingSites(script, (name) => resolveSymbol(root, name), {});
        expect(out.sites).toHaveLength(0);
        expect(out.classifications.size).toBe(0);
        expect(out.diagnostics).toHaveLength(0);
    });
});
