// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Script } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "./analyze.js";

const HEADER = "//@version=6\nindicator('a')\n";

function parse(source: string): Script {
    return parseStatements(lex(source).tokens).script;
}

function run(source: string) {
    return analyze(parse(source));
}

describe("analyze — enum types", () => {
    it("registers enum members, values, and the first-member default", () => {
        const result = run(
            `${HEADER}enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"\n    flat\n`,
        );
        const info = result.enumTypes.get("Signal");
        const symbol = [...result.symbols.values()].find((entry) => entry.name === "Signal");

        expect(info).toEqual({
            name: "Signal",
            members: [
                { name: "buy", value: "Buy Signal" },
                { name: "sell", value: "Sell Signal" },
                { name: "flat", value: "flat" },
            ],
            defaultMember: "buy",
        });
        expect(symbol?.kind).toBe("enum-type");
        expect(symbol?.enumType).toBe(info);
    });

    it("resolves forward and backward enum member references", () => {
        const result = run(
            `${HEADER}early = Signal.buy\nenum Signal\n    buy = "Buy Signal"\n    sell\nlate = Signal.sell\n`,
        );

        expect(result.diagnostics.map((diag) => diag.code)).not.toContain(
            "pine-converter/semantic/unknown-identifier",
        );
        expect(result.diagnostics.map((diag) => diag.code)).not.toContain(
            "pine-converter/semantic/unknown-enum-member",
        );
    });

    it("reports an unknown member on a known enum type", () => {
        const result = run(`${HEADER}enum Signal\n    buy\nx = Signal.nope\n`);

        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/semantic/unknown-enum-member",
        );
        expect(result.diagnostics.map((diag) => diag.code)).not.toContain(
            "pine-converter/semantic/unknown-identifier",
        );
    });

    it("keeps the first enum type when a duplicate name is declared", () => {
        const result = run(`${HEADER}enum Signal\n    buy\nenum Signal\n    sell\n`);

        expect(result.enumTypes.get("Signal")?.members).toEqual([{ name: "buy", value: "buy" }]);
        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/semantic/accidental-shadowing",
        );
    });

    it("handles a synthetic empty enum defensively", () => {
        const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
        const script: Script = {
            kind: "script",
            version: null,
            declaration: null,
            body: [{ kind: "enum-declaration", name: "Signal", members: [], span }],
            span,
        };
        const result = analyze(script);

        expect(result.enumTypes.get("Signal")).toEqual({
            name: "Signal",
            members: [],
            defaultMember: "",
        });
    });
});
