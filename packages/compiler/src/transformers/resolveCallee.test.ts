// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { resolveCalleeName, resolveCoreSymbolForElementAccess } from "./resolveCallee";

function firstCall(
    sourceFile: ts.SourceFile,
    predicate: (call: ts.CallExpression) => boolean,
): ts.CallExpression {
    let found: ts.CallExpression | null = null;
    const visit = (node: ts.Node): void => {
        if (!found && ts.isCallExpression(node) && predicate(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    if (!found) throw new Error("call not found");
    return found;
}

describe("resolveCalleeName", () => {
    it("resolves a property-access call against the ta namespace", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "ta",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("resolves nested property-access calls against core namespaces", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { state } from "@invinite-org/chartlang-core";
state.tick.float(0);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === "float",
        );
        expect(resolveCalleeName(call, checker)).toBe("state.tick.float");
    });

    it("resolves a bare identifier call to the core symbol name", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { plot } from "@invinite-org/chartlang-core";
plot(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "plot",
        );
        expect(resolveCalleeName(call, checker)).toBe("plot");
    });

    it("returns null for user-shadowed identifiers", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const plot = (_: number) => {};
plot(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "plot",
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null for property access whose object is not an identifier", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const o = { plot: (_: number) => {} };
(o).plot(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        // The first call here is the parenthesized property-access call;
        // its expression is a PropertyAccess on a ParenthesizedExpression,
        // not an Identifier.
        const call = firstCall(sourceFile, () => true);
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null for unresolved identifiers", () => {
        const { sourceFile, checker } = createProgramForSource(
            `// @ts-ignore - intentionally unresolved
unknownFn(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "unknownFn",
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null for property-access where the object is computed", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { ta } from "@invinite-org/chartlang-core";
const ns = { ta };
ns["ta"].ema(0, 1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isElementAccessExpression(node.expression.expression),
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null when the resolved symbol carries no declarations", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { plot } from "@invinite-org/chartlang-core";
plot(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "plot",
        );
        // Wrap the checker so getSymbolAtLocation returns a symbol with
        // `declarations: undefined` — exercises the missing-declarations
        // branch in isCoreSymbol without depending on a built-in symbol
        // that may or may not satisfy the shape on any given TS version.
        const fakeChecker: ts.TypeChecker = new Proxy(checker, {
            get(target, prop, receiver) {
                if (prop === "getSymbolAtLocation") {
                    return () =>
                        ({
                            flags: 0,
                            declarations: undefined,
                            getDeclarations: () => undefined,
                        }) as unknown as ts.Symbol;
                }
                return Reflect.get(target, prop, receiver);
            },
        });
        expect(resolveCalleeName(call, fakeChecker)).toBeNull();
    });

    it("resolves a destructured `compute({ ta })` parameter callee to ta.* via the binding-element type", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute({ bar, ta }) {
        ta.ema(bar.close, 12);
    },
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "ta",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("resolves a destructured `compute({ plot })` parameter callee to plot", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "plot",
        );
        expect(resolveCalleeName(call, checker)).toBe("plot");
    });

    it("resolves a destructured `compute({ request })` parameter callee to request.security", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute({ request }) {
        request.security({ interval: "1D" });
    },
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "request",
        );
        expect(resolveCalleeName(call, checker)).toBe("request.security");
    });

    it("returns null for a destructured compute parameter property that is not in core", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute({ nope }) {
        nope();
    },
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "nope",
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null for a destructured binding whose type does not come from core (function with no symbol decls)", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const arr = [(_: number) => {}];
const [run] = arr;
run(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "run",
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("returns null for a destructured binding whose type has a symbol with non-core declarations", () => {
        const { sourceFile, checker } = createProgramForSource(
            `type Bag = { run: (n: number) => void };
declare const bag: Bag;
const { run } = bag;
run(1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "run",
        );
        expect(resolveCalleeName(call, checker)).toBeNull();
    });

    it("resolves an aliased property-access import to the canonical ta.* name", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { ta as TA } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
TA.ema(close, 20);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "TA",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("resolves an aliased identifier import to the canonical core name", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { alert as ALERT } from "@invinite-org/chartlang-core";
ALERT("hi");
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "ALERT",
        );
        expect(resolveCalleeName(call, checker)).toBe("alert");
    });

    it("resolves a renamed destructured binding `{ ta: TA }` to the canonical ta.* name", () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute({ bar, ta: TA }) {
        TA.ema(bar.close, 12);
    },
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "TA",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("resolves variable destructuring from ComputeContext through the binding type", () => {
        const { sourceFile, checker } = createProgramForSource(
            `declare const ctx: import("@invinite-org/chartlang-core").ComputeContext;
const { ta } = ctx;
ta.ema(ctx.bar.close, 12);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "ta",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("resolves renamed variable destructuring from ComputeContext through the binding type", () => {
        const { sourceFile, checker } = createProgramForSource(
            `declare const ctx: import("@invinite-org/chartlang-core").ComputeContext;
const { ta: TA } = ctx;
TA.ema(ctx.bar.close, 12);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(
            sourceFile,
            (node) =>
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.expression) &&
                node.expression.expression.text === "TA",
        );
        expect(resolveCalleeName(call, checker)).toBe("ta.ema");
    });

    it("returns null for calls whose callee is itself a call (e.g. curried)", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const f = () => (_: number) => 1;
f()(2);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const call = firstCall(sourceFile, (node) => ts.isCallExpression(node.expression));
        expect(resolveCalleeName(call, checker)).toBeNull();
    });
});

function firstElementAccess(
    sourceFile: ts.SourceFile,
    predicate: (node: ts.ElementAccessExpression) => boolean,
): ts.ElementAccessExpression {
    let found: ts.ElementAccessExpression | null = null;
    const visit = (node: ts.Node): void => {
        if (!found && ts.isElementAccessExpression(node) && predicate(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    if (!found) throw new Error("element access not found");
    return found;
}

describe("resolveCoreSymbolForElementAccess", () => {
    it('returns the canonical core name for `ta["ema"]`', () => {
        const { sourceFile, checker } = createProgramForSource(
            `import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const _ = ta["ema"](close, 20);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const access = firstElementAccess(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "ta",
        );
        expect(resolveCoreSymbolForElementAccess(access, checker)).toBe("ta");
    });

    it("returns null for an element access whose object is not an identifier", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const o = { plot: (_: number) => {} };
(o)["plot"](1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const access = firstElementAccess(sourceFile, () => true);
        expect(resolveCoreSymbolForElementAccess(access, checker)).toBeNull();
    });

    it("returns null for an element access on a non-core identifier", () => {
        const { sourceFile, checker } = createProgramForSource(
            `const ns = { ema: (_: number) => 0 };
ns["ema"](1);
`,
            { sourcePath: "demo.chart.ts" },
        );
        const access = firstElementAccess(
            sourceFile,
            (node) => ts.isIdentifier(node.expression) && node.expression.text === "ns",
        );
        expect(resolveCoreSymbolForElementAccess(access, checker)).toBeNull();
    });
});
