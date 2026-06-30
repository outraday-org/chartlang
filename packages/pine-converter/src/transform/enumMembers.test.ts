// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { MemberAccessExpression } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import type { EnumTypeInfo } from "../semantic/index.js";
import { resolveEnumMemberValue, resolveEnumType } from "./enumMembers.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

const enumTypes: ReadonlyMap<string, EnumTypeInfo> = new Map([
    [
        "Signal",
        {
            name: "Signal",
            defaultMember: "buy",
            members: [
                { name: "buy", value: "Buy Signal" },
                { name: "sell", value: "Sell Signal" },
            ],
        },
    ],
]);

function member(chain: readonly string[]): MemberAccessExpression {
    return { kind: "member-access-expression", head: null, chain, span: SPAN };
}

describe("enum member resolution", () => {
    it("resolves a known enum member value and type", () => {
        expect(resolveEnumMemberValue(member(["Signal", "sell"]), enumTypes)).toBe("Sell Signal");
        expect(resolveEnumType(member(["Signal", "sell"]), enumTypes)?.name).toBe("Signal");
    });

    it("returns null for non-enum member shapes", () => {
        expect(resolveEnumMemberValue(member(["Signal"]), enumTypes)).toBeNull();
        expect(resolveEnumType(member(["Signal"]), enumTypes)).toBeNull();
        const computed: MemberAccessExpression = {
            kind: "member-access-expression",
            head: member(["obj"]),
            chain: ["Signal", "sell"],
            span: SPAN,
        };
        expect(resolveEnumMemberValue(computed, enumTypes)).toBeNull();
        expect(resolveEnumType(computed, enumTypes)).toBeNull();
    });

    it("returns null for unknown enum types or members", () => {
        expect(resolveEnumMemberValue(member(["Unknown", "sell"]), enumTypes)).toBeNull();
        expect(resolveEnumType(member(["Unknown", "sell"]), enumTypes)).toBeNull();
        expect(resolveEnumMemberValue(member(["Signal", "hold"]), enumTypes)).toBeNull();
    });
});
