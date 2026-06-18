// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SourceSpan } from "../index.js";
import { BUILTIN_SYMBOLS } from "./builtins.js";
import type { Scope, SymbolInfo } from "./types.js";

/**
 * A mutable scope under construction. The walker pushes symbols as it
 * encounters declarations, then {@link freezeScope} snapshots it into the
 * immutable {@link Scope} the public result exposes.
 *
 * @since 0.1
 * @stable
 * @example
 *     const b = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     void b;
 */
export type ScopeBuilder = {
    readonly parent: ScopeBuilder | null;
    readonly symbols: Map<string, SymbolInfo>;
    readonly span: SourceSpan;
};

/**
 * Open a new scope builder as a child of `parent` (or a root when `parent`
 * is `null`), covering `span`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 9,
 *         endColumn: 1,
 *     });
 *     root.parent; // null
 */
export function createScopeBuilder(parent: ScopeBuilder | null, span: SourceSpan): ScopeBuilder {
    return { parent, symbols: new Map(), span };
}

/**
 * Declare `info` in `scope` under its name, overwriting any prior binding of
 * the same name in the same scope (Pine permits re-declaration; the
 * analyzer reports it separately).
 *
 * @since 0.1
 * @stable
 * @example
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     defineSymbol(root, {
 *         name: "x",
 *         kind: "variable",
 *         declarationSpan: null,
 *         typeAnnotation: null,
 *         qualifier: "series",
 *         handleType: null,
 *     });
 *     root.symbols.has("x"); // true
 */
export function defineSymbol(scope: ScopeBuilder, info: SymbolInfo): void {
    scope.symbols.set(info.name, info);
}

/**
 * Resolve `name` from `scope` outward through its parent chain, falling back
 * to the {@link BUILTIN_SYMBOLS} table. Returns `null` when unresolved.
 *
 * @since 0.1
 * @stable
 * @example
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     resolveSymbol(root, "close")?.qualifier; // "series"
 */
export function resolveSymbol(scope: ScopeBuilder, name: string): SymbolInfo | null {
    for (let current: ScopeBuilder | null = scope; current !== null; current = current.parent) {
        const found = current.symbols.get(name);
        if (found !== undefined) {
            return found;
        }
    }
    return BUILTIN_SYMBOLS.get(name) ?? null;
}

/**
 * Whether `name` is bound in `scope` or any enclosing scope (excluding
 * built-ins). Used to tell a fresh declaration from an accidental shadow.
 *
 * @since 0.1
 * @stable
 * @example
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     isBoundInUserScopes(root, "x"); // false
 */
export function isBoundInUserScopes(scope: ScopeBuilder, name: string): boolean {
    for (let current: ScopeBuilder | null = scope; current !== null; current = current.parent) {
        if (current.symbols.has(name)) {
            return true;
        }
    }
    return false;
}

/**
 * Snapshot a {@link ScopeBuilder} (and its parent chain) into the immutable
 * {@link Scope} tree the public {@link SemanticResult} exposes.
 *
 * @since 0.1
 * @stable
 * @example
 *     const root = createScopeBuilder(null, {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     freezeScope(root).parent; // null
 */
export function freezeScope(scope: ScopeBuilder): Scope {
    return {
        parent: scope.parent === null ? null : freezeScope(scope.parent),
        symbols: new Map(scope.symbols),
        span: scope.span,
    };
}
