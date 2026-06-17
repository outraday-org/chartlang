// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import type { Token } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseVersionDirective } from "./declarations.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 };

describe("parseVersionDirective", () => {
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
