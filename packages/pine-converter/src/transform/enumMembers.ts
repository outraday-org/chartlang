// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MemberAccessExpression } from "../ast/index.js";
import type { EnumTypeInfo } from "../semantic/index.js";

/**
 * Resolve a bare native Pine enum member access (`EnumType.member`) to the
 * member's semantic value. Returns `null` for non-enum shapes, unknown enum
 * types, and unknown members so callers can keep their existing fallback or
 * diagnostic behavior.
 *
 * @since 0.5
 * @stable
 * @example
 *     const enumTypes = new Map<string, EnumTypeInfo>([
 *         ["Signal", { name: "Signal", defaultMember: "buy", members: [{ name: "buy", value: "Buy" }] }],
 *     ]);
 *     void enumTypes;
 */
export function resolveEnumMemberValue(
    node: MemberAccessExpression,
    enumTypes: ReadonlyMap<string, EnumTypeInfo>,
): string | null {
    if (node.head !== null || node.chain.length !== 2) {
        return null;
    }
    const enumType = enumTypes.get(node.chain[0]);
    if (enumType === undefined) {
        return null;
    }
    const memberName = node.chain[1];
    for (const member of enumType.members) {
        if (member.name === memberName) {
            return member.value;
        }
    }
    return null;
}

/**
 * Resolve the enum type for a bare `EnumType.member` access. Used by native
 * `input.enum` lowering to emit the full declaration-ordered options list.
 *
 * @since 0.5
 * @stable
 * @example
 *     const enumTypes = new Map<string, EnumTypeInfo>();
 *     void enumTypes;
 */
export function resolveEnumType(
    node: MemberAccessExpression,
    enumTypes: ReadonlyMap<string, EnumTypeInfo>,
): EnumTypeInfo | null {
    if (node.head !== null || node.chain.length !== 2) {
        return null;
    }
    return enumTypes.get(node.chain[0]) ?? null;
}
