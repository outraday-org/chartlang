// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { extractCapabilities } from "./extractCapabilities";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return extractCapabilities(sourceFile, checker);
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
});
