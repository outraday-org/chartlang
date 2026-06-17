// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SourceSpan } from "../index.js";
import type { LifetimeInfo, LifetimeMap, SymbolInfo } from "./types.js";

type MutableLifetime = {
    declarationSpan: SourceSpan;
    reassignments: SourceSpan[];
    mutations: SourceSpan[];
    deletions: SourceSpan[];
};

/**
 * Accumulates the reassignment / mutation / deletion sites of each
 * `var`/`varip` symbol during the main AST walk, then assembles the
 * immutable {@link LifetimeMap}. A symbol is registered once at its
 * declaration; later events attach to the same {@link SymbolInfo} identity.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { createLifetimeCollector } from "./lifetimes.js";
 *     const c = createLifetimeCollector();
 *     const sym = {
 *         name: "lvl",
 *         kind: "var-variable",
 *         declarationSpan: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         typeAnnotation: null,
 *         qualifier: "series",
 *         handleType: "line",
 *     } as const;
 *     c.register(sym, sym.declarationSpan);
 *     c.build().get(sym)?.reassignments.length; // 0
 */
export type LifetimeCollector = Readonly<{
    register(symbol: SymbolInfo, declarationSpan: SourceSpan): void;
    recordReassignment(symbol: SymbolInfo, span: SourceSpan): void;
    recordMutation(symbol: SymbolInfo, span: SourceSpan): void;
    recordDeletion(symbol: SymbolInfo, span: SourceSpan): void;
    build(): LifetimeMap;
}>;

/**
 * Create a fresh {@link LifetimeCollector}.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { createLifetimeCollector } from "./lifetimes.js";
 *     createLifetimeCollector().build().size; // 0
 */
export function createLifetimeCollector(): LifetimeCollector {
    const entries = new Map<SymbolInfo, MutableLifetime>();

    // Lazily create the entry, seeding `declarationSpan` from the first
    // event's span. `register` re-seeds it with the true declaration span,
    // so registration order does not matter for correctness.
    const entryFor = (symbol: SymbolInfo, span: SourceSpan): MutableLifetime => {
        const existing = entries.get(symbol);
        if (existing !== undefined) {
            return existing;
        }
        const created: MutableLifetime = {
            declarationSpan: span,
            reassignments: [],
            mutations: [],
            deletions: [],
        };
        entries.set(symbol, created);
        return created;
    };

    return {
        register(symbol, declarationSpan) {
            entryFor(symbol, declarationSpan).declarationSpan = declarationSpan;
        },
        recordReassignment(symbol, span) {
            entryFor(symbol, span).reassignments.push(span);
        },
        recordMutation(symbol, span) {
            entryFor(symbol, span).mutations.push(span);
        },
        recordDeletion(symbol, span) {
            entryFor(symbol, span).deletions.push(span);
        },
        build() {
            const result = new Map<SymbolInfo, LifetimeInfo>();
            for (const [symbol, mutable] of entries) {
                result.set(symbol, {
                    declarationSpan: mutable.declarationSpan,
                    reassignments: mutable.reassignments,
                    mutations: mutable.mutations,
                    deletions: mutable.deletions,
                });
            }
            return result;
        },
    };
}
