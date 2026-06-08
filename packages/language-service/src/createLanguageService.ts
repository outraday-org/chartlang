// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { CompileError, compile } from "@invinite-org/chartlang-compiler";
import type { IntervalDescriptor } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { collectCompletions } from "./_lib/collectCompletions";
import { isInsideIntervalLiteral } from "./_lib/isInsideIntervalLiteral";
import { makeDiagnostic, mapDiagnostic } from "./_lib/mapDiagnostic";
import { findTokenAtOffset, resolveFqnAtOffset } from "./_lib/resolveFqnAtOffset";
import { toHoverDoc } from "./_lib/toHoverDoc";
import { HOVER_REGISTRY } from "./hoverRegistry.generated";
import type {
    CompletionItem,
    DefinitionLocation,
    HoverDoc,
    LanguageServiceOptions,
    LspDiagnostic,
    SignatureHelp,
} from "./types";

/**
 * Create a headless chartlang language service.
 *
 * @since 0.4
 * @stable
 * @example
 *     const service = createLanguageService();
 *     const hovers = service.getCompletions("", 0);
 *     void hovers;
 */
export function createLanguageService(opts: LanguageServiceOptions = {}): {
    compileToDiagnostics(source: string): Promise<ReadonlyArray<LspDiagnostic>>;
    getHoverDoc(source: string, offset: number): HoverDoc | null;
    getCompletions(source: string, offset: number): ReadonlyArray<CompletionItem>;
    getSignatureHelp(source: string, offset: number): SignatureHelp | null;
    getDefinition(source: string, offset: number): DefinitionLocation | null;
    getAvailableIntervals(): ReadonlyArray<IntervalDescriptor>;
} {
    const capabilities = opts.targetCapabilities;

    return Object.freeze({
        async compileToDiagnostics(source: string): Promise<ReadonlyArray<LspDiagnostic>> {
            const diagnostics: LspDiagnostic[] = [];
            try {
                await compile(source, { apiVersion: 1, sourcePath: "script.chart.ts" });
            } catch (err) {
                /* v8 ignore next 3 -- non-CompileError failures must propagate. */
                if (err instanceof CompileError)
                    diagnostics.push(...err.diagnostics.map(mapDiagnostic));
                else throw err;
            }
            if (capabilities !== undefined) {
                diagnostics.push(...collectCapabilityDiagnostics(source, capabilities));
            }
            return Object.freeze(diagnostics);
        },

        getHoverDoc(source: string, offset: number): HoverDoc | null {
            const fqn = resolveFqnAtOffset(source, offset);
            if (fqn === null) return null;
            const entry = HOVER_REGISTRY[fqn];
            return entry === undefined ? null : toHoverDoc(entry);
        },

        getCompletions(source: string, offset: number): ReadonlyArray<CompletionItem> {
            if (capabilities !== undefined && isInsideIntervalLiteral(source, offset)) {
                return Object.freeze(
                    capabilities.intervals.map((descriptor) =>
                        Object.freeze({
                            label: descriptor.value,
                            kind: "enumMember" as const,
                            insertText: descriptor.value,
                            detail: descriptor.label,
                            doc: Object.freeze({
                                title: descriptor.value,
                                summary: `Group: ${descriptor.group}`,
                            }),
                        }),
                    ),
                );
            }
            return collectCompletions(source, offset, HOVER_REGISTRY);
        },

        getSignatureHelp(source: string, offset: number): SignatureHelp | null {
            const call = findContainingCall(source, offset);
            if (call === null) return null;
            const entry = HOVER_REGISTRY[call.fqn];
            if (entry === undefined || entry.paramTable === undefined) return null;
            return Object.freeze({
                label: entry.title,
                parameters: Object.freeze(
                    entry.paramTable.map((param) =>
                        Object.freeze({ name: param.name, doc: param.doc }),
                    ),
                ),
                activeParameter: call.activeParameter,
            });
        },

        getDefinition(source: string, offset: number): DefinitionLocation | null {
            const fqn = resolveFqnAtOffset(source, offset);
            if (fqn === null || HOVER_REGISTRY[fqn] === undefined) return null;
            return Object.freeze({
                file: "packages/core/dist/index.d.ts",
                line: 1,
                column: 1,
            });
        },

        getAvailableIntervals(): ReadonlyArray<IntervalDescriptor> {
            return capabilities?.intervals ?? [];
        },
    });
}

function findContainingCall(
    source: string,
    offset: number,
): Readonly<{ fqn: string; activeParameter: number }> | null {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    const token = findTokenAtOffset(sourceFile, offset);
    if (token === null) return null;
    let current: ts.Node | undefined = token;
    while (current !== undefined) {
        if (ts.isCallExpression(current)) {
            const fqn = callExpressionName(current, sourceFile);
            /* v8 ignore next -- containing call expressions always have a syntactic name here. */
            if (fqn === null) return null;
            return Object.freeze({
                fqn,
                activeParameter: activeParameter(current, sourceFile, offset),
            });
        }
        current = current.parent;
    }
    return null;
}

function activeParameter(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    offset: number,
): number {
    let count = 0;
    const start = call.arguments.pos;
    const end = Math.min(offset, call.arguments.end);
    const text = sourceFile.text.slice(start, end);
    for (const char of text) {
        if (char === ",") count += 1;
    }
    return count;
}

function callExpressionName(call: ts.CallExpression, sourceFile: ts.SourceFile): string | null {
    const expression = call.expression;
    if (ts.isIdentifier(expression)) return expression.text;
    /* v8 ignore next -- defensive for call expressions on non-property expressions. */
    if (!ts.isPropertyAccessExpression(expression)) return null;
    const parts: string[] = [];
    let current: ts.Expression = expression;
    while (ts.isPropertyAccessExpression(current)) {
        parts.unshift(current.name.text);
        current = current.expression;
    }
    /* v8 ignore next -- defensive for nested call/element receivers. */
    if (!ts.isIdentifier(current)) return null;
    parts.unshift(current.getText(sourceFile));
    return parts.join(".");
}

function collectCapabilityDiagnostics(
    source: string,
    capabilities: NonNullable<LanguageServiceOptions["targetCapabilities"]>,
): ReadonlyArray<LspDiagnostic> {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    const diagnostics: LspDiagnostic[] = [];
    const supportedIntervals = new Set(capabilities.intervals.map((interval) => interval.value));
    const supportedPlots: ReadonlySet<string> = capabilities.plots;

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const fqn = callExpressionName(node, sourceFile);
            if (fqn === "request.security") {
                const interval = literalIntervalFromRequest(node);
                if (interval !== null && !supportedIntervals.has(interval)) {
                    diagnostics.push(
                        diagnosticAt(sourceFile, node, {
                            severity: "hint",
                            code: "unsupported-interval",
                            message: `Target adapter does not declare interval "${interval}".`,
                        }),
                    );
                }
                if (interval !== null && capabilities.multiTimeframe === false) {
                    diagnostics.push(
                        diagnosticAt(sourceFile, node, {
                            severity: "hint",
                            code: "multi-timeframe-not-supported",
                            message: "Target adapter does not support secondary timeframes.",
                        }),
                    );
                }
            }
            if (fqn === "plot") {
                const kind = literalPlotKind(node);
                if (kind !== null && !supportedPlots.has(kind)) {
                    diagnostics.push(
                        diagnosticAt(sourceFile, node, {
                            severity: "hint",
                            code: "unsupported-plot-kind",
                            message: `Target adapter does not declare plot kind "${kind}".`,
                        }),
                    );
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return Object.freeze(diagnostics);
}

function literalIntervalFromRequest(call: ts.CallExpression): string | null {
    const first = call.arguments[0];
    /* v8 ignore next -- compiler rejects non-object request.security arguments. */
    if (first === undefined || !ts.isObjectLiteralExpression(first)) return null;
    for (const property of first.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!propertyNameIs(property.name, "interval")) continue;
        /* v8 ignore next -- compiler emits request-security-interval-not-literal first. */
        return ts.isStringLiteral(property.initializer) ? property.initializer.text : null;
    }
    return null;
}

function literalPlotKind(call: ts.CallExpression): string | null {
    const opts = call.arguments[1];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return null;
    for (const property of opts.properties) {
        if (!ts.isPropertyAssignment(property) || !propertyNameIs(property.name, "style")) continue;
        if (!ts.isObjectLiteralExpression(property.initializer)) return null;
        for (const styleProperty of property.initializer.properties) {
            if (!ts.isPropertyAssignment(styleProperty)) continue;
            if (!propertyNameIs(styleProperty.name, "kind")) continue;
            return ts.isStringLiteral(styleProperty.initializer)
                ? styleProperty.initializer.text
                : null;
        }
    }
    return null;
}

function propertyNameIs(name: ts.PropertyName, expected: string): boolean {
    return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === expected;
}

function diagnosticAt(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    args: Readonly<{ severity: "hint"; code: string; message: string }>,
): LspDiagnostic {
    const start = node.getStart(sourceFile);
    const pos = sourceFile.getLineAndCharacterOfPosition(start);
    return makeDiagnostic({
        line: pos.line + 1,
        column: pos.character + 1,
        severity: args.severity,
        code: args.code,
        message: args.message,
    });
}
