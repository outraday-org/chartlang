// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue, OutputDeclaration } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";
import type { StructuralBindingInfo } from "./structuralChecks.js";

/**
 * Producer reference recorded on a consumer-side `const` binding. The
 * same-file variant carries the local binding name; the cross-file
 * variant carries the resolved POSIX path + ES-module export name.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: ProducerRef = { kind: "same-file", bindingName: "baseTrend" };
 *     void r;
 */
export type ProducerRef =
    | Readonly<{ kind: "same-file"; bindingName: string }>
    | Readonly<{ kind: "cross-file"; sourcePath: string; exportName: string }>;

/**
 * One dep-graph edge — consumer binding → producer with the merged
 * effective inputs the bundler needs to fold into the producer's
 * compiled module at emit time.
 *
 * @since 0.7
 * @stable
 * @example
 *     declare const dummyOutputs: ReadonlyArray<OutputDeclaration>;
 *     const e: DepConsumesEntry = {
 *         localId: "fastTrend",
 *         producerRef: { kind: "same-file", bindingName: "baseTrend" },
 *         outputs: dummyOutputs,
 *         effectiveInputs: { length: 20 },
 *     };
 *     void e;
 */
export type DepConsumesEntry = Readonly<{
    readonly localId: string;
    readonly producerRef: ProducerRef;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
}>;

/**
 * One exported (drawn) indicator the file declares. `exportName` is
 * `"default"` for `export default`, the identifier text otherwise.
 *
 * @since 0.7
 * @stable
 * @example
 *     // declare const callExpression: ts.CallExpression;
 *     const d: DrawnScript = {
 *         exportName: "default",
 *         bindingName: "default",
 *         defineCall: undefined as unknown as ts.CallExpression,
 *         outputs: [],
 *         consumes: [],
 *     };
 *     void d;
 */
export type DrawnScript = Readonly<{
    readonly exportName: string;
    readonly bindingName: string;
    readonly defineCall: ts.CallExpression;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DepConsumesEntry>;
}>;

/**
 * One private (data-only) dep binding the file declares. `defineCall`
 * is `null` when the dep is a cross-file binding (the AST node lives
 * in the producer's source file).
 *
 * @since 0.7
 * @stable
 * @example
 *     const d: PrivateDep = {
 *         localId: "fastTrend",
 *         producerRef: { kind: "same-file", bindingName: "baseTrend" },
 *         effectiveInputs: { length: 20 },
 *         defineCall: null,
 *         outputs: [],
 *         consumes: [],
 *     };
 *     void d;
 */
export type PrivateDep = Readonly<{
    readonly localId: string;
    readonly producerRef: ProducerRef;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
    readonly defineCall: ts.CallExpression | null;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DepConsumesEntry>;
}>;

/**
 * Producer snapshot returned by `resolveProducer` for cross-file
 * `import X from "./Y.chart"` consumer references.
 *
 * @since 0.7
 * @stable
 * @example
 *     const snap: ProducerSnapshot = { name: "trend", outputs: [], inputs: {} };
 *     void snap;
 */
export type ProducerSnapshot = Readonly<{
    readonly name: string;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly inputs: Readonly<Record<string, unknown>>;
}>;

/**
 * Callback the bundler supplies so the analysis pass can recursively
 * compile sibling `.chart.ts` files. Returns `null` when the producer
 * cannot be resolved (cycle, unknown path, no `defineIndicator(...)`).
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: ResolveProducer = () => null;
 *     void r;
 */
export type ResolveProducer = (sourcePath: string, exportName: string) => ProducerSnapshot | null;

/**
 * The compiled dep-graph artefact returned by `extractDependencyGraph`.
 * `drawn` + `privateDeps` are the indexed binding sets; `diagnostics`
 * is the union of every per-binding diagnostic surfaced during
 * walking + validation.
 *
 * @since 0.7
 * @stable
 * @example
 *     const g: DepGraph = { drawn: [], privateDeps: [], diagnostics: [] };
 *     void g;
 */
export type DepGraph = Readonly<{
    readonly drawn: ReadonlyArray<DrawnScript>;
    readonly privateDeps: ReadonlyArray<PrivateDep>;
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

type BindingOutputs = Readonly<{
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly hasUntitledPlot: boolean;
}>;

type DepConsumesMutable = {
    localId: string;
    producerRef: ProducerRef;
    outputs: ReadonlyArray<OutputDeclaration>;
    effectiveInputs: Readonly<Record<string, JsonValue>>;
};

/**
 * Read a JSON-clean literal from a TS expression — number, string,
 * boolean, or null. Returns `undefined` for non-literal expressions
 * (identifiers, computed access, calls, …).
 */
function readJsonLiteral(node: ts.Expression): JsonValue | undefined {
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    return undefined;
}

/**
 * Read the function body the `compute` property assignment of a
 * `define*({ compute })` call literal points at. Returns `null` when
 * the property is missing or non-function (treat as zero plot calls).
 *
 * Handles both arrow functions (`compute: () => {}`) and method
 * shorthand (`compute() {}`).
 */
function readComputeBody(defineCall: ts.CallExpression): ts.Node | null {
    const arg = defineCall.arguments[0];
    /* v8 ignore next */
    if (arg === undefined || !ts.isObjectLiteralExpression(arg)) return null;
    const computeProperty = arg.properties.find((property) => {
        const name = (property as { name?: ts.PropertyName }).name;
        return name !== undefined && ts.isIdentifier(name) && name.text === "compute";
    });
    if (computeProperty === undefined) return null;
    if (ts.isPropertyAssignment(computeProperty)) {
        const initializer = computeProperty.initializer;
        return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
            ? initializer.body
            : null;
    }
    /* v8 ignore start */
    if (ts.isMethodDeclaration(computeProperty)) {
        return computeProperty.body ?? null;
    }
    return null;
}
/* v8 ignore stop */

/**
 * Sweep D — extract producer outputs from `plot(value, { title })`
 * calls inside the binding's compute body. Emits
 * `duplicate-output-title` for clashes.
 */
function extractBindingOutputs(
    binding: StructuralBindingInfo,
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): BindingOutputs {
    const body = readComputeBody(binding.defineCall);
    const outputs: OutputDeclaration[] = [];
    const seenTitles = new Set<string>();
    let hasUntitledPlot = false;

    /* v8 ignore next 3 */
    if (body === null) {
        return Object.freeze({ outputs: Object.freeze(outputs.slice()), hasUntitledPlot });
    }

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const callee = resolveCalleeName(node, checker);
            // `bgcolor`/`barcolor` are plot-producing callees, so a binding
            // that only paints a background still counts as "produces plots"
            // (drives the `dep-output-not-titled` guard). Their `title` opt is
            // a plot label, NOT a `.output()`-referenceable series-number, so
            // they never add a titled output nor trip `duplicate-output-title`.
            if (callee === "bgcolor" || callee === "barcolor") {
                hasUntitledPlot = true;
            } else if (callee === "plot") {
                const optsArg = node.arguments[1];
                let title: string | undefined;
                if (optsArg !== undefined && ts.isObjectLiteralExpression(optsArg)) {
                    for (const property of optsArg.properties) {
                        /* v8 ignore next */
                        if (!ts.isPropertyAssignment(property)) continue;
                        const propertyName = property.name;
                        if (!ts.isIdentifier(propertyName) || propertyName.text !== "title") {
                            continue;
                        }
                        const initializer = property.initializer;
                        /* v8 ignore next */
                        if (!ts.isStringLiteral(initializer)) continue;
                        title = initializer.text;
                    }
                }
                if (title === undefined) {
                    hasUntitledPlot = true;
                } else if (seenTitles.has(title)) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "duplicate-output-title",
                            message: `\`${binding.bindingName}\` declares two outputs titled "${title}". Titles must be unique within a script.`,
                            file: sourcePath,
                            node,
                            sourceFile,
                        }),
                    );
                } else {
                    seenTitles.add(title);
                    outputs.push(Object.freeze({ title, kind: "series-number" as const }));
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(body, visit);
    return Object.freeze({ outputs: Object.freeze(outputs.slice()), hasUntitledPlot });
}

type ChainResolution = Readonly<{
    readonly root: ts.Identifier;
    readonly inputs: Readonly<Record<string, JsonValue>>;
    readonly ok: boolean;
}>;

/**
 * Sweep B — resolve a `<binding>.withInputs({...}).withInputs({...})`
 * chain back to its rooted identifier and the merged effective-inputs
 * map. Emits `dep-dynamic` / `dep-invalid-input-override` for invalid
 * argument shapes.
 */
function resolveWithInputsChain(
    expression: ts.Expression,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): ChainResolution | null {
    type Layer = { args: ts.ObjectLiteralExpression; ok: boolean };
    const layers: Layer[] = [];
    let current: ts.Expression = expression;
    while (ts.isCallExpression(current)) {
        const callee = current.expression;
        /* v8 ignore next 2 */
        if (!ts.isPropertyAccessExpression(callee)) return null;
        if (callee.name.text !== "withInputs") return null;
        const arg = current.arguments[0];
        if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "dep-dynamic",
                    message:
                        "`.withInputs(...)` requires an object literal with literal-only property values.",
                    file: sourcePath,
                    node: arg ?? /* v8 ignore next */ current,
                    sourceFile,
                }),
            );
            layers.unshift({ args: ts.factory.createObjectLiteralExpression([]), ok: false });
        } else {
            layers.unshift({ args: arg, ok: true });
        }
        current = callee.expression;
    }
    /* v8 ignore next */
    if (!ts.isIdentifier(current)) return null;

    const merged: Record<string, JsonValue> = {};
    let ok = true;
    for (const layer of layers) {
        if (!layer.ok) {
            ok = false;
            continue;
        }
        for (const property of layer.args.properties) {
            if (!ts.isPropertyAssignment(property)) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "dep-dynamic",
                        message:
                            "`.withInputs(...)` requires a plain object literal — no spread, shorthand, or computed keys.",
                        file: sourcePath,
                        node: property,
                        sourceFile,
                    }),
                );
                ok = false;
                continue;
            }
            const key = property.name;
            if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "dep-dynamic",
                        message: "`.withInputs(...)` keys must be identifiers or string literals.",
                        file: sourcePath,
                        node: key,
                        sourceFile,
                    }),
                );
                ok = false;
                continue;
            }
            const literal = readJsonLiteral(property.initializer);
            if (literal === undefined) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "dep-dynamic",
                        message: `\`.withInputs({ ${key.text}: ... })\` value must be a JSON literal (number, string, boolean, or null).`,
                        file: sourcePath,
                        node: property.initializer,
                        sourceFile,
                    }),
                );
                ok = false;
                continue;
            }
            merged[key.text] = literal;
        }
    }
    return Object.freeze({
        root: current,
        inputs: Object.freeze({ ...merged }),
        ok,
    });
}

/**
 * Validate an `effectiveInputs` map against the producer's `inputs`
 * schema. Each producer-input descriptor is shaped like
 * `{ kind: "int", defaultValue: 14, ... }`. Type-mismatch and unknown
 * keys both emit `dep-invalid-input-override`.
 */
function validateInputOverrides(
    bindingName: string,
    inputs: Readonly<Record<string, JsonValue>>,
    producerInputs: Readonly<Record<string, unknown>>,
    node: ts.Node,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): void {
    for (const [key, value] of Object.entries(inputs)) {
        const descriptor = producerInputs[key];
        if (descriptor === undefined) {
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "dep-invalid-input-override",
                    message: `\`${bindingName}\` overrides input "${key}" which the producer does not declare.`,
                    file: sourcePath,
                    node,
                    sourceFile,
                }),
            );
            continue;
        }
        const expectedKind =
            typeof descriptor === "object" && descriptor !== null && "kind" in descriptor
                ? (descriptor as { kind: unknown }).kind
                : undefined;
        if (typeof expectedKind === "string") {
            const valueType = describeJsonValueKind(value);
            const expectedType = expectedTypeForKind(expectedKind);
            if (expectedType !== null && expectedType !== valueType) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "dep-invalid-input-override",
                        message: `\`${bindingName}\` override for "${key}" expects ${expectedType} (producer declared \`${expectedKind}\`), received ${valueType}.`,
                        file: sourcePath,
                        node,
                        sourceFile,
                    }),
                );
            }
        }
    }
}

function describeJsonValueKind(value: JsonValue): string {
    if (value === null) return "null";
    /* v8 ignore next */
    if (Array.isArray(value)) return "array";
    return typeof value;
}

const KIND_TO_VALUE_TYPE: ReadonlyMap<string, string> = new Map([
    ["int", "number"],
    ["float", "number"],
    ["price", "number"],
    ["time", "number"],
    ["string", "string"],
    ["enum", "string"],
    ["color", "string"],
    ["symbol", "string"],
    ["interval", "string"],
    ["bool", "boolean"],
]);

function expectedTypeForKind(kind: string): string | null {
    return KIND_TO_VALUE_TYPE.get(kind) ?? null;
}

/**
 * Walk back from a `<receiver>.output("title")` callee to a same-file
 * binding identifier OR an imported identifier — whichever applies.
 * Returns the underlying identifier or `null` when the receiver is a
 * non-resolvable shape (computed access, call result, etc.).
 */
function resolveOutputReceiverRoot(receiver: ts.Expression): ts.Identifier | null {
    if (ts.isIdentifier(receiver)) return receiver;
    return null;
}

function originIsImport(symbol: ts.Symbol): {
    moduleSpecifier: string;
    exportName: string;
} | null {
    const declarations = symbol.declarations ?? /* v8 ignore next */ [];
    for (const declaration of declarations) {
        if (ts.isImportClause(declaration)) {
            const importDecl = declaration.parent;
            const specifier = importDecl.moduleSpecifier;
            /* v8 ignore next */
            if (!ts.isStringLiteral(specifier)) continue;
            return { moduleSpecifier: specifier.text, exportName: "default" };
        }
        if (ts.isImportSpecifier(declaration)) {
            const importDecl = declaration.parent.parent.parent;
            const specifier = importDecl.moduleSpecifier;
            /* v8 ignore next */
            if (!ts.isStringLiteral(specifier)) continue;
            const exportName = declaration.propertyName?.text ?? declaration.name.text;
            return { moduleSpecifier: specifier.text, exportName };
        }
    }
    return null;
}

type ResolvedBinding =
    | Readonly<{ kind: "same-file"; binding: StructuralBindingInfo }>
    | Readonly<{
          kind: "cross-file";
          sourcePath: string;
          exportName: string;
          snapshot: ProducerSnapshot;
      }>;

function resolveBinding(
    identifier: ts.Identifier,
    checker: ts.TypeChecker,
    bindingsByName: ReadonlyMap<string, StructuralBindingInfo>,
    resolveProducer: ResolveProducer,
): ResolvedBinding | null {
    const sameFile = bindingsByName.get(identifier.text);
    if (sameFile !== undefined) {
        return Object.freeze({ kind: "same-file", binding: sameFile });
    }
    const symbol = checker.getSymbolAtLocation(identifier);
    /* v8 ignore next */
    if (symbol === undefined) return null;
    const importOrigin = originIsImport(symbol);
    if (importOrigin === null) return null;
    const snapshot = resolveProducer(importOrigin.moduleSpecifier, importOrigin.exportName);
    if (snapshot === null) return null;
    return Object.freeze({
        kind: "cross-file",
        sourcePath: importOrigin.moduleSpecifier,
        exportName: importOrigin.exportName,
        snapshot,
    });
}

/**
 * Run the dependency-graph analysis pass over a `.chart.ts` source
 * file. Sweeps the AST four times — outputs, withInputs chains,
 * consumer `.output(...)` calls, cycle detection — and returns a
 * frozen `DepGraph` plus the diagnostics surfaced along the way.
 *
 * `resolveProducer` is a caller-supplied callback that the bundler
 * (Task 3) wires to a recursive compile entry point. In Task 2 the
 * pass works against `() => null` for cross-file edges; tests pass
 * mocked snapshots instead.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const graph = extractDependencyGraph(sf, checker, "demo.chart.ts", bindings, () => null);
 *     const fn: typeof extractDependencyGraph = extractDependencyGraph;
 *     void fn;
 */
export function extractDependencyGraph(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    structuralBindings: ReadonlyArray<StructuralBindingInfo>,
    resolveProducer: ResolveProducer,
): DepGraph {
    const diagnostics: CompileDiagnostic[] = [];
    const bindingsByName = new Map<string, StructuralBindingInfo>();
    for (const binding of structuralBindings) {
        if (binding.exportKind === "default") continue;
        bindingsByName.set(binding.bindingName, binding);
    }

    const outputsByBinding = new Map<string, BindingOutputs>();
    for (const binding of structuralBindings) {
        outputsByBinding.set(
            binding.bindingName,
            extractBindingOutputs(binding, sourceFile, checker, sourcePath, diagnostics),
        );
    }

    type BindingEffectiveInputs = Readonly<{
        rootName: string;
        rootBinding: ResolvedBinding | null;
        inputs: Readonly<Record<string, JsonValue>>;
    }>;
    const effectiveInputsByBinding = new Map<string, BindingEffectiveInputs>();

    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            /* v8 ignore next */
            if (!ts.isIdentifier(declaration.name)) continue;
            const initializer = declaration.initializer;
            if (initializer === undefined) continue;
            if (!ts.isCallExpression(initializer)) continue;
            const callee = initializer.expression;
            if (ts.isPropertyAccessExpression(callee) && callee.name.text === "withInputs") {
                const chain = resolveWithInputsChain(
                    initializer,
                    sourceFile,
                    sourcePath,
                    diagnostics,
                );
                /* v8 ignore next */
                if (chain === null) continue;
                const root = resolveBinding(chain.root, checker, bindingsByName, resolveProducer);
                effectiveInputsByBinding.set(declaration.name.text, {
                    rootName: chain.root.text,
                    rootBinding: root,
                    inputs: chain.inputs,
                });
                if (root !== null && chain.ok) {
                    const producerInputs = root.kind === "cross-file" ? root.snapshot.inputs : {};
                    validateInputOverrides(
                        declaration.name.text,
                        chain.inputs,
                        producerInputs,
                        initializer,
                        sourceFile,
                        sourcePath,
                        diagnostics,
                    );
                }
            }
        }
    }

    const consumesByBinding = new Map<string, DepConsumesMutable[]>();
    for (const binding of structuralBindings) {
        consumesByBinding.set(binding.bindingName, []);
    }

    for (const binding of structuralBindings) {
        const body = readComputeBody(binding.defineCall);
        if (body === null) continue;
        const consumerConsumes = consumesByBinding.get(binding.bindingName);
        /* v8 ignore next */
        if (consumerConsumes === undefined) continue;
        const seenLocalIds = new Set<string>();
        const visit = (node: ts.Node): void => {
            if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === "output"
            ) {
                const arg = node.arguments[0];
                if (arg === undefined || !ts.isStringLiteral(arg)) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "dep-dynamic",
                            message:
                                "`<binding>.output(...)` requires a single string-literal argument.",
                            file: sourcePath,
                            node,
                            sourceFile,
                        }),
                    );
                    ts.forEachChild(node, visit);
                    return;
                }
                const title = arg.text;
                const root = resolveOutputReceiverRoot(node.expression.expression);
                if (root === null) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "dep-dynamic",
                            message:
                                "`.output(...)` receiver must trace back to a `const`-bound `defineIndicator(...)` result.",
                            file: sourcePath,
                            node,
                            sourceFile,
                        }),
                    );
                    ts.forEachChild(node, visit);
                    return;
                }
                const effective = effectiveInputsByBinding.get(root.text);
                let resolvedRootName: string;
                let resolvedRoot: ResolvedBinding | null;
                let effectiveInputs: Readonly<Record<string, JsonValue>>;
                if (effective !== undefined) {
                    resolvedRootName = effective.rootName;
                    resolvedRoot = effective.rootBinding;
                    effectiveInputs = effective.inputs;
                } else {
                    resolvedRootName = root.text;
                    resolvedRoot = resolveBinding(root, checker, bindingsByName, resolveProducer);
                    effectiveInputs = Object.freeze({});
                }
                if (resolvedRoot === null) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "dep-dynamic",
                            message: `\`.output("${title}")\` receiver \`${root.text}\` does not resolve to a known same-file or imported indicator binding.`,
                            file: sourcePath,
                            node,
                            sourceFile,
                        }),
                    );
                    ts.forEachChild(node, visit);
                    return;
                }

                const producerOutputs: ReadonlyArray<OutputDeclaration> =
                    resolvedRoot.kind === "same-file"
                        ? (outputsByBinding.get(resolvedRoot.binding.bindingName) as BindingOutputs)
                              .outputs
                        : resolvedRoot.snapshot.outputs;
                const producerHasUntitled =
                    resolvedRoot.kind === "same-file" &&
                    (outputsByBinding.get(resolvedRoot.binding.bindingName) as BindingOutputs)
                        .hasUntitledPlot;
                const titles = new Set(producerOutputs.map((o) => o.title));
                if (!titles.has(title)) {
                    if (producerHasUntitled) {
                        diagnostics.push(
                            createDiagnostic({
                                severity: "error",
                                code: "dep-output-not-titled",
                                message: `Producer \`${resolvedRootName}\` declares an untitled \`plot(...)\` but consumer references \`.output("${title}")\`. Title every \`plot\` the producer emits or remove the consumer reference.`,
                                file: sourcePath,
                                node,
                                sourceFile,
                            }),
                        );
                    } else {
                        diagnostics.push(
                            createDiagnostic({
                                severity: "error",
                                code: "dep-unknown-output",
                                message: `Producer \`${resolvedRootName}\` does not declare an output titled "${title}".`,
                                file: sourcePath,
                                node,
                                sourceFile,
                            }),
                        );
                    }
                    ts.forEachChild(node, visit);
                    return;
                }

                const localId = effective !== undefined ? root.text : root.text;
                if (!seenLocalIds.has(localId)) {
                    seenLocalIds.add(localId);
                    const producerRef: ProducerRef =
                        resolvedRoot.kind === "same-file"
                            ? Object.freeze({
                                  kind: "same-file",
                                  bindingName: resolvedRoot.binding.bindingName,
                              })
                            : Object.freeze({
                                  kind: "cross-file",
                                  sourcePath: resolvedRoot.sourcePath,
                                  exportName: resolvedRoot.exportName,
                              });
                    consumerConsumes.push({
                        localId,
                        producerRef,
                        outputs: producerOutputs,
                        effectiveInputs,
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(body, visit);
    }

    const sameFileEdges = new Map<string, Set<string>>();
    for (const [bindingName, consumes] of consumesByBinding.entries()) {
        const targets = new Set<string>();
        for (const entry of consumes) {
            if (entry.producerRef.kind === "same-file") {
                targets.add(entry.producerRef.bindingName);
            }
        }
        sameFileEdges.set(bindingName, targets);
    }
    const cycles = detectCycles(sameFileEdges);
    for (const cycle of cycles) {
        const path = `${cycle.join(" -> ")} -> ${cycle[0] ?? /* v8 ignore next */ ""}`;
        for (const member of cycle) {
            const binding = structuralBindings.find((b) => b.bindingName === member);
            /* v8 ignore next */
            if (binding === undefined) continue;
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "dep-cycle",
                    message: `Dependency cycle detected: ${path}`,
                    file: sourcePath,
                    node: binding.defineCall,
                    sourceFile,
                }),
            );
        }
    }

    const drawn: DrawnScript[] = [];
    const privateDeps: PrivateDep[] = [];
    // First emit any withInputs-derived alias bindings as synthetic
    // private deps so the bundler + runtime can mount one DepRunner
    // per unique alias. The alias has no `defineCall` of its own —
    // its compute body lives on the producer the alias chains off.
    for (const [aliasName, info] of effectiveInputsByBinding.entries()) {
        /* v8 ignore start */
        if (bindingsByName.has(aliasName)) continue;
        if (info.rootBinding === null) continue;
        /* v8 ignore stop */
        const producerRef: ProducerRef =
            info.rootBinding.kind === "same-file"
                ? Object.freeze({
                      kind: "same-file",
                      bindingName: info.rootBinding.binding.bindingName,
                  })
                : Object.freeze({
                      kind: "cross-file",
                      sourcePath: info.rootBinding.sourcePath,
                      exportName: info.rootBinding.exportName,
                  });
        const aliasOutputs: ReadonlyArray<OutputDeclaration> =
            info.rootBinding.kind === "same-file"
                ? (outputsByBinding.get(info.rootBinding.binding.bindingName) as BindingOutputs)
                      .outputs
                : info.rootBinding.snapshot.outputs;
        privateDeps.push(
            Object.freeze({
                localId: aliasName,
                producerRef,
                effectiveInputs: info.inputs,
                defineCall: null,
                outputs: aliasOutputs,
                consumes: Object.freeze([]),
            }),
        );
    }
    for (const binding of structuralBindings) {
        const outputs = (outputsByBinding.get(binding.bindingName) as BindingOutputs).outputs;
        const consumes = (consumesByBinding.get(binding.bindingName) as DepConsumesMutable[]).map(
            (entry) =>
                Object.freeze({
                    localId: entry.localId,
                    producerRef: entry.producerRef,
                    outputs: entry.outputs,
                    effectiveInputs: entry.effectiveInputs,
                }),
        );
        const frozenConsumes = Object.freeze(consumes);
        if (binding.exportKind === "private") {
            // Private structural bindings are always `const X =
            // defineIndicator(...)` direct calls — withInputs-derived
            // aliases live in `effectiveInputsByBinding` and were
            // already emitted as synthetic private deps above. Hence
            // the alias-via-private-binding branch is structurally
            // unreachable here.
            const producerRef: ProducerRef = Object.freeze({
                kind: "same-file",
                bindingName: binding.bindingName,
            });
            privateDeps.push(
                Object.freeze({
                    localId: binding.bindingName,
                    producerRef,
                    effectiveInputs: Object.freeze({}),
                    defineCall: binding.defineCall,
                    outputs,
                    consumes: frozenConsumes,
                }),
            );
        } else {
            drawn.push(
                Object.freeze({
                    exportName: binding.exportKind === "default" ? "default" : binding.bindingName,
                    bindingName: binding.bindingName,
                    defineCall: binding.defineCall,
                    outputs,
                    consumes: frozenConsumes,
                }),
            );
        }
    }

    return Object.freeze({
        drawn: Object.freeze(drawn.slice()),
        privateDeps: Object.freeze(privateDeps.slice()),
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

/**
 * Colour-marking iterative DFS — returns every cycle found in the
 * directed adjacency map. Each cycle is the ordered list of node ids
 * along the back-edge. Used by `extractDependencyGraph` to surface
 * `dep-cycle` diagnostics at every binding in the cycle.
 */
function detectCycles(edges: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const colour = new Map<string, number>();
    for (const key of edges.keys()) colour.set(key, WHITE);

    const cycles: string[][] = [];
    const seenCycles = new Set<string>();

    const dfs = (start: string): void => {
        type Frame = { node: string; iter: Iterator<string> };
        const stack: Frame[] = [];
        const pathIndex = new Map<string, number>();
        const pathOrder: string[] = [];

        const targets = edges.get(start) ?? /* v8 ignore next */ new Set<string>();
        colour.set(start, GREY);
        pathIndex.set(start, 0);
        pathOrder.push(start);
        stack.push({ node: start, iter: targets[Symbol.iterator]() });

        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            /* v8 ignore next */
            if (top === undefined) break;
            const next = top.iter.next();
            if (next.done) {
                colour.set(top.node, BLACK);
                pathIndex.delete(top.node);
                pathOrder.pop();
                stack.pop();
                continue;
            }
            const child = next.value;
            const childColour = colour.get(child) ?? /* v8 ignore next */ WHITE;
            if (childColour === BLACK) continue;
            if (childColour === GREY) {
                const startIdx = pathIndex.get(child);
                /* v8 ignore next */
                if (startIdx === undefined) continue;
                const cycle = pathOrder.slice(startIdx);
                const sortedKey = [...cycle].sort().join("|");
                if (!seenCycles.has(sortedKey)) {
                    seenCycles.add(sortedKey);
                    cycles.push(cycle);
                }
                continue;
            }
            colour.set(child, GREY);
            pathIndex.set(child, pathOrder.length);
            pathOrder.push(child);
            const childTargets = edges.get(child) ?? /* v8 ignore next */ new Set<string>();
            stack.push({ node: child, iter: childTargets[Symbol.iterator]() });
        }
    };

    for (const key of edges.keys()) {
        if (colour.get(key) === WHITE) dfs(key);
    }
    return cycles;
}
