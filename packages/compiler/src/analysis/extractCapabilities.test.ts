// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { extractCapabilities } from "./extractCapabilities.js";

function run(source: string, kind?: "indicator" | "drawing" | "alert" | "alertCondition") {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return extractCapabilities(sourceFile, checker, kind);
}

describe("extractCapabilities", () => {
    it("returns indicators only when no alert call is present", () => {
        const result = run(`
import { plot } from "@invinite-org/chartlang-core";
plot(1);
`);
        expect(result).toEqual(["indicators"]);
    });

    it("adds alerts (sorted) when alert(...) from core is called", () => {
        const result = run(`
import { alert, plot } from "@invinite-org/chartlang-core";
plot(1);
alert("hi");
`);
        expect(result).toEqual(["alerts", "indicators"]);
    });

    it("does not add alerts when a user-shadowed `alert` is called", () => {
        const result = run(`
const alert = (_: string): void => {};
alert("not core");
`);
        expect(result).toEqual(["indicators"]);
    });

    it("freezes the returned array", () => {
        const result = run(`
import { plot } from "@invinite-org/chartlang-core";
plot(1);
`);
        expect(Object.isFrozen(result)).toBe(true);
    });

    it("seeds with 'drawings' when kind is 'drawing'", () => {
        const result = run(
            `
import { draw } from "@invinite-org/chartlang-core";
draw.horizontalLine(100);
`,
            "drawing",
        );
        expect(result).toEqual(["drawings"]);
    });

    it("seeds with 'alerts' when kind is 'alert'", () => {
        const result = run(
            `
import { alert } from "@invinite-org/chartlang-core";
alert("hi");
`,
            "alert",
        );
        expect(result).toEqual(["alerts"]);
    });

    it("drawing-kind scripts that also call alert() declare both", () => {
        const result = run(
            `
import { alert, draw } from "@invinite-org/chartlang-core";
draw.horizontalLine(100);
alert("hi");
`,
            "drawing",
        );
        expect(result).toEqual(["alerts", "drawings"]);
    });

    it("seeds with alertConditions when kind is alertCondition", () => {
        const result = run(
            `
import { defineAlertCondition } from "@invinite-org/chartlang-core";
void defineAlertCondition;
`,
            "alertCondition",
        );
        expect(result).toEqual(["alertConditions"]);
    });

    it("scopes the walk to a single binding when `scope` is provided", () => {
        const source = `
import { alert, defineIndicator, plot } from "@invinite-org/chartlang-core";

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute() {
        alert("from sibling");
    },
});

export default defineIndicator({
    name: "Default",
    apiVersion: 1,
    compute() {
        plot(1);
    },
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const defineCalls: ts.CallExpression[] = [];
        const collect = (node: ts.Node): void => {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "defineIndicator"
            ) {
                defineCalls.push(node);
            }
            ts.forEachChild(node, collect);
        };
        ts.forEachChild(sourceFile, collect);

        const siblingCall = defineCalls[0];
        const defaultCall = defineCalls[1];
        expect(siblingCall).toBeDefined();
        expect(defaultCall).toBeDefined();

        const siblingCaps = extractCapabilities(
            sourceFile,
            checker,
            "indicator",
            siblingCall as ts.Node,
        );
        const defaultCaps = extractCapabilities(
            sourceFile,
            checker,
            "indicator",
            defaultCall as ts.Node,
        );
        const fileCaps = extractCapabilities(sourceFile, checker, "indicator");

        expect(siblingCaps).toEqual(["alerts", "indicators"]);
        expect(defaultCaps).toEqual(["indicators"]);
        expect(fileCaps).toEqual(["alerts", "indicators"]);
    });
});
