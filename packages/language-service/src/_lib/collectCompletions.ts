// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import type { HoverRegistryEntry } from "../hoverRegistry.generated";
import type { CompletionItem } from "../types";
import { toHoverDoc } from "./toHoverDoc";

/**
 * Collect registry and source-local completion items for an offset.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const items = collectCompletions("const length = 20;", 5, {});
 *     void items;
 */
export function collectCompletions(
    source: string,
    _offset: number,
    registry: Readonly<Record<string, HoverRegistryEntry>>,
): ReadonlyArray<CompletionItem> {
    const registryItems = Object.values(registry).map(registryCompletion);
    const localItems = collectLocalIdentifiers(source).map((label) =>
        Object.freeze({
            label,
            kind: "property" as const,
            insertText: label,
            detail: "local identifier",
        }),
    );
    const byLabel = new Map<string, CompletionItem>();
    for (const item of [...registryItems, ...localItems]) byLabel.set(item.label, item);
    return Object.freeze([...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label)));
}

function registryCompletion(entry: HoverRegistryEntry): CompletionItem {
    return Object.freeze({
        label: entry.fqn,
        kind: entry.kind === "type" ? "property" : entry.kind,
        insertText: entry.fqn,
        detail: entry.title,
        doc: toHoverDoc(entry),
    });
}

function collectLocalIdentifiers(source: string): ReadonlyArray<string> {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) names.add(node.name.text);
        if (ts.isFunctionDeclaration(node) && node.name !== undefined) names.add(node.name.text);
        if (ts.isParameter(node) && ts.isIdentifier(node.name)) names.add(node.name.text);
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return Object.freeze([...names].sort());
}
