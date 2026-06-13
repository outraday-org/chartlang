// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { OutputDeclaration } from "@invinite-org/chartlang-core";
import ts from "typescript";

import type { DepGraph } from "../analysis/extractDependencyGraph.js";
import type { CompileDiagnostic } from "../diagnostics.js";

/**
 * Result of `rewriteDependencyAccessors`. `transformed` is the new
 * source file where every consumer-side `<binding>.output("title")`
 * call has been replaced with the synthesised
 * `__chartlang_depOutput("slotId", "localId", "title")` call the
 * runtime's dep executor (Phase 7 / Task 4) consumes.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RewriteDependencyAccessorsResult = {
 *         transformed: undefined as unknown as ts.SourceFile,
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type RewriteDependencyAccessorsResult = Readonly<{
    readonly transformed: ts.SourceFile;
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

const DEP_OUTPUT_HELPER = "__chartlang_depOutput";

/**
 * Rewrite every consumer-side `<binding>.output("title")` call into
 * `__chartlang_depOutput("slotId", "localId", "title")`. The receiver
 * traces back to a binding declared in the file's
 * {@link DepGraph}; the slot id follows the existing
 * `<sourcePath>:<line>:<col>#0` format (Phase 1 §5.5) read from the
 * **input** source file before any rewrite. Bindings that are not
 * part of the dep graph (zero consumes, unknown receivers) are
 * left untouched — they would already have raised diagnostics during
 * `extractDependencyGraph`.
 *
 * The same pass injects each producer binding's statically-resolved
 * titled `outputs` into its `defineIndicator({...})` opts literal so
 * the runtime object built by `defineIndicator` carries
 * `manifest.outputs` directly. Without this, a sibling- or dep-mounted
 * producer's `manifest.outputs` is `undefined` at runtime — the host
 * never allocates a {@link DepOutputStore} ring buffer for it and the
 * consumer's `.output("title")` reads NaN every bar (Phase-7
 * composition bug). The compiler already computes these outputs in
 * `extractDependencyGraph`; here they are baked onto the producer
 * object so every host path (worker, quickjs, conformance) wires the
 * store with zero assembler changes. The injection is scoped to
 * bindings that are producers within a composition graph — private
 * deps and named-export siblings always, the default export only when
 * the file participates in composition (multi-export or has private
 * deps) or is itself consumed cross-file — so a standalone
 * single-export script with no deps stays byte-identical.
 *
 * Runs **before** `injectCallsiteIds` so the synthesised
 * `__chartlang_depOutput` carries a slot id read from the original
 * source positions.
 *
 * @since 0.7
 * @stable
 * @example
 *     // Input:  fastTrend.output("line")
 *     // Output: __chartlang_depOutput("demo.chart.ts:6:14#0", "fastTrend", "line")
 *     const fn: typeof rewriteDependencyAccessors = rewriteDependencyAccessors;
 *     void fn;
 */
export function rewriteDependencyAccessors(
    sourceFile: ts.SourceFile,
    depGraph: DepGraph,
    sourcePath: string,
): RewriteDependencyAccessorsResult {
    const knownLocalIds = new Set<string>();
    for (const drawn of depGraph.drawn) knownLocalIds.add(drawn.bindingName);
    for (const dep of depGraph.privateDeps) knownLocalIds.add(dep.localId);
    const outputsByDefineCall = collectProducerOutputs(depGraph);
    // `withInputs`-derived aliases (synthetic private deps with no
    // `defineCall` of their own). Every such alias's declaration is
    // rewritten from `const <alias> = <root>.withInputs({...})...;` to
    // `const <alias> = <root>;` so the runtime sentinel never fires
    // when the bundle is loaded. The merged effective inputs flow into
    // the dep runner through the manifest's `dependencies` entry; the
    // alias binding itself just needs to be a `CompiledScriptObject`
    // reference.
    const aliasLocalIds = new Set<string>();
    for (const dep of depGraph.privateDeps) {
        if (dep.defineCall === null) aliasLocalIds.add(dep.localId);
    }

    const factory: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit: ts.Visitor = (node) => {
            if (ts.isCallExpression(node)) {
                const outputs = outputsByDefineCall.get(node);
                if (outputs !== undefined) {
                    const injected = injectOutputsIntoDefineCall(node, outputs);
                    return ts.visitEachChild(injected, visit, context);
                }
            }
            if (
                ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                aliasLocalIds.has(node.name.text) &&
                node.initializer !== undefined
            ) {
                const root = resolveChainRoot(node.initializer);
                if (root !== null) {
                    return ts.factory.updateVariableDeclaration(
                        node,
                        node.name,
                        node.exclamationToken,
                        node.type,
                        ts.factory.createIdentifier(root.text),
                    );
                }
            }
            if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === "output"
            ) {
                const arg = node.arguments[0];
                if (arg !== undefined && ts.isStringLiteral(arg)) {
                    const receiverRoot = resolveReceiverRoot(node.expression.expression);
                    if (receiverRoot !== null && knownLocalIds.has(receiverRoot.text)) {
                        const start = node.getStart(sourceFile);
                        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
                        const slotId = `${sourcePath}:${line + 1}:${character + 1}#0`;
                        return ts.factory.createCallExpression(
                            ts.factory.createIdentifier(DEP_OUTPUT_HELPER),
                            undefined,
                            [
                                ts.factory.createStringLiteral(slotId),
                                ts.factory.createStringLiteral(receiverRoot.text),
                                ts.factory.createStringLiteral(arg.text),
                            ],
                        );
                    }
                }
            }
            return ts.visitEachChild(node, visit, context);
        };
        return (file) => ts.visitNode(file, visit, ts.isSourceFile) as ts.SourceFile;
    };

    const result = ts.transform(sourceFile, [factory]);
    const transformed = result.transformed[0];
    result.dispose();
    return Object.freeze({
        transformed,
        diagnostics: Object.freeze([] as ReadonlyArray<CompileDiagnostic>),
    });
}

/**
 * Walk back from a `<root>.withInputs({...}).withInputs({...})` chain
 * to its rooted identifier. The analysis pass already validates every
 * alias's chain shape (`dep-dynamic` errors abort the rewrite long
 * before we reach this function), so only the happy path is exercised
 * in production; the defensive `null` branches keep the rewriter
 * conservative if a future caller misuses it.
 */
function resolveChainRoot(expression: ts.Expression): ts.Identifier | null {
    let current: ts.Expression = expression;
    while (ts.isCallExpression(current)) {
        const callee = current.expression;
        /* v8 ignore next 2 */
        if (!ts.isPropertyAccessExpression(callee)) return null;
        if (callee.name.text !== "withInputs") return null;
        current = callee.expression;
    }
    /* v8 ignore next 2 */
    if (!ts.isIdentifier(current)) return null;
    return current;
}

/**
 * Map each producer binding's original `defineIndicator(...)` call node
 * to the titled outputs that must be baked onto its runtime manifest.
 *
 * A binding is in scope when it has a real `defineCall` (withInputs
 * aliases have `null`) and declares at least one titled `plot(...)`
 * output. Every drawn binding — named-export sibling AND default — is a
 * potential producer: a same-file sibling can be consumed by the
 * default, and a single-export default can be consumed cross-file
 * (`import baseTrend from "./base-trend.chart"`). The compiler cannot
 * know during a producer file's own compile whether its default will be
 * imported elsewhere, so the default is always baked when it declares
 * titled outputs. This keeps cross-file producers self-describing
 * without an assembler change.
 *
 * Output-free bindings (no titled `plot`) are never touched, so a
 * standalone script that only emits untitled plots stays byte-identical.
 */
function collectProducerOutputs(
    depGraph: DepGraph,
): ReadonlyMap<ts.CallExpression, ReadonlyArray<OutputDeclaration>> {
    const map = new Map<ts.CallExpression, ReadonlyArray<OutputDeclaration>>();
    for (const dep of depGraph.privateDeps) {
        if (dep.defineCall !== null && dep.outputs.length > 0) {
            map.set(dep.defineCall, dep.outputs);
        }
    }
    for (const drawn of depGraph.drawn) {
        if (drawn.outputs.length > 0) map.set(drawn.defineCall, drawn.outputs);
    }
    return map;
}

/**
 * Append an `outputs: [{ title, kind }, ...]` property assignment to the
 * `defineIndicator({...})` opts object literal. The analysis pass
 * guarantees a producer binding's `defineCall` carries an object-literal
 * first argument, so the non-object-literal branch is defensive only.
 */
function injectOutputsIntoDefineCall(
    call: ts.CallExpression,
    outputs: ReadonlyArray<OutputDeclaration>,
): ts.CallExpression {
    const arg = call.arguments[0];
    /* v8 ignore next 3 */
    if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
        return call;
    }
    const outputsLiteral = ts.factory.createArrayLiteralExpression(
        outputs.map((output) =>
            ts.factory.createObjectLiteralExpression(
                [
                    ts.factory.createPropertyAssignment(
                        "title",
                        ts.factory.createStringLiteral(output.title),
                    ),
                    ts.factory.createPropertyAssignment(
                        "kind",
                        ts.factory.createStringLiteral(output.kind),
                    ),
                ],
                false,
            ),
        ),
        false,
    );
    const updatedArg = ts.factory.updateObjectLiteralExpression(arg, [
        ...arg.properties,
        ts.factory.createPropertyAssignment("outputs", outputsLiteral),
    ]);
    return ts.factory.updateCallExpression(call, call.expression, call.typeArguments, [
        updatedArg,
        ...call.arguments.slice(1),
    ]);
}

function resolveReceiverRoot(receiver: ts.Expression): ts.Identifier | null {
    // extractDependencyGraph validates that every `.output(...)` call
    // reaching the rewriter has a bare identifier receiver (or a
    // withInputs-aliased binding name we already collapsed in the
    // graph). The defensive null return is exercised by the
    // "leaves unknown .output() receivers untouched" test case where
    // the receiver type isn't an Identifier (it's a PropertyAccess).
    if (ts.isIdentifier(receiver)) return receiver;
    return null;
}
