// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import type { Token } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseVersionDirective } from "./declarations.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 };

describe("parseVersionDirective", () => {
    it("branches diagnostics by supported version", () => {
        const cases = [
            {
                source: "//@version=6\nindicator()\n",
                expected: [],
            },
            {
                source: "//@version=5\nindicator()\n",
                expected: ["pine-converter/parse/pine-version-downlevel"],
            },
            {
                source: "//@version=4\nindicator()\n",
                expected: ["pine-converter/parse/unsupported-pine-version"],
            },
        ] as const;

        for (const { source, expected } of cases) {
            const ctx = createContext(lex(source).tokens);
            parseVersionDirective(ctx);
            expect(ctx.diagnostics.map((d) => d.code)).toEqual(expected);
        }
    });

    it("tolerates leading comment and blank lines before the directive", () => {
        const ctx = createContext(
            lex("// license\n// credit\n\n//@version=6\nindicator()\n").tokens,
        );
        const directive = parseVersionDirective(ctx);
        expect(directive?.version).toBe(6);
        expect(ctx.diagnostics).toEqual([]);
    });

    it("still reports a missing directive for a comment-only file", () => {
        const ctx = createContext(lex("// only a comment\n\n").tokens);
        expect(parseVersionDirective(ctx)).toBeNull();
        expect(ctx.diagnostics.map((d) => d.code)).toEqual([
            "pine-converter/parse/missing-version-directive",
        ]);
    });

    it("defaults to version 0 (rejected) for a directive token lacking versionNumber", () => {
        // The lexer never emits this shape, but the parser must stay
        // type-safe against the optional `versionNumber` field.
        const tokens: readonly Token[] = [
            { kind: "version-directive", text: "//@version=", span: SPAN },
            { kind: "eof", text: "", span: SPAN },
        ];
        const ctx = createContext(tokens);
        const directive = parseVersionDirective(ctx);
        expect(directive?.version).toBe(0);
        expect(ctx.diagnostics.map((d) => d.code)).toEqual([
            "pine-converter/parse/unsupported-pine-version",
        ]);
    });
});
