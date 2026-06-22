// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { plotKindFromCallsite, readLiteralTitle } from "./plotKindFromCallsite.js";

function firstCall(source: string, name: "plot" | "hline"): ts.CallExpression {
    const { sourceFile } = createProgramForSource(source, { sourcePath: "k.chart.ts" });
    let found: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
        if (
            found === undefined &&
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === name
        ) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (found === undefined) throw new Error(`no ${name} call found`);
    return found;
}

function wrap(body: string): string {
    return `
import { defineIndicator, plot, hline } from "@invinite-org/chartlang-core";
declare const v: import("@invinite-org/chartlang-core").Series<number>;
declare const dyn: import("@invinite-org/chartlang-core").PlotOpts;
declare const k: "histogram";
declare const sty: { kind: "histogram" };
export default defineIndicator({
    name: "k",
    apiVersion: 1,
    compute: ({ bar }) => { void bar; ${body} },
});
`;
}

function kindOf(source: string, name: "plot" | "hline"): ReturnType<typeof plotKindFromCallsite> {
    const call = firstCall(source, name);
    return plotKindFromCallsite(name, call.arguments[1]);
}

describe("plotKindFromCallsite", () => {
    it("bare plot with no opts ⇒ line", () => {
        expect(kindOf(wrap("plot(v);"), "plot")).toBe("line");
    });

    it("plot with empty opts ⇒ line", () => {
        expect(kindOf(wrap("plot(v, {});"), "plot")).toBe("line");
    });

    it("plot with opts but no style ⇒ line", () => {
        expect(kindOf(wrap('plot(v, { color: "#fff", title: "x" });'), "plot")).toBe("line");
    });

    it("plot with literal style.kind histogram ⇒ histogram", () => {
        expect(kindOf(wrap('plot(v, { style: { kind: "histogram" } });'), "plot")).toBe(
            "histogram",
        );
    });

    it("plot with literal style.kind area ⇒ area", () => {
        expect(kindOf(wrap('plot(v, { style: { kind: "area" } });'), "plot")).toBe("area");
    });

    it("plot with literal style.kind step-line ⇒ step-line", () => {
        expect(kindOf(wrap('plot(v, { style: { kind: "step-line" } });'), "plot")).toBe(
            "step-line",
        );
    });

    it("hline ⇒ horizontal-line", () => {
        expect(kindOf(wrap("hline(70);"), "hline")).toBe("horizontal-line");
    });

    it("bgcolor ⇒ bg-color (kind is the callee, no opts scan)", () => {
        // The aliases return directly from the callee name — the opts arg is
        // never read, so any value (here `undefined`) yields the same kind.
        expect(plotKindFromCallsite("bgcolor", undefined)).toBe("bg-color");
    });

    it("barcolor ⇒ bar-color (kind is the callee, no opts scan)", () => {
        expect(plotKindFromCallsite("barcolor", undefined)).toBe("bar-color");
    });

    it("dynamic style object ⇒ undefined (caller falls back to line)", () => {
        expect(kindOf(wrap("plot(v, { style: sty });"), "plot")).toBeUndefined();
    });

    it("style object literal with no kind property ⇒ undefined", () => {
        // `style` here is a bare object literal missing `kind`; only valid in
        // the raw AST we walk (the real PlotOptsStyle arms all require `kind`).
        const call = firstCall(wrap("plot(v, { style: { baseline: 0 } });"), "plot");
        expect(plotKindFromCallsite("plot", call.arguments[1])).toBeUndefined();
    });

    it("dynamic style.kind ⇒ undefined", () => {
        expect(kindOf(wrap("plot(v, { style: { kind: k } });"), "plot")).toBeUndefined();
    });

    it("non-member literal style.kind ⇒ undefined", () => {
        expect(kindOf(wrap('plot(v, { style: { kind: "bogus" } });'), "plot")).toBeUndefined();
    });

    it("returns undefined for an unrelated callee name", () => {
        expect(plotKindFromCallsite("ta.ema", undefined)).toBeUndefined();
    });
});

describe("readLiteralTitle", () => {
    it("reads a string-literal title", () => {
        const call = firstCall(wrap('plot(v, { title: "Vol" });'), "plot");
        expect(readLiteralTitle(call.arguments[1])).toBe("Vol");
    });

    it("omits a missing title", () => {
        const call = firstCall(wrap('plot(v, { color: "#fff" });'), "plot");
        expect(readLiteralTitle(call.arguments[1])).toBeUndefined();
    });

    it("omits a dynamic title", () => {
        const call = firstCall(wrap("plot(v, { title: k });"), "plot");
        expect(readLiteralTitle(call.arguments[1])).toBeUndefined();
    });

    it("omits when opts is absent", () => {
        const call = firstCall(wrap("plot(v);"), "plot");
        expect(readLiteralTitle(call.arguments[1])).toBeUndefined();
    });

    it("omits when opts is not an object literal", () => {
        const call = firstCall(wrap("plot(v, dyn);"), "plot");
        expect(readLiteralTitle(call.arguments[1])).toBeUndefined();
    });
});
